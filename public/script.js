
"use strict";

/* ========================================
   DRIVE EASY — COMPLETE WEBSITE FUNCTIONALITY
   Homepage + MongoDB Bookings + User Profile
   ======================================== */

document.addEventListener("DOMContentLoaded", () => {
    const $ = selector => document.querySelector(selector);
    const $$ = selector => Array.from(document.querySelectorAll(selector));

    /* ========================================
       HTML ELEMENTS
       ======================================== */

    // Booking search
    const bookingForm = $("#booking-form");
    const locationInput = $("#location");
    const pickupInput = $("#pickup");
    const returnInput = $("#return");
    const carTypeInput = $("#car-type");
    const bookingMessage = $("#booking-message");
    const carCount = $("#car-count");
    const carCards = $$(".car-card");
    const noCarsMessage = $("#no-cars");
    const viewAllButton = $("#view-all");

    // Booking review dialog
    const bookingDialog = $("#booking-dialog");
    const bookingSummary = $("#booking-summary");
    const confirmBookingButton = $("#confirm-demo");
    const dialogClose = $("#dialog-close");

    // Coupon and price breakdown
    const couponCodeInput = $("#coupon-code");
    const applyCouponButton = $("#apply-coupon");
    const couponMessage = $("#coupon-message");
    const priceBreakdown = $("#price-breakdown");
    const rentalSubtotalElement = $("#rental-subtotal");
    const couponDiscountElement = $("#coupon-discount");
    const finalTotalElement = $("#final-total");

    // Dedicated My Bookings page
    const bookingsList = $("#demo-bookings-list");
    const clearBookingsButton = $("#clear-demo-bookings");

    // Navigation
    const menuToggle = $("#menu-toggle");
    const navLinks = $("#nav-links");

    // Profile menu
    const loggedOutActions = $("#logged-out-actions");
    const profileMenu = $("#profile-menu");
    const profileTrigger = $("#profile-trigger");
    const profileDropdown = $("#profile-dropdown");
    const navAvatar = $("#nav-avatar");
    const dropdownAvatar = $("#dropdown-avatar");
    const navName = $("#nav-profile-name");
    const dropdownName = $("#dropdown-name");
    const dropdownEmail = $("#dropdown-email");
    const photoInput = $("#profile-photo-input");
    const changePhotoButton = $("#change-profile-photo");
    const profileFeedback = $("#profile-feedback");
    const logoutButton = $("#profile-logout");

    // Profile editor
    const profileEditDialog = $("#profile-edit-dialog");
    const profileEditForm = $("#profile-edit-form");
    const profileEditName = $("#profile-edit-name");
    const profileEditEmail = $("#profile-edit-email");
    const profileEditMessage = $("#profile-edit-message");
    const profileEditSave = $("#profile-edit-save");
    const profileEditClose = $("#profile-edit-close");
    const profileEditCancel = $("#profile-edit-cancel");

    /* ========================================
       APPLICATION STATE
       ======================================== */

    let selectedCar = null;
    let bookingSubmitting = false;
    let searchHasRun = false;
    let currentUser = null;

    let appliedCoupon = null;
    let couponSubmitting = false;
    let pendingCouponCode = "";

    /* ========================================
       GENERAL HELPERS
       ======================================== */

    const currentYear = $("#current-year");

    if (currentYear) {
        currentYear.textContent = String(new Date().getFullYear());
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0
        }).format(Number(amount) || 0);
    }

    function formatDate(dateString) {
        if (!dateString) return "Not available";

        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
            String(dateString)
        );

        if (!match) return String(dateString);

        const [, year, month, day] = match;

        return new Date(Date.UTC(
            Number(year),
            Number(month) - 1,
            Number(day)
        )).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "UTC"
        });
    }

    function getTodayString() {
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(new Date());

        const values = {};

        parts.forEach(part => {
            if (part.type !== "literal") {
                values[part.type] = part.value;
            }
        });

        return `${values.year}-${values.month}-${values.day}`;
    }

    function calculateRentalDays(pickup, dropoff) {
        const start = Date.parse(`${pickup}T00:00:00Z`);
        const end = Date.parse(`${dropoff}T00:00:00Z`);

        if (!Number.isFinite(start) || !Number.isFinite(end)) {
            return 0;
        }

        return (end - start) / 86400000;
    }

    async function readJson(response) {
        return response.json().catch(() => ({}));
    }

    async function api(url, options = {}) {
        const headers = {
            Accept: "application/json",
            ...(options.body instanceof FormData
                ? {}
                : options.body
                    ? { "Content-Type": "application/json" }
                    : {}),
            ...(options.headers || {})
        };

        const response = await fetch(url, {
            credentials: "same-origin",
            ...options,
            headers
        });

        const data = await readJson(response);

        if (!response.ok) {
            throw new Error(
                data.error ||
                data.message ||
                "Something went wrong. Please try again."
            );
        }

        return data;
    }

    function showMessage(message, type = "info") {
        if (!bookingMessage) return;

        const colors = {
            info: "#62738e",
            success: "#16803c",
            error: "#c82029"
        };

        bookingMessage.textContent = message;
        bookingMessage.style.color = colors[type] || colors.info;
    }

    function clearMessage() {
        if (bookingMessage) {
            bookingMessage.textContent = "";
        }
    }

    function getInitials(name) {
        return String(name || "Drive Easy")
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(word => Array.from(word)[0] || "")
            .join("")
            .toUpperCase() || "DE";
    }

    /* ========================================
       LOGIN AND CURRENT USER
       ======================================== */

    async function getLoggedInUser() {
        try {
            const data = await api("/api/auth/me");
            currentUser = data.user || null;
            return currentUser;
        } catch (error) {
            currentUser = null;
            return null;
        }
    }

    /* ========================================
       DATE INPUTS
       ======================================== */

    function updateDateLimits() {
        const today = getTodayString();

        if (pickupInput) {
            pickupInput.min = today;

            if (pickupInput.value && pickupInput.value < today) {
                pickupInput.value = "";
            }
        }

        if (returnInput) {
            returnInput.min = pickupInput?.value || today;

            if (
                returnInput.value &&
                returnInput.value < returnInput.min
            ) {
                returnInput.value = "";
            }
        }
    }

    pickupInput?.addEventListener("change", () => {
        updateDateLimits();

        if (searchHasRun) {
            clearSearchResults();
        }
    });

    returnInput?.addEventListener("change", () => {
        updateDateLimits();

        if (searchHasRun) {
            clearSearchResults();
        }
    });

    updateDateLimits();

    /* ========================================
       CAR SEARCH AND FILTERING
       ======================================== */

    function updateCarCount(count) {
        if (!carCount) return;

        carCount.textContent =
            `${count} ${count === 1 ? "car" : "cars"} available`;
    }

    function getVisibleCars() {
        return carCards.filter(card => !card.hidden);
    }

    function applyCarFilter(type) {
        const selectedType = String(type || "all").toLowerCase();
        let visibleCount = 0;

        carCards.forEach(card => {
            const cardType = String(card.dataset.type || "").toLowerCase();

            const matches =
                selectedType === "all" ||
                cardType === selectedType;

            card.hidden = !matches;

            if (matches) visibleCount++;
        });

        updateCarCount(visibleCount);

        if (noCarsMessage) {
            noCarsMessage.hidden = visibleCount > 0;
        }
    }

    function clearSearchResults() {
        searchHasRun = false;

        if (carTypeInput) {
            carTypeInput.value = "all";
        }

        carCards.forEach(card => {
            card.hidden = false;
        });

        updateCarCount(carCards.length);

        if (noCarsMessage) {
            noCarsMessage.hidden = true;
        }

        clearMessage();
    }

    carTypeInput?.addEventListener("change", () => {
        if (searchHasRun) {
            applyCarFilter(carTypeInput.value);
        }
    });

    bookingForm?.addEventListener("submit", event => {
        event.preventDefault();

        if (!bookingForm.reportValidity()) return;

        const location = locationInput?.value;
        const pickup = pickupInput?.value;
        const dropoff = returnInput?.value;

        if (!location || !pickup || !dropoff) {
            showMessage(
                "Please select a location, pickup date, and return date.",
                "error"
            );
            return;
        }

        updateDateLimits();

        if (pickup < getTodayString()) {
            showMessage(
                "Pickup date cannot be in the past.",
                "error"
            );
            return;
        }

        if (dropoff <= pickup) {
            showMessage(
                "Return date must be after the pickup date.",
                "error"
            );
            return;
        }

        searchHasRun = true;

        applyCarFilter(carTypeInput?.value || "all");

        const count = getVisibleCars().length;

        showMessage(
            count
                ? `${count} car${count === 1 ? "" : "s"} match your selected category. Select Book Now to continue.`
                : "No cars match your selected category.",
            count ? "success" : "info"
        );

        $("#cars")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });

    viewAllButton?.addEventListener("click", () => {
        clearSearchResults();

        $("#cars")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });

      

