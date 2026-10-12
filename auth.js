
"use strict";

// Update the copyright year.
document.querySelectorAll(".current-year").forEach(function (element) {
    element.textContent = new Date().getFullYear();
});

// Show/hide password controls.
document.querySelectorAll(".show-password").forEach(function (button) {
    button.addEventListener("click", function () {
        const input = document.getElementById(button.dataset.target);

        if (!input) return;

        const showing = input.type === "text";
        input.type = showing ? "password" : "text";
        button.textContent = showing ? "Show" : "Hide";
    });
});

// Display a message safely.
function displayAuthMessage(element, message, type) {
    element.textContent = message;
    element.className = "form-message " + type;
}

// LOGIN FORM
const loginForm = document.getElementById("login-form");

if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;
        const message = document.getElementById("login-message");

        if (!email || !password) {
            displayAuthMessage(
                message,
                "Please enter your email and password.",
                "error"
            );
            return;
        }

        if (!loginForm.checkValidity()) {
            loginForm.reportValidity();
            return;
        }

        displayAuthMessage(
            message,
            "The form is valid, but login is not connected yet. A secure backend is required to verify your account.",
            "info"
        );
    });
}

// REGISTRATION FORM
const registerForm = document.getElementById("register-form");

if (registerForm) {
    registerForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const fullName = document.getElementById("full-name").value.trim();
        const email = document.getElementById("register-email").value.trim();
        const phone = document.getElementById("register-phone").value.trim();
        const password = document.getElementById("register-password").value;
        const confirmPassword =
            document.getElementById("confirm-password").value;
        const acceptTerms = document.getElementById("accept-terms").checked;
        const message = document.getElementById("register-message");

        if (!registerForm.checkValidity()) {
            registerForm.reportValidity();
            return;
        }

        if (fullName.length < 2) {
            displayAuthMessage(
                message,
                "Please enter your full name.",
                "error"
            );
            return;
        }

        if (!email || !phone) {
            displayAuthMessage(
                message,
                "Please enter your email address and phone number.",
                "error"
            );
            return;
        }

        if (password.length < 8) {
            displayAuthMessage(
                message,
                "Your password must contain at least 8 characters.",
                "error"
            );
            return;
        }

        if (password !== confirmPassword) {
            displayAuthMessage(
                message,
                "The passwords do not match. Please try again.",
                "error"
            );
            return;
        }

        if (!acceptTerms) {
            displayAuthMessage(
                message,
                "Please accept the terms to continue.",
                "error"
            );
            return;
        }

        displayAuthMessage(
            message,
            "Your form is valid, but account creation is not connected yet. A secure backend is required to create your account.",
            "info"
        );
    });
}