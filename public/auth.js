
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");

  // Display the current year in the footer.
  document.querySelectorAll(".current-year").forEach((element) => {
    element.textContent = new Date().getFullYear();
  });

  // Show or hide password fields.
  document.querySelectorAll(".show-password").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.target);

      if (!input) return;

      const showPassword = input.type === "password";
      input.type = showPassword ? "text" : "password";
      button.textContent = showPassword ? "Hide" : "Show";
      button.setAttribute(
        "aria-label",
        showPassword ? "Hide password" : "Show password"
      );
    });
  });

  async function handleAuth(form, endpoint) {
    const isRegister = endpoint === "/api/auth/register";
    const message = form.querySelector(".form-message");
    const submitButton = form.querySelector('button[type="submit"]');

    function showMessage(text, success = false) {
      if (message) {
        message.textContent = text;
        message.style.color = success ? "green" : "crimson";
      } else {
        alert(text);
      }
    }

    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());

    // Convert the HTML fullName field to the backend's name field.
    if (isRegister) {
      values.name = String(values.fullName || "").trim();

      const confirmPassword = values.confirmPassword;

      if (values.password !== confirmPassword) {
        showMessage("Passwords do not match.");
        document.getElementById("confirm-password")?.focus();
        return;
      }

      if (values.password.length < 8) {
        showMessage("Password must be at least 8 characters.");
        return;
      }

      // The terms checkbox must be checked.
      const terms = document.getElementById("accept-terms");

      if (terms && !terms.checked) {
        showMessage("Please accept the Terms and Privacy Policy.");
        return;
      }

      delete values.fullName;
      delete values.confirmPassword;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Please wait...";
    }

    showMessage("Connecting to Drive Easy...");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(values)
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.message || "Request failed. Please try again."
        );
      }

      showMessage(
        result.message || "Success! Redirecting...",
        true
      );

      // Give the user a moment to see the success message.
      window.setTimeout(() => {
        window.location.href = "/";
      }, 500);
    } catch (error) {
      console.error("Authentication error:", error);
      showMessage(
        error.message ||
        "Could not connect to the server. Please try again."
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = isRegister
          ? "Create Account"
          : "Login";
      }
    }
  }

  if (registerForm) {
    registerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      handleAuth(registerForm, "/api/auth/register");
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      handleAuth(loginForm, "/api/auth/login");
    });
  }
});