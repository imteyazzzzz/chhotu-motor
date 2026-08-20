/* =========================================================================
   CHHOTU MOTORCYCLES WORKSHOP — FORM HANDLING
   Shared by booking.html and contact.html. Both forms POST JSON to the
   N8N webhook below with a `form_type` field so the workflow can route
   bookings vs. general contact messages separately.
   ========================================================================= */

const N8N_WEBHOOK_URL = "https://imteefy.duckdns.org/webhook-test/chhotu-motor";

/** Clean phone number: strips formatting and redundant country/zero prefixes */
function cleanPhoneNumber(value, countryCode = "") {
  let cleaned = value.replace(/[-\s()]/g, "");
  
  if (countryCode) {
    const codeNum = countryCode.replace("+", "");
    if (cleaned.startsWith(countryCode)) {
      cleaned = cleaned.substring(countryCode.length);
    } else if (cleaned.startsWith(codeNum)) {
      cleaned = cleaned.substring(codeNum.length);
    }
  }
  
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }
  
  return cleaned;
}

/** Check if the phone number is valid for the selected country code */
function isValidPhone(value, countryCode = "+91") {
  const cleaned = cleanPhoneNumber(value, countryCode);
  if (countryCode === "+91") {
    // India mobile (10 digits)
    return /^[0-9]{10}$/.test(cleaned);
  }
  return /^[0-9]{7,12}$/.test(cleaned);
}

function showFieldError(inputEl, errorEl, message) {
  inputEl.classList.add("invalid");
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add("show");
  }
}

function clearFieldError(inputEl, errorEl) {
  inputEl.classList.remove("invalid");
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.classList.remove("show");
  }
}

/**
 * Validate a form against a rule set.
 * rules: [{ input, error, required, validator, message }]
 * Returns true if all rules pass.
 */
function validateForm(rules) {
  let valid = true;
  rules.forEach(({ input, error, required, validator, message }) => {
    const val = input.value.trim();
    let ok = true;
    if (required && !val) ok = false;
    if (ok && validator && val && !validator(val)) ok = false;

    if (!ok) {
      showFieldError(input, error, message);
      valid = false;
    } else {
      clearFieldError(input, error);
    }
  });
  return valid;
}

/**
 * Submit a payload to the N8N webhook, toggling button/loading state and
 * showing success or error panels. Falls back to a WhatsApp deep link
 * with the same details if the webhook call fails or times out.
 */
async function submitToWebhook({ payload, button, successEl, errorEl, waFallbackHref }) {
  const originalLabel = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<span class="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span> Sending…`;

  if (successEl) successEl.classList.add("hidden");
  if (errorEl) {
    errorEl.classList.add("hidden");
    const detailsEl = errorEl.querySelector(".error-details");
    if (detailsEl) {
      detailsEl.textContent = "";
      detailsEl.classList.add("hidden");
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      let bodyText = "";
      try {
        bodyText = await res.text();
      } catch (_) {}
      throw new Error(`Server responded with status ${res.status}${bodyText ? ": " + bodyText.substring(0, 100) : ""}`);
    }

    if (successEl) successEl.classList.remove("hidden");
    button.innerHTML = originalLabel;
    button.disabled = false;
    return true;
  } catch (err) {
    clearTimeout(timeout);
    console.error("Webhook submission failed:", err);
    if (errorEl) {
      errorEl.classList.remove("hidden");
      const detailsEl = errorEl.querySelector(".error-details");
      if (detailsEl) {
        detailsEl.textContent = `Error Details: ${err.message || err}`;
        detailsEl.classList.remove("hidden");
      }
      const waLink = errorEl.querySelector("[data-wa-fallback]");
      if (waLink && waFallbackHref) waLink.setAttribute("href", waFallbackHref);
    }
    button.innerHTML = originalLabel;
    button.disabled = false;
    return false;
  }
}