/* AVAILABLE COUPONS — USE BUTTONS */
document.addEventListener("click", function (event) {
    const button = event.target.closest(".use-coupon-button");

   /* AVAILABLE COUPONS — USE BUTTONS */
document.addEventListener("click", function (event) {
    const button = event.target.closest(".use-coupon-button");

    if (!button) return;

    event.preventDefault();

    const code = String(button.dataset.coupon || "")
        .trim()
        .toUpperCase();

    if (!code) {
        showCouponMessage("Coupon code is missing.", "error");
        return;
    }

    if (!couponCodeInput || !applyCouponButton) {
        showCouponMessage(
            "Coupon input or Apply button is missing.",
            "error"
        );
        return;
    }

    couponCodeInput.value = code;

    applyCouponButton(`Coupon ${code} selected. Click Apply to use it.`,
    "success");
});

});


    /* ========================================
       COUPON HANDLING
       The server validates coupons and calculates
       the discount. Never trust browser prices.
       ======================================== */

function resetCoupon() {
    appliedCoupon = null;

    if (couponCodeInput) {
        couponCodeInput.value = "";
        couponCodeInput.disabled = false;
    }

    if (applyCouponButton) {
        applyCouponButton.disabled = false;
        applyCouponButton.textContent = "Apply";
    }

    if (couponMessage) {
        couponMessage.textContent = "";
        couponMessage.style.color = "";
    }

    if (priceBreakdown) {
        priceBreakdown.hidden = true;
    }
}

