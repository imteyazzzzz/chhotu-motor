// =========================================================================
// CHHOTU MOTORCYCLES WORKSHOP — FIELD MECHANIC PORTAL CONTROLLER
// Handles scoped token validation, progress tracking, and invoice building.
// =========================================================================

const WORKSHOP_UPI_ID = "chhotumotorcycles@ybl"; // Config UPI ID
let mechanicToken = null;
let currentJob = null;
let partsList = [];
let countdownInterval = null;

// Initial state fetch on load
document.addEventListener("DOMContentLoaded", () => {
  mechanicToken = getPortalToken();
  if (mechanicToken) {
    loadPortalJobData();
  } else {
    showExpiredState();
  }
});

/** Parse UUID token from URL query string or path segment */
function getPortalToken() {
  const urlParams = new URLSearchParams(window.location.search);
  let token = urlParams.get("token");
  
  if (!token) {
    // Fallback path parse for URLs like /job/3f9a1c2e-4b47-4f67-872f-537482470710
    const parts = window.location.pathname.split("/");
    const idx = parts.indexOf("job");
    if (idx !== -1 && parts[idx + 1]) {
      token = parts[idx + 1];
    }
  }
  
  // Basic UUID format check
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return token && uuidRegex.test(token.trim()) ? token.trim() : null;
}

async function loadPortalJobData() {
  if (!window.supabaseClient || !mechanicToken) return;

  showLoadingState();
  hideGlobalError();

  try {
    const { data, error } = await window.supabaseClient.rpc("get_mechanic_job_by_token", {
      p_token: mechanicToken
    });

    if (error) throw error;
    if (!data) {
      showExpiredState();
      return;
    }

    if (data.expired) {
      showExpiredState();
      return;
    }

    currentJob = data;
    renderPortalView();

  } catch (err) {
    console.error("Failed to load job details:", err);
    showGlobalError("Database connection failed. Please check network.");
    showExpiredState();
  }
}

function renderPortalView() {
  const job = currentJob.booking;
  const cust = currentJob.customer;
  const invoice = currentJob.invoice;

  // Header status badge mapping
  const badge = document.getElementById("header-status-badge");
  badge.classList.remove("hidden");
  setStatusBadgeStyle(badge, job.status);

  // Populate Collapsible Customer Info
  document.getElementById("job-ref-title").textContent = `JOB #${job.id.substring(0, 8).toUpperCase()}`;
  document.getElementById("job-bike-model").textContent = `${job.bike_brand || ''} ${job.bike_model} · ${job.registration_no || 'No Reg No'}`;
  
  document.getElementById("job-cust-name").textContent = cust.full_name;
  document.getElementById("job-cust-phone").textContent = cust.phone || "No phone added";
  document.getElementById("job-call-btn").setAttribute("href", `tel:${cust.phone || ''}`);
  document.getElementById("job-issue").textContent = job.issue_description ? `"${job.issue_description}"` : "No description provided.";
  document.getElementById("job-location").textContent = job.location;
  
  if (job.coordinates) {
    document.getElementById("job-maps-link").setAttribute("href", `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.coordinates)}`);
    document.getElementById("job-maps-link").classList.remove("hidden");
  } else {
    document.getElementById("job-maps-link").setAttribute("href", `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.location)}`);
  }

  // State sections toggle
  hideAllViews();

  if (job.status === "pending" || job.status === "assigned" || job.status === "confirmed") {
    // 1. ASSIGNED STATE
    document.getElementById("state-active-job").classList.remove("hidden");
    document.getElementById("view-step-actions").classList.remove("hidden");
    const btn = document.getElementById("btn-primary-action");
    btn.textContent = "ON MY WAY";
    btn.setAttribute("onclick", "handleStatusUpdate('en_route')");

  } else if (job.status === "en_route") {
    // 2. EN ROUTE STATE
    document.getElementById("state-active-job").classList.remove("hidden");
    document.getElementById("view-step-actions").classList.remove("hidden");
    const btn = document.getElementById("btn-primary-action");
    btn.textContent = "START REPAIR";
    btn.setAttribute("onclick", "handleStatusUpdate('in_progress')");

  } else if (job.status === "in_progress") {
    // 3. IN PROGRESS STATE
    document.getElementById("state-active-job").classList.remove("hidden");
    document.getElementById("view-invoice-builder").classList.remove("hidden");
    renderRunningInvoice();

  } else if (job.status === "completed") {
    // 4. COMPLETED / PAYMENT SELECTION STATE
    document.getElementById("state-active-job").classList.remove("hidden");
    document.getElementById("view-payment-collection").classList.remove("hidden");
    
    const amount = invoice ? invoice.total_amount : 400;
    document.getElementById("payment-invoice-total").textContent = amount;
    
    // Default selects cash
    togglePaymentView("cash");

  } else if (job.status === "paid") {
    // 5. PAID STATE (Expirations countdown starts)
    document.getElementById("state-active-job").classList.remove("hidden");
    document.getElementById("view-payment-success").classList.remove("hidden");
    
    // Start live countdown timer
    startExpiryCountdown(job.paid_at);
  }
}

