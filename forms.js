/* =========================================================================
   CHHOTU MOTORCYCLES WORKSHOP — FORM HANDLING
   Shared by booking.html and contact.html. Both forms POST JSON to the
   N8N webhook below with a `form_type` field so the workflow can route
   bookings vs. general contact messages separately.
   ========================================================================= */

const N8N_WEBHOOK_URL = "https://imteefy.duckdns.org/webhook-test/chhotu-motor";

/** Nepal-friendly phone check: allows +977, spaces, dashes, 7-10 digits after any prefix. */
function isValidPhone(value) {
  const cleaned = value.trim();
  return /^(\+?977[-\s]?)?[0-9]{7,10}$/.test(cleaned.replace(/[-\s]/g, ""));
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
  if (errorEl) errorEl.classList.add("hidden");

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

    if (!res.ok) throw new Error(`Webhook responded ${res.status}`);

    if (successEl) successEl.classList.remove("hidden");
    button.innerHTML = originalLabel;
    button.disabled = false;
    return true;
  } catch (err) {
    clearTimeout(timeout);
    console.error("Webhook submission failed:", err);
    if (errorEl) {
      errorEl.classList.remove("hidden");
      const waLink = errorEl.querySelector("[data-wa-fallback]");
      if (waLink && waFallbackHref) waLink.setAttribute("href", waFallbackHref);
    }
    button.innerHTML = originalLabel;
    button.disabled = false;
    return false;
  }
}