function showCouponMessage(message, type = "info") {
    if (!couponMessage) return;

    const colors = {
        info: "#62738e",
        success: "#16803c",
        error: "#c82029"
    };

    couponMessage.textContent = message;
    couponMessage.style.color = colors[type] || colors.info;
}

function renderPriceBreakdown(subtotal, discount, total) {
    if (
        !priceBreakdown ||
        !rentalSubtotalElement ||
        !couponDiscountElement ||
        !finalTotalElement
    ) {
        return;
    }

    rentalSubtotalElement.textContent = formatCurrency(subtotal);
    couponDiscountElement.textContent = `−${formatCurrency(discount)}`;
    finalTotalElement.textContent = formatCurrency(total);

    priceBreakdown.hidden = false;
}

// Apply, replace, or remove a coupon.
applyCouponButton?.addEventListener("click", async () => {
    if (couponSubmitting || bookingSubmitting) return;

    if (!selectedCar) {
        showCouponMessage("Select a car before applying a coupon.", "error");
        return;
    }

    const couponCode = couponCodeInput?.value.trim().toUpperCase() || "";

    // Empty input removes the current coupon.
    if (!couponCode) {
        appliedCoupon = null;

        if (priceBreakdown) {
            priceBreakdown.hidden = true;
        }

        if (applyCouponButton) {
            applyCouponButton.disabled = false;
            applyCouponButton.textContent = "Apply";
        }

        showCouponMessage("Coupon removed. No discount applied.", "info");
        return;
    }

    couponSubmitting = true;
    applyCouponButton.disabled = true;
    applyCouponButton.textContent = "Checking...";

    try {
        const result = await api("/api/coupons/validate", {
            method: "POST",
            body: JSON.stringify({
                couponCode,
                carName: selectedCar.carName,
                location: selectedCar.location,
                pickup: selectedCar.pickup,
                dropoff: selectedCar.dropoff
            })
        });

        const coupon = result.coupon;

        if (
            !coupon ||
            typeof coupon.discountAmount !== "number" ||
            typeof coupon.subtotal !== "number" ||
            typeof coupon.total !== "number" ||
            !Number.isFinite(coupon.discountAmount) ||
            !Number.isFinite(coupon.subtotal) ||
            !Number.isFinite(coupon.total) ||
            coupon.discountAmount < 0 ||
            coupon.subtotal < 0 ||
            coupon.total < 0 ||
            coupon.discountAmount > coupon.subtotal ||
            Math.abs(
                coupon.total - (coupon.subtotal - coupon.discountAmount)
            ) > 0.01
        ) {
            throw new Error("The server returned an invalid coupon response.");
        }

        appliedCoupon = {
            code: coupon.code || couponCode,
            discountAmount: coupon.discountAmount,
            subtotal: coupon.subtotal,
            total: coupon.total
        };

        renderPriceBreakdown(
            appliedCoupon.subtotal,
            appliedCoupon.discountAmount,
            appliedCoupon.total
        );

        showCouponMessage(
            `Coupon ${appliedCoupon.code} applied successfully! You can change it anytime.`,
            "success"
        );

        // Keep the input enabled so customers can change the code.
        couponCodeInput.disabled = false;
        applyCouponButton.disabled = false;
        applyCouponButton.textContent = "Apply";

    } catch (error) {
        // If a replacement coupon is invalid, don't keep the old discount.
        appliedCoupon = null;

        if (priceBreakdown) {
            priceBreakdown.hidden = true;
        }

        showCouponMessage(
            error.message || "Unable to apply this coupon.",
            "error"
        );

        if (couponCodeInput) {
            couponCodeInput.disabled = false;
        }

        applyCouponButton.disabled = false;
        applyCouponButton.textContent = "Apply";

    } finally {
        couponSubmitting = false;
    }
});

