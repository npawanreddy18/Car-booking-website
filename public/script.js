"use strict";

/* ========================================
   DRIVE EASY — WEBSITE FUNCTIONALITY
   ======================================== */

/* 1. GET HTML ELEMENTS */

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
const confirmDemoButton = document.getElementById("confirm-demo");

const demoBookingsList = document.getElementById("demo-bookings-list");
const clearDemoBookingsButton =
    document.getElementById("clear-demo-bookings");

const STORAGE_KEY = "driveEasyDemoBookings";

let searchHasRun = false;
let selectedCar = null;


/* 2. INITIALIZE WEBSITE */

const currentYear = document.getElementById("current-year");

if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}


/* 3. DATE HELPERS */

function getTodayString() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
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
        returnInput.min =
            pickupInput && pickupInput.value
                ? pickupInput.value
                : today;

        if (
            returnInput.value &&
            returnInput.value < returnInput.min
        ) {
            returnInput.value = "";
        }
    }
}

if (pickupInput) {
    pickupInput.addEventListener("change", function () {
        updateDateLimits();

        if (searchHasRun) {
            clearSearchResults();
        }
    });
}

if (returnInput) {
    returnInput.addEventListener("change", function () {
        updateDateLimits();

        if (searchHasRun) {
            clearSearchResults();
        }
    });
}

updateDateLimits();


/* 4. MESSAGE HELPERS */

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


/* 5. CAR FILTERING */

function getVisibleCars() {
    return carCards.filter(function (card) {
        return !card.hidden;
    });
}

function updateCarCount(count) {
    // The count element is optional in the current HTML.
    if (!carCount) return;

    carCount.textContent =
        `${count} ${count === 1 ? "car" : "cars"} available`;
}

function applyCarFilter(type) {
    let visibleCount = 0;

    carCards.forEach(function (card) {
        const matchesType =
            type === "all" || card.dataset.type === type;

        card.hidden = !matchesType;

        if (matchesType) {
            visibleCount++;
        }
    });

    updateCarCount(visibleCount);

    if (noCarsMessage) {
        noCarsMessage.hidden = visibleCount !== 0;
    }
}

function clearSearchResults() {
    searchHasRun = false;

    carCards.forEach(function (card) {
        card.hidden = false;
    });

    updateCarCount(carCards.length);

    if (noCarsMessage) {
        noCarsMessage.hidden = true;
    }

    clearMessage();
}

if (carTypeInput) {
    carTypeInput.addEventListener("change", function () {
        if (searchHasRun) {
            applyCarFilter(carTypeInput.value);
        }
    });
}


/* 6. SEARCH CARS */

if (bookingForm) {
    bookingForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const location = locationInput.value;
        const pickup = pickupInput.value;
        const dropoff = returnInput.value;
        const type = carTypeInput.value;

        if (!location || !pickup || !dropoff) {
            showMessage(
                "Please select a location, pickup date and return date.",
                "error"
            );
            return;
        }

        const today = getTodayString();

        if (pickup < today) {
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

        applyCarFilter(type);

        const visibleCount = getVisibleCars().length;

        if (visibleCount === 0) {
            showMessage(
                "No sample cars match your selected category.",
                "info"
            );
        } else {
            showMessage(
                `${visibleCount} sample ${
                    visibleCount === 1 ? "car" : "cars"
                } match your category in ${location}. ` +
                "Actual vehicle availability has not been checked.",
                "success"
            );
        }

        const carsSection = document.getElementById("cars");

        if (carsSection) {
            carsSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    });
}


/* 7. VIEW ALL CARS */

if (viewAllButton) {
    viewAllButton.addEventListener("click", function () {
        if (carTypeInput) {
            carTypeInput.value = "all";
        }

        clearSearchResults();

        const carsSection = document.getElementById("cars");

        if (carsSection) {
            carsSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    });
}


/* 8. PRICE AND DATE HELPERS */

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(amount);
}

