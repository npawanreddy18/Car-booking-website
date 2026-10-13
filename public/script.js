
"use strict";

/* ========================================
   DRIVE EASY — WEBSITE FUNCTIONALITY
   ======================================== */

const bookingForm = document.getElementById("booking-form");
const locationInput = document.getElementById("location");
const pickupInput = document.getElementById("pickup");
const returnInput = document.getElementById("return");
const carTypeInput = document.getElementById("car-type");

const bookingMessage = document.getElementById("booking-message");
const carCount = document.getElementById("car-count");
const carCards = Array.from(document.querySelectorAll(".car-card"));
const noCarsMessage = document.getElementById("no-cars");
const viewAllButton = document.getElementById("view-all");

const menuToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");

const bookingDialog = document.getElementById("booking-dialog");
const bookingSummary = document.getElementById("booking-summary");
const dialogClose = document.getElementById("dialog-close");
const confirmBookingButton = document.getElementById("confirm-demo");

const bookingsList = document.getElementById("demo-bookings-list");
const clearBookingsButton = document.getElementById("clear-demo-bookings");

let searchHasRun = false;
let selectedCar = null;
let bookingSubmitting = false;
let loggedInUser = null;

/* ========================================
   GENERAL HELPERS
   ======================================== */

const currentYear = document.getElementById("current-year");

if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}

function getTodayString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

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
        if (returnInput.value && returnInput.value < returnInput.min) {
            returnInput.value = "";
        }
    }
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
    if (bookingMessage) bookingMessage.textContent = "";
}

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(amount);
}