/** Toggles collapsible customer meta info details panel */
window.toggleCustomerDetails = function() {
  const panel = document.getElementById("job-cust-details-body");
  const arrow = document.getElementById("details-arrow-icon");
  const isHidden = panel.classList.contains("hidden");
  
  if (isHidden) {
    panel.classList.remove("hidden");
    arrow.innerHTML = `<i class="fa-solid fa-chevron-up"></i>`;
  } else {
    panel.classList.add("hidden");
    arrow.innerHTML = `<i class="fa-solid fa-chevron-down"></i>`;
  }
};

/** Standard status update RPC call wrapper */
window.handleStatusUpdate = async function(targetStatus) {
  const actionBtn = document.getElementById("btn-primary-action");
  const originalText = actionBtn.innerHTML;
  
  actionBtn.disabled = true;
  actionBtn.innerHTML = `<span class="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span> Processing...`;
  
  hideGlobalError();

  try {
    const { data: success, error } = await window.supabaseClient.rpc("update_mechanic_job_status", {
      p_token: mechanicToken,
      p_status: targetStatus
    });

    if (error) throw error;
    if (!success) throw new Error("Transition validation failed.");

    await loadPortalJobData();

  } catch (err) {
    console.error("Status transition failed:", err);
    showGlobalError("Failed to update status. Please try again.");
    actionBtn.disabled = false;
    actionBtn.innerHTML = originalText;
  }
};

/** Invoice Builder additions */
window.addPartItem = function() {
  const nameInput = document.getElementById("part-name");
  const priceInput = document.getElementById("part-price");
  
  const name = nameInput.value.trim();
  const price = parseFloat(priceInput.value);

  if (!name || isNaN(price) || price <= 0) {
    if (!name) nameInput.classList.add("invalid");
    if (isNaN(price) || price <= 0) priceInput.classList.add("invalid");
    return;
  }

  nameInput.classList.remove("invalid");
  priceInput.classList.remove("invalid");

  partsList.push({
    description: name,
    amount: price
  });

  nameInput.value = "";
  priceInput.value = "";

  renderRunningInvoice();
};

window.removePartItem = function(idx) {
  partsList.splice(idx, 1);
  renderRunningInvoice();
};

function renderRunningInvoice() {
  const container = document.getElementById("invoice-parts-list");
  if (!container) return;

  if (partsList.length === 0) {
    container.innerHTML = `<p class="text-[10px] text-[#B9B6AC] italic">No spare parts added yet.</p>`;
    document.getElementById("running-invoice-total").textContent = "400";
    return;
  }

  let totalSum = 400.0;
  container.innerHTML = partsList.map((item, idx) => {
    totalSum += item.amount;
    return `
      <div class="flex justify-between items-center py-1.5 border-b border-[#3A3F49]/10">
        <span class="text-[#F4F1E8]">${item.description}</span>
        <div class="flex items-center gap-3 font-mono">
          <span class="text-[#B9B6AC]">Rs. ${item.amount}</span>
          <button type="button" onclick="removePartItem(${idx})" class="text-red-500 hover:text-red-400 p-0.5" title="Remove"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>
    `;
  }).join("");

  document.getElementById("running-invoice-total").textContent = totalSum;
}