function formatDate(dateString) {
    const date = new Date(dateString + "T00:00:00");

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function calculateRentalDays(pickup, dropoff) {
    const start = new Date(pickup + "T00:00:00");
    const end = new Date(dropoff + "T00:00:00");

    return Math.round((end - start) / 86400000);
}


/* 9. BOOKING SUMMARY */

function renderBookingSummary(booking) {
    if (!bookingSummary) return;

    bookingSummary.replaceChildren();

    const rows = [
        ["Vehicle", booking.name],
        ["Pickup location", booking.location],
        ["Pickup date", formatDate(booking.pickup)],
        ["Return date", formatDate(booking.dropoff)],
        ["Rental duration", `${booking.days} day(s)`],
        ["Price per day", formatCurrency(booking.pricePerDay)],
        ["Estimated total", formatCurrency(booking.total)]
    ];

    rows.forEach(function (row, index) {
        const element = document.createElement("div");

        element.className =
            index === rows.length - 1
                ? "summary-row summary-total"
                : "summary-row";

        const label = document.createElement("span");
        label.textContent = row[0];

        const value = document.createElement("strong");
        value.textContent = row[1];

        element.append(label, value);
        bookingSummary.appendChild(element);
    });
}


/* 10. BOOK NOW BUTTONS */

document.querySelectorAll(".book-button").forEach(function (button) {
    button.addEventListener("click", function () {
        if (
            !locationInput ||
            !pickupInput ||
            !returnInput ||
            !locationInput.value ||
            !pickupInput.value ||
            !returnInput.value
        ) {
            showMessage(
                "Choose your location and dates in the booking form first.",
                "error"
            );

            const bookingSection = document.getElementById("booking");

            if (bookingSection) {
                bookingSection.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
            }

            if (locationInput) {
                locationInput.focus();
            }

            return;
        }

        updateDateLimits();

        const today = getTodayString();

        if (
            pickupInput.value < today ||
            returnInput.value <= pickupInput.value
        ) {
            showMessage(
                "Please choose valid pickup and return dates.",
                "error"
            );
            return;
        }

        const carCard = button.closest(".car-card");
        const carName = button.dataset.car;
        const dailyPrice = Number(button.dataset.price);

        const days = calculateRentalDays(
            pickupInput.value,
            returnInput.value
        );

        if (
            !carCard ||
            !carName ||
            !Number.isFinite(dailyPrice) ||
            dailyPrice <= 0 ||
            days <= 0
        ) {
            showMessage(
                "We could not calculate this booking. Please check your dates.",
                "error"
            );
            return;
        }

        selectedCar = {
            id: null,
            name: carName,
            pricePerDay: dailyPrice,
            days: days,
            total: dailyPrice * days,
            location: locationInput.value,
            pickup: pickupInput.value,
            dropoff: returnInput.value,
            category: carCard.dataset.type,
            status: "Demo only",
            createdAt: null
        };

        renderBookingSummary(selectedCar);

        showMessage(
            "Review the estimated booking summary in the dialog.",
            "info"
        );

        if (
            bookingDialog &&
            typeof bookingDialog.showModal === "function"
        ) {
            bookingDialog.showModal();
        } else {
            showMessage(
                "Your browser does not support the booking dialog.",
                "error"
            );
        }
    });
});


/* 11. DEMO BOOKING STORAGE */

function getDemoBookings() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) return [];

        const bookings = JSON.parse(saved);

        return Array.isArray(bookings) ? bookings : [];
    } catch (error) {
        console.error("Could not read demo bookings:", error);
        return [];
    }
}

function saveDemoBookings(bookings) {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(bookings)
        );

        return true;
    } catch (error) {
        console.error("Could not save demo bookings:", error);

        showMessage(
            "Bookings could not be saved in this browser.",
            "error"
        );

        return false;
    }
}