function formatDate(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function calculateRentalDays(pickup, dropoff) {
    return Math.round(
        (Date.parse(`${dropoff}T00:00:00`) -
         Date.parse(`${pickup}T00:00:00`)) / 86400000
    );
}

async function readJson(response) {
    return response.json().catch(() => ({}));
}

async function getLoggedInUser() {
    try {
        const response = await fetch("/api/auth/me", {
            credentials: "same-origin",
            headers: { Accept: "application/json" }
        });

        if (!response.ok) {
            loggedInUser = null;
            return null;
        }

        const result = await readJson(response);
        loggedInUser = result.user || null;
        return loggedInUser;
    } catch (error) {
        console.error("Could not check login:", error);
        loggedInUser = null;
        return null;
    }
}

/* ========================================
   DATE INPUTS
   ======================================== */

pickupInput?.addEventListener("change", () => {
    updateDateLimits();
    if (searchHasRun) clearSearchResults();
});

returnInput?.addEventListener("change", () => {
    updateDateLimits();
    if (searchHasRun) clearSearchResults();
});

updateDateLimits();

/* ========================================
   CAR FILTERING AND SEARCH
   ======================================== */

function getVisibleCars() {
    return carCards.filter(card => !card.hidden);
}

function updateCarCount(count) {
    if (carCount) {
        carCount.textContent = `${count} ${count === 1 ? "car" : "cars"} available`;
    }
}

function applyCarFilter(type) {
    let visibleCount = 0;

    carCards.forEach(card => {
        const matches = type === "all" || card.dataset.type === type;
        card.hidden = !matches;
        if (matches) visibleCount++;
    });

    updateCarCount(visibleCount);

    if (noCarsMessage) noCarsMessage.hidden = visibleCount !== 0;
}

function clearSearchResults() {
    searchHasRun = false;
    carCards.forEach(card => { card.hidden = false; });
    updateCarCount(carCards.length);
    if (noCarsMessage) noCarsMessage.hidden = true;
    clearMessage();
}

carTypeInput?.addEventListener("change", () => {
    if (searchHasRun) applyCarFilter(carTypeInput.value);
});

bookingForm?.addEventListener("submit", event => {
    event.preventDefault();

    const location = locationInput?.value;
    const pickup = pickupInput?.value;
    const dropoff = returnInput?.value;

    if (!location || !pickup || !dropoff) {
        showMessage("Please select a location, pickup date, and return date.", "error");
        return;
    }

    if (pickup < getTodayString()) {
        showMessage("Pickup date cannot be in the past.", "error");
        return;
    }

    if (dropoff <= pickup) {
        showMessage("Return date must be after the pickup date.", "error");
        return;
    }

    searchHasRun = true;
    applyCarFilter(carTypeInput?.value || "all");

    const count = getVisibleCars().length;

    showMessage(
        count
            ? `${count} car${count === 1 ? "" : "s"} match your selected category. Availability will be checked when you confirm a reservation.`
            : "No cars match your selected category.",
        count ? "success" : "info"
    );

    document.getElementById("cars")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

viewAllButton?.addEventListener("click", () => {
    if (carTypeInput) carTypeInput.value = "all";
    clearSearchResults();

    document.getElementById("cars")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

/* ========================================
   BOOKING SUMMARY
   ======================================== */

function renderBookingSummary(booking) {
    if (!bookingSummary) return;

    bookingSummary.replaceChildren();

    const rows = [
        ["Vehicle", booking.carName],
        ["Pickup location", booking.location],
        ["Pickup date", formatDate(booking.pickup)],
        ["Return date", formatDate(booking.dropoff)],
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

document.querySelectorAll(".book-button").forEach(button => {
    button.addEventListener("click", async () => {
        if (!locationInput?.value || !pickupInput?.value || !returnInput?.value) {
            showMessage("Choose your location and dates in the booking form first.", "error");
            document.getElementById("booking")?.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
            locationInput?.focus();
            return;
        }

        updateDateLimits();

        if (pickupInput.value < getTodayString() ||
            returnInput.value <= pickupInput.value) {
            showMessage("Please choose valid pickup and return dates.", "error");
            return;
        }

        const carCard = button.closest(".car-card");
        const carName = button.dataset.car;
        const days = calculateRentalDays(pickupInput.value, returnInput.value);

        // This amount is only for the preview. The server calculates the
        // authoritative price when the booking is submitted.
        const previewPrice = Number(button.dataset.price);

        if (!carCard || !carName || !Number.isFinite(previewPrice) || days <= 0) {
            showMessage("We could not calculate this booking. Please check your dates.", "error");
            return;
        }

        selectedCar = {
            carName,
            location: locationInput.value,
            pickup: pickupInput.value,
            dropoff: returnInput.value,
            days,
            pricePerDay: previewPrice,
            total: previewPrice * days
        };

        renderBookingSummary(selectedCar);
        clearMessage();

        if (bookingDialog && typeof bookingDialog.showModal === "function") {
            bookingDialog.showModal();
        } else {
            showMessage("Your browser does not support the booking dialog.", "error");
        }
    });
});

/* ========================================
   REAL DATABASE BOOKINGS
   ======================================== */

function renderBookings(bookings) {
    if (!bookingsList) return;

    bookingsList.replaceChildren();

    if (!bookings.length) {
        const empty = document.createElement("p");
        empty.textContent = "You don't have any bookings yet.";
        bookingsList.appendChild(empty);
        return;
    }

    bookings.forEach(booking => {
        const card = document.createElement("article");
        card.className = "demo-booking-card";

        const title = document.createElement("h3");
        title.textContent = booking.carName;

        const reference = document.createElement("p");
        reference.textContent = `Booking reference: ${booking.reference}`;

        const location = document.createElement("p");
        location.textContent = `Pickup location: ${booking.location}`;

        const dates = document.createElement("p");
        dates.textContent = `${formatDate(booking.pickup)} – ${formatDate(booking.dropoff)}`;

        const duration = document.createElement("p");
        duration.textContent = `Rental duration: ${booking.days} day(s)`;

        const total = document.createElement("p");
        total.textContent = `Total price: ${formatCurrency(booking.total)}`;

        const status = document.createElement("p");
        status.textContent = `Status: ${booking.status === "cancelled" ? "Cancelled" : "Confirmed"}`;

        card.append(title, reference, location, dates, duration, total, status);

        if (booking.status !== "cancelled") {
            const cancelButton = document.createElement("button");
            cancelButton.type = "button";
            cancelButton.className = "cancel-booking-button";
            cancelButton.textContent = "Cancel Booking";

            cancelButton.addEventListener("click", async () => {
                const confirmed = window.confirm(
                    `Cancel booking ${booking.reference}?`
                );
                if (!confirmed) return;

                cancelButton.disabled = true;
                cancelButton.textContent = "Cancelling...";

                try {
                    const response = await fetch(
                        `/api/bookings/${encodeURIComponent(booking.id)}/cancel`,
                        {
                            method: "PATCH",
                            credentials: "same-origin",
                            headers: { Accept: "application/json" }
                        }
                    );

                    const result = await readJson(response);
                    if (!response.ok) {
                        throw new Error(result.message || "Unable to cancel booking.");
                    }

                    showMessage("Booking cancelled successfully.", "success");
                    await loadBookings();
                } catch (error) {
                    showMessage(error.message || "Unable to cancel booking.", "error");
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

    const user = await getLoggedInUser();

    if (!user) {
        bookingsList.replaceChildren();
        const message = document.createElement("p");
        message.textContent = "Please log in to view your bookings.";
        bookingsList.appendChild(message);

        if (clearBookingsButton) clearBookingsButton.hidden = true;
        return;
    }

    if (clearBookingsButton) clearBookingsButton.hidden = true;

    try {
        const response = await fetch("/api/bookings", {
            credentials: "same-origin",
            headers: { Accept: "application/json" }
        });

        const result = await readJson(response);

        if (!response.ok) {
            throw new Error(result.message || "Unable to load your bookings.");
        }

        renderBookings(Array.isArray(result.bookings) ? result.bookings : []);
    } catch (error) {
        console.error("Load bookings error:", error);
        bookingsList.replaceChildren();

        const message = document.createElement("p");
        message.textContent = error.message || "Unable to load bookings. Please refresh.";
        bookingsList.appendChild(message);
    }
}

confirmBookingButton?.addEventListener("click", async () => {
    if (bookingSubmitting) return;

    if (!selectedCar) {
        showMessage("Please select a car before confirming.", "error");
        if (bookingDialog?.open) bookingDialog.close();
        return;
    }

    const user = await getLoggedInUser();

    if (!user) {
        showMessage("Please log in before making a booking.", "error");
        if (bookingDialog?.open) bookingDialog.close();
        window.location.href = "/login.html";
        return;
    }

    bookingSubmitting = true;
    confirmBookingButton.disabled = true;
    confirmBookingButton.textContent = "Confirming...";

    try {
        const response = await fetch("/api/bookings", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body: JSON.stringify({
                carName: selectedCar.carName,
                location: selectedCar.location,
                pickup: selectedCar.pickup,
                dropoff: selectedCar.dropoff
            })
        });

        const result = await readJson(response);

        if (!response.ok) {
            throw new Error(result.message || "Unable to create booking.");
        }

        selectedCar = null;

        if (bookingDialog?.open) bookingDialog.close();

        showMessage(
            `Reservation saved successfully. Reference: ${result.booking.reference}`,
            "success"
        );

        await loadBookings();

        document.getElementById("demo-bookings")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    } catch (error) {
        console.error("Booking submission error:", error);
        showMessage(error.message || "Unable to create booking. Please try again.", "error");
    } finally {
        bookingSubmitting = false;
        confirmBookingButton.disabled = false;
        confirmBookingButton.textContent = "Confirm Booking";
    }
});

// The old clear button must never delete database bookings in bulk.
clearBookingsButton?.addEventListener("click", () => {
    showMessage("Bookings cannot be deleted in bulk. Use Cancel Booking for an individual reservation.", "info");
});

dialogClose?.addEventListener("click", () => {
    bookingDialog?.close();
});

bookingDialog?.addEventListener("click", event => {
    if (event.target === bookingDialog) bookingDialog.close();
});

bookingDialog?.addEventListener("close", () => {
    selectedCar = null;
});

/* ========================================
   MOBILE NAVIGATION
   ======================================== */

if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
        const isOpen = navLinks.classList.toggle("open");
        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
        menuToggle.textContent = isOpen ? "×" : "☰";
    });

    navLinks.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            navLinks.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Open navigation");
            menuToggle.textContent = "☰";

            navLinks.querySelectorAll("a").forEach(item => item.classList.remove("active"));
            link.classList.add("active");
        });
    });
}

clearSearchResults();
loadBookings();

document.querySelectorAll('a[href="#home"]').forEach(link => {
    link.addEventListener("click", event => {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });

        if (navLinks && menuToggle) {
            navLinks.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Open navigation");
            menuToggle.textContent = "☰";
        }
    });
});

/* ========================================
   DRIVE EASY — LOGGED-IN PROFILE
   ======================================== */

document.addEventListener("DOMContentLoaded", () => {
    const loggedOutActions = document.getElementById("logged-out-actions");
    const profileMenu = document.getElementById("profile-menu");
    const profileTrigger = document.getElementById("profile-trigger");
    const profileDropdown = document.getElementById("profile-dropdown");

    const navAvatar = document.getElementById("nav-avatar");
    const dropdownAvatar = document.getElementById("dropdown-avatar");
    const navName = document.getElementById("nav-profile-name");
    const dropdownName = document.getElementById("dropdown-name");
    const dropdownEmail = document.getElementById("dropdown-email");

    const photoInput = document.getElementById("profile-photo-input");
    const changePhotoButton = document.getElementById("change-profile-photo");
    const feedback = document.getElementById("profile-feedback");
    const logoutButton = document.getElementById("profile-logout");

    const profileEditDialog = document.getElementById("profile-edit-dialog");
    const profileEditForm = document.getElementById("profile-edit-form");
    const profileEditName = document.getElementById("profile-edit-name");
    const profileEditEmail = document.getElementById("profile-edit-email");
    const profileEditMessage = document.getElementById("profile-edit-message");
    const profileEditSave = document.getElementById("profile-edit-save");
    const profileEditClose = document.getElementById("profile-edit-close");
    const profileEditCancel = document.getElementById("profile-edit-cancel");

    if (!loggedOutActions || !profileMenu || !profileTrigger || !profileDropdown) {
        return;
    }

    let currentUser = null;

    function getInitials(name) {
        const words = String(name || "Drive Easy").trim().split(/\s+/).filter(Boolean);
        return words.slice(0, 2).map(word => Array.from(word)[0]).join("").toUpperCase() || "DE";
    }

    function renderAvatar(element, name, photoUrl) {
        if (!element) return;

        element.replaceChildren();
        element.textContent = getInitials(name);
        if (!photoUrl) return;

        const image = document.createElement("img");
        image.alt = "Profile photo";
        image.src = photoUrl;
        image.addEventListener("error", () => {
            image.remove();
            element.textContent = getInitials(name);
        }, { once: true });

        element.textContent = "";
        element.appendChild(image);
    }

    function setFeedback(message, isError = false) {
        if (!feedback) return;
        feedback.textContent = message;
        feedback.style.color = isError ? "#c81e2b" : "#475569";
    }

    function closeDropdown() {
        profileDropdown.hidden = true;
        profileTrigger.setAttribute("aria-expanded", "false");
    }

    function openDropdown() {
        profileDropdown.hidden = false;
        profileTrigger.setAttribute("aria-expanded", "true");
    }

    function renderUser(user) {
        currentUser = user;
        loggedOutActions.hidden = Boolean(user);
        profileMenu.hidden = !user;

        if (!user) {
            closeDropdown();
            return;
        }

        const name = user.name || "Drive Easy Member";
        if (navName) navName.textContent = name;
        if (dropdownName) dropdownName.textContent = name;
        if (dropdownEmail) dropdownEmail.textContent = user.email || "";

        renderAvatar(navAvatar, name, user.profilePhoto || "");
        renderAvatar(dropdownAvatar, name, user.profilePhoto || "");
    }

    async function loadCurrentUser() {
        try {
            const response = await fetch("/api/auth/me", {
                credentials: "same-origin",
                headers: { Accept: "application/json" }
            });

            if (response.status === 401) {
                renderUser(null);
                return null;
            }

            const result = await readJson(response);
            if (!response.ok) throw new Error(result.message || "Could not load your account.");

            renderUser(result.user || null);
            return result.user || null;
        } catch (error) {
            console.error("Profile loading error:", error);
            setFeedback("Unable to load your profile. Please refresh the page.", true);
            return null;
        }
    }

    profileTrigger.addEventListener("click", () => {
        profileDropdown.hidden ? openDropdown() : closeDropdown();
    });

    document.addEventListener("click", event => {
        if (!profileMenu.hidden && !profileMenu.contains(event.target)) closeDropdown();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeDropdown();
    });

    changePhotoButton?.addEventListener("click", () => photoInput?.click());

    photoInput?.addEventListener("change", async () => {
        const file = photoInput.files?.[0];
        if (!file) return;

        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            setFeedback("Choose a JPG, PNG, or WebP image.", true);
            photoInput.value = "";
            return;
        }

        if (file.size > 3 * 1024 * 1024) {
            setFeedback("Your photo must be 3 MB or smaller.", true);
            photoInput.value = "";
            return;
        }

        const formData = new FormData();
        formData.append("photo", file);
        if (changePhotoButton) changePhotoButton.disabled = true;
        setFeedback("Uploading your profile photo...");

        try {
            const response = await fetch("/api/auth/profile-photo", {
                method: "POST",
                credentials: "same-origin",
                body: formData
            });

            const result = await readJson(response);
            if (!response.ok) throw new Error(result.message || "Unable to upload your photo.");

            await loadCurrentUser();
            setFeedback("Your profile photo has been updated.");
        } catch (error) {
            console.error("Photo upload error:", error);
            setFeedback(error.message || "Photo upload failed.", true);
        } finally {
            if (changePhotoButton) changePhotoButton.disabled = false;
            photoInput.value = "";
        }
    });

    function closeProfileEditor() {
        if (profileEditDialog?.open) profileEditDialog.close();
    }

    profileEditClose?.addEventListener("click", closeProfileEditor);
    profileEditCancel?.addEventListener("click", closeProfileEditor);

    profileEditDialog?.addEventListener("click", event => {
        if (event.target === profileEditDialog) closeProfileEditor();
    });

    document.querySelectorAll("[data-profile-action]").forEach(button => {
        button.addEventListener("click", () => {
            const action = button.dataset.profileAction;
            closeDropdown();

            if (action === "my-profile") {
                if (!currentUser) {
                    setFeedback("Please log in to edit your profile.", true);
                    return;
                }

                if (!profileEditDialog || !profileEditName || !profileEditEmail || !profileEditForm) {
                    setFeedback("The profile editor HTML is missing. Check index.html.", true);
                    return;
                }

                profileEditName.value = currentUser.name || "";
                profileEditEmail.value = currentUser.email || "";
                if (profileEditMessage) profileEditMessage.textContent = "";

                if (typeof profileEditDialog.showModal === "function") {
                    profileEditDialog.showModal();
                    profileEditName.focus();
                } else {
                    setFeedback("Your browser does not support the profile editor.", true);
                }
                return;
            }

            if (action === "bookings") {
                document.getElementById("demo-bookings")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
                loadBookings();
                return;
            }

            if (action === "saved-cars") {
                window.alert("Saved Cars is not implemented yet.");
            }

            if (action === "settings") {
                window.alert("Account Settings is not implemented yet.");
            }
        });
    });

    profileEditForm?.addEventListener("submit", async event => {
        event.preventDefault();

        if (!currentUser || !profileEditName || !profileEditEmail) {
            if (profileEditMessage) profileEditMessage.textContent = "Please log in again.";
            return;
        }

        const name = profileEditName.value.trim();
        const email = profileEditEmail.value.trim();

        if (name.length < 2 || name.length > 100) {
            if (profileEditMessage) {
                profileEditMessage.textContent = "Your name must be between 2 and 100 characters.";
            }
            return;
        }

        if (!profileEditForm.reportValidity()) return;

        if (profileEditSave) {
            profileEditSave.disabled = true;
            profileEditSave.textContent = "Saving...";
        }

        if (profileEditMessage) profileEditMessage.textContent = "Saving your changes...";

        try {
            const response = await fetch("/api/auth/profile", {
                method: "PATCH",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify({ name, email })
            });

            const result = await readJson(response);
            if (!response.ok) throw new Error(result.message || "Unable to update your profile.");
            if (!result.user) throw new Error("The server did not return the updated profile.");

            renderUser(result.user);
            if (profileEditMessage) profileEditMessage.textContent = "Profile saved successfully.";

            closeProfileEditor();
            openDropdown();
            setFeedback("Your profile details have been updated.");
        } catch (error) {
            console.error("Profile update error:", error);
            if (profileEditMessage) {
                profileEditMessage.textContent = error.message || "Unable to save your profile.";
            }
        } finally {
            if (profileEditSave) {
                profileEditSave.disabled = false;
                profileEditSave.textContent = "Save Changes";
            }
        }
    });

    logoutButton?.addEventListener("click", async () => {
        logoutButton.disabled = true;
        logoutButton.textContent = "Logging out...";

        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin",
                headers: { Accept: "application/json" }
            });

            const result = await readJson(response);
            if (!response.ok) throw new Error(result.message || "Logout failed.");

            renderUser(null);
            window.location.href = "/";
        } catch (error) {
            console.error("Logout error:", error);
            setFeedback(error.message || "Unable to log out.", true);
            logoutButton.disabled = false;
            logoutButton.textContent = "↪ Log Out";
        }
    });

    loadCurrentUser();
});