// Remove the applied discount as soon as the customer edits the code.
// They must click Apply to validate the replacement coupon.
couponCodeInput?.addEventListener("input", () => {
    if (!appliedCoupon) return;

    appliedCoupon = null;

    if (priceBreakdown) {
        priceBreakdown.hidden = true;
    }

    if (applyCouponButton) {
        applyCouponButton.textContent = "Apply";
    }

    showCouponMessage(
        "Coupon changed. Click Apply to check the new code.",
        "info"
    );
});


    // Reset the applied coupon if the customer edits the code.
    couponCodeInput?.addEventListener("input", () => {
        if (appliedCoupon) {
            resetCoupon();
        } else {
            showCouponMessage("");
        }
    });

    /* ========================================
       BOOKING REVIEW DIALOG
       Preserve the original CSS classes
       ======================================== */

    function renderBookingSummary(booking) {
        if (!bookingSummary) return;

        bookingSummary.replaceChildren();

        const rows = [
            ["Vehicle", booking.carName],
            ["Pick-up location", booking.location],
            ["Pick-up date", formatDate(booking.pickup)],
            ["Drop-off date", formatDate(booking.dropoff)],
            ["Rental duration", `${booking.days} day(s)`],
            ["Price per day", formatCurrency(booking.pricePerDay)],
            ["Estimated total", formatCurrency(booking.total)]
        ];

        rows.forEach(([heading, value], index) => {
            const row = document.createElement("div");

            row.className = index === rows.length - 1
                ? "summary-row summary-total"
                : "summary-row";

            const label = document.createElement("span");
            label.textContent = heading;

            const strong = document.createElement("strong");
            strong.textContent = value;

            row.append(label, strong);
            bookingSummary.appendChild(row);
        });
    }

    /* ========================================
       BOOK NOW
       ======================================== */

    $$(".book-button").forEach(button => {
        button.addEventListener("click", async () => {
            if (
                !locationInput?.value ||
                !pickupInput?.value ||
                !returnInput?.value
            ) {
                showMessage(
                    "Choose your location and rental dates first.",
                    "error"
                );

                $("#booking")?.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });

                locationInput?.focus();
                return;
            }

            updateDateLimits();

            const pickup = pickupInput.value;
            const dropoff = returnInput.value;

            if (
                pickup < getTodayString() ||
                dropoff <= pickup
            ) {
                showMessage(
                    "Please choose valid pickup and return dates.",
                    "error"
                );
                return;
            }

            const days = calculateRentalDays(pickup, dropoff);
            const carName = button.dataset.car;
            const previewPrice = Number(button.dataset.price);

            if (
                !carName ||
                !Number.isFinite(previewPrice) ||
                previewPrice <= 0 ||
                !Number.isInteger(days) ||
                days < 1 ||
                days > 90
            ) {
                showMessage(
                    "Please check the vehicle details and choose a rental period between 1 and 90 days.",
                    "error"
                );
                return;
            }

            // A new vehicle selection always starts with a clean coupon.
            resetCoupon();

            // This price is only a preview.
            // The backend calculates the actual booking price.
            selectedCar = {
                carName,
                location: locationInput.value,
                pickup,
                dropoff,
                days,
                pricePerDay: previewPrice,
                total: previewPrice * days
            };

            
renderBookingSummary(selectedCar);
clearMessage();

if (
    bookingDialog &&
    typeof bookingDialog.showModal === "function"
) {
    bookingDialog.showModal();

    // Apply a coupon selected from Available Coupons.
    
if (pendingCouponCode) {
    const codeToApply = pendingCouponCode;
    pendingCouponCode = "";

    if (couponCodeInput && applyCouponButton) {
        couponCodeInput.value = codeToApply;

        // Trigger the existing server-validation handler.
        applyCouponButton.click();
    } else {
        showCouponMessage(
            "Coupon input or Apply button is missing.",
            "error"
        );
    }
}

}  

    else {
    showMessage(
        "Your browser does not support the booking dialog.",
        "error"
    );
}

        });
    });

    dialogClose?.addEventListener("click", () => {
        if (bookingDialog?.open) {
            bookingDialog.close();
        }
    });

    bookingDialog?.addEventListener("click", event => {
        if (event.target === bookingDialog) {
            bookingDialog.close();
        }
    });

    bookingDialog?.addEventListener("close", () => {
        selectedCar = null;
        resetCoupon();
    });

    /* ========================================
       MY BOOKINGS — DATABASE
       ======================================== */

    function renderBookings(bookings) {
        if (!bookingsList) return;

        bookingsList.replaceChildren();

        if (!bookings.length) {
            const empty = document.createElement("p");
            empty.className = "bookings-message";
            empty.textContent = "You don't have any bookings yet.";

            const browseLink = document.createElement("a");
            browseLink.href = "./index.html#cars";
            browseLink.textContent = " Browse cars";

            empty.appendChild(browseLink);
            bookingsList.appendChild(empty);
            return;
        }

        bookings.forEach(booking => {
            const card = document.createElement("article");
            card.className = "demo-booking-card";

            const title = document.createElement("h3");
            title.textContent = booking.carName || "Car rental";

            const reference = document.createElement("p");
            reference.textContent =
                `Booking reference: ${booking.reference || "Unavailable"}`;

            const location = document.createElement("p");
            location.textContent =
                `Pickup location: ${booking.location || "Unavailable"}`;

            const dates = document.createElement("p");
            dates.textContent =
                `${formatDate(booking.pickup)} – ${formatDate(booking.dropoff)}`;

            const duration = document.createElement("p");
            duration.textContent =
                `Rental duration: ${Number(booking.days) || 0} day(s)`;

            const total = document.createElement("p");
            total.textContent =
                `Estimated total: ${formatCurrency(booking.total)}`;

            const status = document.createElement("p");
            const isCancelled = booking.status === "cancelled";

            status.className = isCancelled
                ? "booking-status cancelled"
                : "booking-status";

            status.textContent = isCancelled
                ? "Status: Cancelled"
                : "Status: Confirmed";

            card.append(
                title,
                reference,
                location,
                dates,
                duration,
                total,
                status
            );

            if (!isCancelled) {
                const cancelButton = document.createElement("button");

                cancelButton.type = "button";
                cancelButton.className = "cancel-booking-button";
                cancelButton.textContent = "Cancel Booking";

                cancelButton.addEventListener("click", async () => {
                    const confirmed = window.confirm(
                        `Are you sure you want to cancel booking ${booking.reference}?`
                    );

                    if (!confirmed) return;

                    cancelButton.disabled = true;
                    cancelButton.textContent = "Cancelling...";

                    try {
                        const result = await api(
                            `/api/bookings/${encodeURIComponent(booking.id)}/cancel`,
                            {
                                method: "PATCH",
                                body: "{}"
                            }
                        );

                        window.alert(
                            result.message || "Your booking has been cancelled."
                        );

                        await loadBookings();
                    } catch (error) {
                        window.alert(
                            error.message || "Unable to cancel this booking."
                        );

                        cancelButton.disabled = false;
                        cancelButton.textContent = "Cancel Booking";
                    }
                });

                card.appendChild(cancelButton);
            }

            bookingsList.appendChild(card);
        });
    }

    async function loadBookings() {
        if (!bookingsList) return;

        bookingsList.replaceChildren();

        const loading = document.createElement("p");
        loading.className = "bookings-message";
        loading.textContent = "Loading your bookings...";

        bookingsList.appendChild(loading);

        try {
            const user = await getLoggedInUser();

            if (!user) {
                bookingsList.replaceChildren();

                const message = document.createElement("p");
                message.className = "bookings-message";
                message.append("Please log in to view your bookings. ");

                const loginLink = document.createElement("a");
                loginLink.href = "./login.html?returnTo=%2Fmy-bookings.html";
                loginLink.textContent = "Log in";

                message.appendChild(loginLink);
                bookingsList.appendChild(message);

                if (clearBookingsButton) {
                    clearBookingsButton.hidden = true;
                }

                return;
            }

            const result = await api("/api/bookings");

            if (clearBookingsButton) {
                clearBookingsButton.hidden = true;
            }

            renderBookings(
                Array.isArray(result.bookings) ? result.bookings : []
            );
        } catch (error) {
            console.error("Could not load bookings:", error);

            bookingsList.replaceChildren();

            const message = document.createElement("p");
            message.className = "bookings-message";
            message.textContent =
                error.message || "Unable to load your bookings. Please refresh.";

            bookingsList.appendChild(message);
        }
    }

    /* ========================================
       CONFIRM BOOKING
       Save through the backend, then open
       the separate My Bookings page.
       ======================================== */

    confirmBookingButton?.addEventListener("click", async () => {
        if (bookingSubmitting) return;

        if (!selectedCar) {
            showMessage(
                "Please select a car before confirming.",
                "error"
            );

            if (bookingDialog?.open) {
                bookingDialog.close();
            }

            return;
        }

        bookingSubmitting = true;
        confirmBookingButton.disabled = true;
        confirmBookingButton.textContent = "Confirming...";

        if (applyCouponButton) {
            applyCouponButton.disabled = true;
        }

        try {
            const user = await getLoggedInUser();

            if (!user) {
                if (bookingDialog?.open) {
                    bookingDialog.close();
                }

                const returnTo = encodeURIComponent(
                    "/index.html#cars"
                );

                window.location.href =
                    `./login.html?returnTo=${returnTo}`;

                return;
            }

            // Recheck the dates before submitting.
            if (
                selectedCar.pickup < getTodayString() ||
                selectedCar.dropoff <= selectedCar.pickup
            ) {
                throw new Error(
                    "Your selected dates are no longer valid. Please choose new dates."
                );
            }

            const result = await api("/api/bookings", {
                method: "POST",
                body: JSON.stringify({
                    carName: selectedCar.carName,
                    location: selectedCar.location,
                    pickup: selectedCar.pickup,
                    dropoff: selectedCar.dropoff,

                    // The backend must validate this coupon again.
                    couponCode: appliedCoupon?.code || null
                })
            });

            if (!result.booking || !result.booking.reference) {
                throw new Error(
                    "The server did not return a booking confirmation. Please check My Bookings before trying again."
                );
            }

            const reference = result.booking.reference;
            const total = result.booking.total;

            selectedCar = null;
            appliedCoupon = null;

            if (bookingDialog?.open) {
                bookingDialog.close();
            }

            // Show the reference, then open the dedicated page.
            window.alert(
                `Booking saved successfully!\n\n` +
                `Reference: ${reference}\n` +
                `Estimated total: ${formatCurrency(total)}\n\n` +
                `Opening My Bookings...`
            );

            window.location.href = "./my-bookings.html";
        } catch (error) {
            console.error("Booking submission error:", error);

            window.alert(
                error.message ||
                "Unable to create your booking. Please try again."
            );
        } finally {
            bookingSubmitting = false;

            if (confirmBookingButton) {
                confirmBookingButton.disabled = false;
                confirmBookingButton.textContent = "Confirm Booking";
            }

            if (applyCouponButton && !appliedCoupon) {
                applyCouponButton.disabled = false;
            }
        }
    });

    // Never delete database bookings in bulk.
    clearBookingsButton?.addEventListener("click", () => {
        window.alert(
            "Bookings cannot be deleted in bulk. Use Cancel Booking to cancel an individual reservation."
        );
    });

    /* ========================================
       MOBILE NAVIGATION
       ======================================== */

    if (menuToggle && navLinks) {
        menuToggle.addEventListener("click", () => {
            const isOpen = navLinks.classList.toggle("open");

            menuToggle.setAttribute("aria-expanded", String(isOpen));
            menuToggle.setAttribute(
                "aria-label",
                isOpen ? "Close navigation" : "Open navigation"
            );

            menuToggle.textContent = isOpen ? "×" : "☰";
        });

        navLinks.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", () => {
                navLinks.classList.remove("open");
                menuToggle.setAttribute("aria-expanded", "false");
                menuToggle.setAttribute("aria-label", "Open navigation");
                menuToggle.textContent = "☰";
            });
        });
    }

    $$('a[href="#home"]').forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

            navLinks?.classList.remove("open");
            menuToggle?.setAttribute("aria-expanded", "false");

            if (menuToggle) {
                menuToggle.textContent = "☰";
            }
        });
    });

    /* ========================================
       PROFILE MENU
       ======================================== */

    function renderAvatar(element, user) {
        if (!element) return;

        element.replaceChildren();

        const name = user?.name || "Drive Easy";

        if (!user?.profilePhoto) {
            element.textContent = getInitials(name);
            return;
        }

        const image = document.createElement("img");
        image.src = user.profilePhoto;
        image.alt = `${name}'s profile photo`;

        image.addEventListener("error", () => {
            element.textContent = getInitials(name);
        }, { once: true });

        element.appendChild(image);
    }

    function setProfileFeedback(message, isError = false) {
        if (!profileFeedback) return;

        profileFeedback.textContent = message;
        profileFeedback.style.color = isError
            ? "#c81e2b"
            : "#475569";
    }

    function closeProfileDropdown() {
        if (profileDropdown) {
            profileDropdown.hidden = true;
        }

        profileTrigger?.setAttribute("aria-expanded", "false");
    }

    function openProfileDropdown() {
        if (profileDropdown) {
            profileDropdown.hidden = false;
        }

        profileTrigger?.setAttribute("aria-expanded", "true");
    }

    function renderProfile(user) {
        currentUser = user || null;

        if (loggedOutActions) {
            loggedOutActions.hidden = Boolean(currentUser);
        }

        if (profileMenu) {
            profileMenu.hidden = !currentUser;
        }

        if (!currentUser) {
            closeProfileDropdown();
            return;
        }

        if (navName) {
            navName.textContent = currentUser.name || "Drive Easy";
        }

        if (dropdownName) {
            dropdownName.textContent = currentUser.name || "Drive Easy";
        }

        if (dropdownEmail) {
            dropdownEmail.textContent = currentUser.email || "";
        }

        renderAvatar(navAvatar, currentUser);
        renderAvatar(dropdownAvatar, currentUser);
    }

    async function loadProfile() {
        try {
            const user = await getLoggedInUser();
            renderProfile(user);
        } catch (error) {
            console.error("Profile loading error:", error);
            renderProfile(null);
        }
    }

    profileTrigger?.addEventListener("click", () => {
        if (!profileDropdown) return;

        if (profileDropdown.hidden) {
            openProfileDropdown();
        } else {
            closeProfileDropdown();
        }
    });

    document.addEventListener("click", event => {
        if (
            profileMenu &&
            profileDropdown &&
            !profileMenu.contains(event.target)
        ) {
            closeProfileDropdown();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeProfileDropdown();
        }
    });

    /* ========================================
       EDIT PROFILE
       ======================================== */

    function closeProfileEditor() {
        if (profileEditDialog?.open) {
            profileEditDialog.close();
        }
    }

    profileEditClose?.addEventListener("click", closeProfileEditor);
    profileEditCancel?.addEventListener("click", closeProfileEditor);

    profileEditDialog?.addEventListener("click", event => {
        if (event.target === profileEditDialog) {
            closeProfileEditor();
        }
    });

    profileEditForm?.addEventListener("submit", async event => {
        event.preventDefault();

        if (!profileEditName || !profileEditEmail) return;

        const name = profileEditName.value.trim();
        const email = profileEditEmail.value.trim();

        if (name.length < 2 || name.length > 100) {
            if (profileEditMessage) {
                profileEditMessage.textContent =
                    "Your name must be between 2 and 100 characters.";
            }
            return;
        }

        if (!profileEditForm.reportValidity()) return;

        if (profileEditSave) {
            profileEditSave.disabled = true;
            profileEditSave.textContent = "Saving...";
        }

        if (profileEditMessage) {
            profileEditMessage.textContent = "Saving your changes...";
        }

        try {
            const result = await api("/api/auth/profile", {
                method: "PATCH",
                body: JSON.stringify({ name, email })
            });

            if (!result.user) {
                throw new Error(
                    "The server did not return your updated profile."
                );
            }

            renderProfile(result.user);

            if (profileEditMessage) {
                profileEditMessage.textContent =
                    "Profile updated successfully.";
            }

            closeProfileEditor();
            openProfileDropdown();

            setProfileFeedback("Your profile has been updated.");
        } catch (error) {
            console.error("Profile update error:", error);

            if (profileEditMessage) {
                profileEditMessage.textContent =
                    error.message || "Unable to update your profile.";
            }
        } finally {
            if (profileEditSave) {
                profileEditSave.disabled = false;
                profileEditSave.textContent = "Save Changes";
            }
        }
    });

    /* ========================================
       PROFILE PHOTO UPLOAD
       ======================================== */

    changePhotoButton?.addEventListener("click", () => {
        photoInput?.click();
    });

    photoInput?.addEventListener("change", async () => {
        const file = photoInput.files?.[0];

        if (!file) return;

        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            setProfileFeedback(
                "Choose a JPG, PNG, or WebP image.",
                true
            );

            photoInput.value = "";
            return;
        }

        if (file.size > 3 * 1024 * 1024) {
            setProfileFeedback(
                "Your photo must be 3 MB or smaller.",
                true
            );

            photoInput.value = "";
            return;
        }

        const formData = new FormData();
        formData.append("photo", file);

        if (changePhotoButton) {
            changePhotoButton.disabled = true;
        }

        setProfileFeedback("Uploading your profile photo...");

        try {
            const result = await api("/api/auth/profile-photo", {
                method: "POST",
                body: formData
            });

            if (result.user) {
                renderProfile(result.user);
            } else {
                await loadProfile();
            }

            setProfileFeedback("Profile photo updated successfully.");
        } catch (error) {
            console.error("Photo upload error:", error);

            setProfileFeedback(
                error.message || "Unable to upload your photo.",
                true
            );
        } finally {
            if (changePhotoButton) {
                changePhotoButton.disabled = false;
            }

            photoInput.value = "";
        }
    });

    /* ========================================
       PROFILE MENU ACTIONS
       ======================================== */

    $$("[data-profile-action]").forEach(button => {
        button.addEventListener("click", () => {
            const action = button.dataset.profileAction;

            closeProfileDropdown();

            if (action === "my-profile") {
                if (!currentUser) {
                    setProfileFeedback(
                        "Please log in to edit your profile.",
                        true
                    );
                    return;
                }

                if (
                    !profileEditDialog ||
                    !profileEditName ||
                    !profileEditEmail
                ) {
                    setProfileFeedback(
                        "The profile editor is not available on this page.",
                        true
                    );
                    return;
                }

                profileEditName.value = currentUser.name || "";
                profileEditEmail.value = currentUser.email || "";

                if (profileEditMessage) {
                    profileEditMessage.textContent = "";
                }

                if (typeof profileEditDialog.showModal === "function") {
                    profileEditDialog.showModal();
                    profileEditName.focus();
                }

                return;
            }

            if (action === "bookings") {
                window.location.href = "./my-bookings.html";
                return;
            }

            if (action === "saved-cars") {
                window.alert("Saved Cars is not available yet.");
                return;
            }

            if (action === "settings") {
                window.alert("Account Settings are not available yet.");
            }
        });
    });

    /* ========================================
       LOG OUT
       ======================================== */

    logoutButton?.addEventListener("click", async () => {
        logoutButton.disabled = true;
        logoutButton.textContent = "Logging out...";

        try {
            await api("/api/auth/logout", {
                method: "POST",
                body: "{}"
            });

            currentUser = null;
            renderProfile(null);

            window.location.href = "./index.html";
        } catch (error) {
            console.error("Logout error:", error);

            setProfileFeedback(
                error.message || "Unable to log out.",
                true
            );

            logoutButton.disabled = false;
            logoutButton.textContent = "↪ Log Out";
        }
    });

    /* ========================================
       INITIALIZE
       ======================================== */

    clearSearchResults();

    // On index.html, this updates the profile menu.
    loadProfile();

    // On my-bookings.html, load the signed-in
    // customer's bookings from the backend.
    if (bookingsList) {
        loadBookings();
    }
});