function renderDemoBookings() {
    if (!demoBookingsList) return;

    demoBookingsList.replaceChildren();

    const bookings = getDemoBookings();

    if (bookings.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.textContent = "No demo bookings yet.";

        demoBookingsList.appendChild(emptyMessage);
        return;
    }

    bookings.forEach(function (booking) {
        const card = document.createElement("article");
        card.className = "demo-booking-card";

        const title = document.createElement("h3");
        title.textContent = booking.name;

        const reference = document.createElement("p");
        reference.textContent = `Demo reference: ${booking.id}`;

        const location = document.createElement("p");
        location.textContent = `Pickup location: ${booking.location}`;

        const dates = document.createElement("p");
        dates.textContent =
            `${formatDate(booking.pickup)} – ${formatDate(booking.dropoff)}`;

        const duration = document.createElement("p");
        duration.textContent = `Rental duration: ${booking.days} day(s)`;

        const total = document.createElement("p");
        total.textContent = `Estimated total: ${formatCurrency(booking.total)}`;

        const status = document.createElement("p");
        status.textContent =
            "Demo only — vehicle not reserved and payment not processed.";

        card.append(
            title,
            reference,
            location,
            dates,
            duration,
            total,
            status
        );

        demoBookingsList.appendChild(card);
    });
}


/* 12. CONFIRM DEMO BOOKING */

if (confirmDemoButton) {
    confirmDemoButton.addEventListener("click", function () {
        if (!selectedCar) {
            showMessage(
                "Please select a car before confirming.",
                "error"
            );

            if (bookingDialog && bookingDialog.open) {
                bookingDialog.close();
            }

            return;
        }

        const bookings = getDemoBookings();

        const booking = {
            ...selectedCar,
            id: "DEMO-" + Date.now().toString(36).toUpperCase(),
            status: "Demo only",
            createdAt: new Date().toISOString()
        };

        bookings.unshift(booking);

        if (!saveDemoBookings(bookings)) {
            return;
        }

        renderDemoBookings();

        if (bookingDialog && bookingDialog.open) {
            bookingDialog.close();
        }

        showMessage(
            `Demo booking saved. Reference: ${booking.id}. ` +
            "No real vehicle has been reserved.",
            "success"
        );

        selectedCar = null;

        const bookingsSection = document.getElementById("demo-bookings");

        if (bookingsSection) {
            bookingsSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    });
}


/* 13. CLEAR DEMO BOOKINGS */

if (clearDemoBookingsButton) {
    clearDemoBookingsButton.addEventListener("click", function () {
        const bookings = getDemoBookings();

        if (bookings.length === 0) {
            showMessage("There are no demo bookings to clear.", "info");
            return;
        }

        const confirmed = window.confirm(
            "Are you sure you want to delete all demo bookings saved in this browser?"
        );

        if (!confirmed) return;

        try {
            localStorage.removeItem(STORAGE_KEY);
            renderDemoBookings();

            showMessage(
                "All demo bookings have been cleared from this browser.",
                "success"
            );
        } catch (error) {
            console.error("Could not clear demo bookings:", error);

            showMessage(
                "Demo bookings could not be cleared.",
                "error"
            );
        }
    });
}


/* 14. CLOSE BOOKING DIALOG */

if (dialogClose && bookingDialog) {
    dialogClose.addEventListener("click", function () {
        bookingDialog.close();
    });
}

if (bookingDialog) {
    bookingDialog.addEventListener("click", function (event) {
        if (event.target === bookingDialog) {
            bookingDialog.close();
        }
    });

    bookingDialog.addEventListener("close", function () {
        selectedCar = null;
    });
}


/* 15. MOBILE NAVIGATION */

if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", function () {
        const isOpen = navLinks.classList.toggle("open");

        menuToggle.setAttribute(
            "aria-expanded",
            String(isOpen)
        );

        menuToggle.setAttribute(
            "aria-label",
            isOpen ? "Close navigation" : "Open navigation"
        );

        menuToggle.textContent = isOpen ? "×" : "☰";
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
            navLinks.classList.remove("open");

            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Open navigation");
            menuToggle.textContent = "☰";

            navLinks.querySelectorAll("a").forEach(function (item) {
                item.classList.remove("active");
            });

            link.classList.add("active");
        });
    });
}


/* 16. INITIAL STATE */

clearSearchResults();
renderDemoBookings();


/* 17. HOME BUTTON — SCROLL TO TOP */

const homeLinks = document.querySelectorAll(
    'a[href="#home"]'
);

homeLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
        event.preventDefault();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        // Close the mobile menu after clicking Home.
        if (navLinks && menuToggle) {
            navLinks.classList.remove("open");

            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Open navigation");
            menuToggle.textContent = "☰";
        }

        // Update the active navigation link.
        if (navLinks) {
            navLinks.querySelectorAll("a").forEach(function (item) {
                item.classList.remove("active");
            });

            if (link.closest("#nav-links")) {
                link.classList.add("active");
            }
        }
    });
});


/* ==========================================
   DRIVE EASY — LOGGED-IN PROFILE
   ========================================== */

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

  // This script is also loaded on pages that may not have the navbar.
  if (
    !loggedOutActions ||
    !profileMenu ||
    !profileTrigger ||
    !profileDropdown
  ) {
    return;
  }

  let currentUser = null;

  function getInitials(name) {
    const words = String(name || "Drive Easy")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (words.length === 0) return "DE";

    return words
      .slice(0, 2)
      .map((word) => Array.from(word)[0])
      .join("")
      .toUpperCase();
  }

  function renderAvatar(element, name, photoUrl) {
    if (!element) return;

    // Use initials as the default, without a photo.
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

    const loggedIn = Boolean(user);

    loggedOutActions.hidden = loggedIn;
    profileMenu.hidden = !loggedIn;

    if (!loggedIn) {
      closeDropdown();
      return;
    }

    const name = user.name || "Drive Easy Member";
    const photo = user.profilePhoto || "";

    navName.textContent = name;
    dropdownName.textContent = name;
    dropdownEmail.textContent = user.email || "";

    renderAvatar(navAvatar, name, photo);
    renderAvatar(dropdownAvatar, name, photo);
  }

  async function loadCurrentUser() {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });

      if (response.status === 401) {
        renderUser(null);
        return;
      }

      if (!response.ok) {
        throw new Error("Could not load your account.");
      }

      const result = await response.json();
      renderUser(result.user || null);
    } catch (error) {
      console.error("Profile loading error:", error);
      // Do not break the homepage if the API is temporarily unavailable.
    }
  }

  profileTrigger.addEventListener("click", () => {
    if (profileDropdown.hidden) {
      openDropdown();
    } else {
      closeDropdown();
    }
  });

  document.addEventListener("click", (event) => {
    if (
      !profileMenu.hidden &&
      !profileMenu.contains(event.target)
    ) {
      closeDropdown();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDropdown();
    }
  });

  // Open the file picker for the user's profile photo.
  changePhotoButton?.addEventListener("click", () => {
    photoInput?.click();
  });

  photoInput?.addEventListener("change", async () => {
    const file = photoInput.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
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

    if (changePhotoButton) {
      changePhotoButton.disabled = true;
    }

    setFeedback("Uploading your profile photo...");

    try {
      const response = await fetch("/api/auth/profile-photo", {
        method: "POST",
        credentials: "same-origin",
        body: formData
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.message || "Unable to upload your photo."
        );
      }

      // Refresh the profile using the saved server-side data.
      await loadCurrentUser();

      setFeedback("Your profile photo has been updated.");
    } catch (error) {
      console.error("Photo upload error:", error);
      setFeedback(error.message || "Photo upload failed.", true);
    } finally {
      if (changePhotoButton) {
        changePhotoButton.disabled = false;
      }

      photoInput.value = "";
    }
  });

  // Connect menu options to features that currently exist.
  document.querySelectorAll("[data-profile-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.profileAction;
      closeDropdown();

      if (action === "bookings") {
        const bookingsSection = document.getElementById("demo-bookings");

        if (bookingsSection) {
          bookingsSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        } else {
          window.location.href = "/#demo-bookings";
        }

        return;
      }

      if (action === "my-profile" && currentUser) {
        window.alert(
          "My Profile\n\n" +
          "Name: " + currentUser.name + "\n" +
          "Email: " + currentUser.email +
          "\n\nProfile editing can be added next."
        );

        return;
      }

      if (action === "saved-cars") {
        window.alert(
          "Saved Cars is not implemented yet. " +
          "We can build the favorites feature next."
        );

        return;
      }

      if (action === "settings") {
        window.alert(
          "Account Settings is not implemented yet. " +
          "We can add secure profile editing and password changes next."
        );
      }
    });
  });

  logoutButton?.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Logging out...";

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Logout failed.");
      }

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