window.generateCompletedInvoice = async function() {
  const btn = document.getElementById("btn-complete-invoice");
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span> Processing Invoice...`;

  hideGlobalError();

  try {
    const { data: success, error } = await window.supabaseClient.rpc("complete_mechanic_job_with_invoice", {
      p_token: mechanicToken,
      p_parts: partsList
    });

    if (error) throw error;
    if (!success) throw new Error("Invoice submission rejected.");

    await loadPortalJobData();

  } catch (err) {
    console.error("Complete work invoice failed:", err);
    showGlobalError("Failed to compile invoice. Verify details.");
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
};

/** Payment UI Selectors Toggle */
window.togglePaymentView = function(method) {
  const cashBtn = document.getElementById("label-pay-cash");
  const upiBtn = document.getElementById("label-pay-upi");
  
  const cashBlock = document.getElementById("payment-cash-block");
  const upiBlock = document.getElementById("payment-upi-block");

  // Reset checked styles
  cashBtn.className = "card p-3 text-center cursor-pointer flex flex-col items-center justify-center border border-[#3A3F49] gap-1 transition-all";
  upiBtn.className = "card p-3 text-center cursor-pointer flex flex-col items-center justify-center border border-[#3A3F49] gap-1 transition-all";

  if (method === "cash") {
    cashBtn.className = "card p-3 text-center cursor-pointer flex flex-col items-center justify-center border-2 border-[#FF5A1F] text-[#FF5A1F] bg-[#FF5A1F]/5 gap-1 transition-all";
    cashBlock.classList.remove("hidden");
    upiBlock.classList.add("hidden");
  } else {
    upiBtn.className = "card p-3 text-center cursor-pointer flex flex-col items-center justify-center border-2 border-[#FF5A1F] text-[#FF5A1F] bg-[#FF5A1F]/5 gap-1 transition-all";
    cashBlock.classList.add("hidden");
    upiBlock.classList.remove("hidden");
    
    // Generate UPI QR Code image dynamically
    generateUPIQRImage();
  }
};

function generateUPIQRImage() {
  const total = currentJob.invoice ? currentJob.invoice.total_amount : 400;
  const refId = currentJob.booking.id.substring(0, 8).toUpperCase();
  
  // Format standard UPI payment link string
  const upiLink = `upi://pay?pa=${WORKSHOP_UPI_ID}&pn=Chhotu%20Motorcycle%20Workshop&am=${total}&tn=BK-${refId}`;
  
  // Set image src using open-source QR code generator API
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`;
  document.getElementById("upi-qr-image").setAttribute("src", qrUrl);
}

window.confirmPaymentReceived = async function(method) {
  const confirmBtn = method === "cash" 
    ? document.getElementById("btn-confirm-cash")
    : document.getElementById("btn-confirm-upi");
  
  const originalText = confirmBtn.innerHTML;
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = `<span class="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span> Confirming...`;

  hideGlobalError();

  try {
    const { data: success, error } = await window.supabaseClient.rpc("mark_mechanic_job_paid", {
      p_token: mechanicToken,
      p_method: method
    });

    if (error) throw error;
    if (!success) throw new Error("Payment record rejected.");

    await loadPortalJobData();

  } catch (err) {
    console.error("Payment confirmation failed:", err);
    showGlobalError("Payment confirmation failed. Try again.");
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = originalText;
  }
};

/** Live 5-minute countdown expiry clock */
function startExpiryCountdown(paidAtTimestamp) {
  if (countdownInterval) clearInterval(countdownInterval);

  const paidDate = new Date(paidAtTimestamp);
  const expiryDate = new Date(paidDate.getTime() + 5 * 60 * 1000); // + 5 minutes
  const timerEl = document.getElementById("expiry-countdown-timer");

  const tick = () => {
    const diffMs = expiryDate - new Date();
    if (diffMs <= 0) {
      clearInterval(countdownInterval);
      showExpiredState();
      return;
    }

    const diffSecs = Math.floor(diffMs / 1000);
    const mins = Math.floor(diffSecs / 60);
    const secs = diffSecs % 60;
    
    timerEl.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  tick(); // run first tick immediately
  countdownInterval = setInterval(tick, 1000);
}

// Global UI View toggles
function showLoadingState() {
  document.getElementById("state-loading").classList.remove("hidden");
  document.getElementById("state-expired").classList.add("hidden");
  document.getElementById("state-active-job").classList.add("hidden");
}

function showExpiredState() {
  document.getElementById("state-loading").classList.add("hidden");
  document.getElementById("state-expired").classList.remove("hidden");
  document.getElementById("state-active-job").classList.add("hidden");
  if (countdownInterval) clearInterval(countdownInterval);
}

function hideAllViews() {
  document.getElementById("state-loading").classList.add("hidden");
  document.getElementById("state-expired").classList.add("hidden");
  document.getElementById("view-step-actions").classList.add("hidden");
  document.getElementById("view-invoice-builder").classList.add("hidden");
  document.getElementById("view-payment-collection").classList.add("hidden");
  document.getElementById("view-payment-success").classList.add("hidden");
}

function showGlobalError(msg) {
  const errEl = document.getElementById("global-portal-error");
  errEl.textContent = msg;
  errEl.classList.remove("hidden");
}

function hideGlobalError() {
  document.getElementById("global-portal-error").classList.add("hidden");
}

function setStatusBadgeStyle(el, status) {
  el.textContent = status.replace("-", " ").replace("_", " ");
  let colorClasses = "bg-[#3A3F49] text-[#B9B6AC]";

  if (status === "en_route") {
    colorClasses = "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20";
  } else if (status === "in_progress") {
    colorClasses = "bg-[#FF5A1F]/15 text-[#FF5A1F] border border-[#FF5A1F]/20";
  } else if (status === "completed") {
    colorClasses = "bg-blue-500/15 text-blue-400 border border-blue-500/20";
  } else if (status === "paid") {
    colorClasses = "bg-green-500/15 text-green-400 border border-green-500/20";
  }

  el.className = `px-2 py-0.5 rounded text-[9px] uppercase font-mono tracking-wider font-semibold ${colorClasses}`;
}
