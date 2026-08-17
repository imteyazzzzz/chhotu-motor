// =========================================================================
// CHHOTU MOTORCYCLES WORKSHOP — ACCOUNT DASHBOARD CONTROLLER
// Handles Profile summary, Tab switcher, editable Info/Passwords,
// Bookings history, Motorcycles CRUD, Saved Addresses, and Toggles.
// =========================================================================

let currentUser = null;
let profileData = {};

// Default states in case tables are not created in database yet
let savedBikes = [];
let savedAddresses = { home_address: "", office_address: "" };
let savedNotifs = {
  booking_whatsapp: true,
  booking_sms: false,
  booking_email: true,
  promo_whatsapp: false,
  promo_email: false
};

// ---- Auth Guard & Session Check ----
async function checkAuthSession() {
  const loadingEl = document.getElementById("profile-loading");
  const containerEl = document.getElementById("profile-container");

  if (!window.supabaseClient) {
    console.error("Supabase client is not ready.");
    return;
  }

  try {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    
    if (!session || !session.user) {
      console.warn("No active session. Redirecting to auth.html...");
      window.location.href = "auth.html?redirect=profile.html";
      return;
    }

    currentUser = session.user;
    
    // Fetch profile details
    await fetchProfileInfo();
    
    // Hide skeleton loading and show main page
    if (loadingEl) loadingEl.classList.add("hidden");
    if (containerEl) containerEl.classList.remove("hidden");
    
    // Load and render tab details
    initTabs();
    await loadOverviewData();

  } catch (err) {
    console.error("Auth guard check failed:", err);
    window.location.href = "auth.html?redirect=profile.html";
  }
}

// ---- Fetch Profile Info (Database with Metadata Fallback) ----
async function fetchProfileInfo() {
  if (!currentUser) return;

  // Set default values from auth session metadata first
  profileData = {
    full_name: currentUser.user_metadata?.full_name || "Valued Customer",
    phone: currentUser.user_metadata?.phone || "",
    avatar_url: currentUser.user_metadata?.avatar_url || "",
    created_at: currentUser.created_at
  };

  try {
    // Attempt database profiles table lookup
    const { data, error } = await window.supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error) {
      // If table doesn't exist, we fall back to metadata silently
      if (error.code !== "42P01") throw error;
    } else if (data) {
      profileData = { ...profileData, ...data };
    }
  } catch (err) {
    console.warn("Could not query profiles table, falling back to auth metadata:", err);
  }

  // Populate visible header identities on load
  populateProfileHeaders();
}

function populateProfileHeaders() {
  const name = profileData.full_name;
  const email = currentUser.email;
  const phone = profileData.phone;
  const createdAt = new Date(profileData.created_at);
  const formattedMemberSince = createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  
  // Create initials for avatar fallback
  const nameParts = name.trim().split(" ");
  const initials = nameParts.length > 1 
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : nameParts[0].substring(0, 2).toUpperCase();

  // Populate desktop avatar/header card
  const dAvatar = document.getElementById("d-avatar");
  if (dAvatar) {
    if (profileData.avatar_url) {
      dAvatar.innerHTML = `<img src="${profileData.avatar_url}" class="w-full h-full object-cover rounded-full" alt="Avatar">`;
    } else {
      dAvatar.textContent = initials;
    }
  }
  const dName = document.getElementById("d-name");
  if (dName) dName.textContent = name;
  const dEmail = document.getElementById("d-email");
  if (dEmail) dEmail.textContent = email;
  const dPhone = document.getElementById("d-phone");
  if (dPhone) dPhone.textContent = phone || "No phone added";
  const dMember = document.getElementById("d-member-since");
  if (dMember) dMember.textContent = formattedMemberSince;

  // Populate mobile avatar/header card
  const mAvatar = document.getElementById("m-avatar");
  if (mAvatar) {
    if (profileData.avatar_url) {
      mAvatar.innerHTML = `<img src="${profileData.avatar_url}" class="w-full h-full object-cover rounded-full" alt="Avatar">`;
    } else {
      mAvatar.textContent = initials;
    }
  }
  const mName = document.getElementById("m-name");
  if (mName) mName.textContent = name;
  const mEmail = document.getElementById("m-email");
  if (mEmail) mEmail.textContent = email;
  const mPhone = document.getElementById("m-phone");
  if (mPhone) mPhone.textContent = phone || "No phone added";
}

// ---- Tab Switching Controller ----
const tabPanels = ["overview", "account", "bookings", "bikes", "addresses", "notifications"];

function initTabs() {
  const tabsList = document.querySelectorAll("nav[role='tablist'] button[role='tab'], div[role='tablist'] button[role='tab']");
  
  tabsList.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetPanel = tab.getAttribute("aria-controls").replace("panel-", "");
      
      // Update Active Panel view
      tabPanels.forEach(panelName => {
        const panelEl = document.getElementById(`panel-${panelName}`);
        if (panelEl) {
          if (panelName === targetPanel) {
            panelEl.classList.remove("hidden");
          } else {
            panelEl.classList.add("hidden");
          }
        }
      });

      // Update Navigation styling (Desktop and Mobile)
      tabsList.forEach(t => {
        const tPanel = t.getAttribute("aria-controls").replace("panel-", "");
        const isActive = tPanel === targetPanel;
        
        t.setAttribute("aria-selected", String(isActive));
        
        // Handle styling replacements based on desktop list vs mobile pill shape
        if (t.id.startsWith("m-tab-")) {
          if (isActive) {
            t.className = "px-4 py-1.5 rounded-full font-display text-xs uppercase tracking-wider bg-[#FF5A1F] text-black font-semibold transition-all";
          } else {
            t.className = "px-4 py-1.5 rounded-full font-display text-xs uppercase tracking-wider border border-[#3A3F49] text-[#B9B6AC] transition-all";
          }
        } else {
          if (isActive) {
            t.className = "flex items-center gap-3 px-4 py-3 text-left font-display text-sm tracking-wider uppercase border-l-2 border-[#FF5A1F] text-[#FF5A1F] transition-all";
          } else {
            t.className = "flex items-center gap-3 px-4 py-3 text-left font-display text-sm tracking-wider uppercase border-l-2 border-transparent text-[#B9B6AC] hover:text-[#F4F1E8] transition-all";
          }
        }
      });

      // Lazy load data based on selected tab panel
      lazyLoadTab(targetPanel);
    });
  });

  // Wire up "Edit Account" quick button to switch directly to the Account Details tab
  const triggerEditTab = () => {
    const accTab = document.getElementById("tab-account") || document.getElementById("m-tab-account");
    if (accTab) accTab.click();
    setTimeout(() => {
      const editBtn = document.getElementById("btn-edit-personal");
      if (editBtn) editBtn.click();
      const firstInput = document.getElementById("e-name");
      if (firstInput) firstInput.focus();
    }, 200);
  };
  
  const dEditBtn = document.getElementById("d-btn-edit-profile");
  if (dEditBtn) dEditBtn.addEventListener("click", triggerEditTab);
  const mEditBtn = document.getElementById("m-btn-edit-profile");
  if (mEditBtn) mEditBtn.addEventListener("click", triggerEditTab);
}

// Lazy fetch tab data on click to keep initial page loading fast
function lazyLoadTab(tabName) {
  if (tabName === "bookings") loadUserBookings();
  if (tabName === "bikes") loadUserBikes();
  if (tabName === "addresses") loadUserAddresses();
  if (tabName === "notifications") loadUserNotifications();
}

// ---- Overview Summary Data ----
async function loadOverviewData() {
  if (!currentUser) return;
  
  let activeBookings = 0;
  let totalBookings = 0;
  let latestBooking = null;

  try {
    const { data: bookingsData, error } = await window.supabaseClient
      .from("bookings")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error && error.code !== "42P01") throw error;

    if (bookingsData && bookingsData.length > 0) {
      totalBookings = bookingsData.length;
      latestBooking = bookingsData[0];
      
      activeBookings = bookingsData.filter(b => 
        ["pending", "assigned", "in_progress", "dispatched"].includes(b.status)
      ).length;
    }
  } catch (err) {
    console.warn("Could not query bookings summary:", err);
  }

  // Load bikes counts
  let bikesCount = 0;
  try {
    const { data, error } = await window.supabaseClient
      .from("motorcycles")
      .select("id")
      .eq("user_id", currentUser.id);
    if (!error && data) bikesCount = data.length;
  } catch (_) {}

  // Load addresses count
  let addressCount = 0;
  try {
    const { data, error } = await window.supabaseClient
      .from("addresses")
      .select("*")
      .eq("user_id", currentUser.id)
      .maybeSingle();
    if (!error && data) {
      if (data.home_address) addressCount++;
      if (data.office_address) addressCount++;
    }
  } catch (_) {}

  // Update Overview statistics values
  document.getElementById("stat-active-bookings").textContent = activeBookings;
  document.getElementById("stat-total-bookings").textContent = totalBookings;
  document.getElementById("stat-saved-bikes").textContent = bikesCount;
  document.getElementById("stat-saved-addresses").textContent = addressCount;

  // Render latest booking snapshot
  const latestWrap = document.getElementById("overview-booking-content");
  if (latestWrap) {
    if (latestBooking) {
      const dt = new Date(latestBooking.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const statusPill = getStatusPill(latestBooking.status);
      
      latestWrap.innerHTML = `
        <div class="space-y-4">
          <div class="flex justify-between items-start">
            <div>
              <p class="font-mono text-sm font-bold text-[#FF5A1F]">${latestBooking.bike_brand || ""} ${latestBooking.bike_model || "Motorcycle"}</p>
              <p class="text-xs text-[#B9B6AC] mt-1 capitalize"><i class="fa-solid fa-screwdriver-wrench text-[9px]"></i> ${latestBooking.service_type.replace("-", " ")} · ${dt}</p>
            </div>
            ${statusPill}
          </div>
          <div class="flex gap-2">
            <a href="tracking.html?id=${latestBooking.id}" class="btn btn-primary !py-1.5 !px-3 !text-xs"><i class="fa-solid fa-location-arrow"></i> Track Status</a>
            <button onclick="document.getElementById('tab-bookings').click()" class="btn btn-outline !py-1.5 !px-3 !text-xs">View History</button>
          </div>
        </div>
      `;
    } else {
      latestWrap.innerHTML = `
        <div class="text-center py-4 space-y-3">
          <p class="text-sm text-[#B9B6AC]">No recent repair requests found.</p>
          <a href="booking.html" class="btn btn-outline !py-1.5 !px-3 !text-xs"><i class="fa-solid fa-plus"></i> Book a Repair Now</a>
        </div>
      `;
    }
  }
}

// Status Badges mapping helper
function getStatusPill(status) {
  let badgeColorClass = "bg-[#3A3F49] text-[#B9B6AC]";
  let label = "Pending";

  if (status === "assigned" || status === "confirmed") {
    badgeColorClass = "bg-blue-500/15 text-blue-400";
    label = "Assigned";
  } else if (status === "dispatched") {
    badgeColorClass = "bg-yellow-500/15 text-yellow-400";
    label = "Dispatched";
  } else if (status === "in_progress" || status === "in-progress") {
    badgeColorClass = "bg-[#FF5A1F]/15 text-[#FF5A1F]";
    label = "In Progress";
  } else if (status === "completed") {
    badgeColorClass = "bg-green-500/15 text-green-400";
    label = "Completed";
  } else if (status === "cancelled") {
    badgeColorClass = "bg-red-500/15 text-red-400";
    label = "Cancelled";
  }

  return `<span class="px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider font-semibold ${badgeColorClass}">${label}</span>`;
}

// ---- Bookings Tab Controller ----
async function loadUserBookings() {
  const listEl = document.getElementById("bookings-list-content");
  if (!listEl) return;

  listEl.innerHTML = `<p class="text-sm text-[#B9B6AC] skeleton h-20 rounded-md"></p>`;

  try {
    const { data: bookings, error } = await window.supabaseClient
      .from("bookings")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error && error.code !== "42P01") throw error;

    if (!bookings || bookings.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-10 card p-6 space-y-4">
          <p class="text-sm text-[#B9B6AC]">You haven't booked any repairs yet.</p>
          <a href="booking.html" class="btn btn-primary !py-2 !px-4 !text-xs inline-block"><i class="fa-solid fa-calendar-plus"></i> Request Your First Booking</a>
        </div>
      `;
      return;
    }

    listEl.innerHTML = bookings.map(booking => {
      const dt = new Date(booking.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const statusPill = getStatusPill(booking.status);
      const isUrgent = booking.service_type === "emergency";
      const locationLabel = booking.location ? `<p class="text-xs text-[#B9B6AC] mt-1"><i class="fa-solid fa-location-dot text-[9px] text-[#FF5A1F]"></i> Address: ${booking.location}</p>` : "";

      return `
        <div class="card p-5 space-y-3 flex flex-col justify-between sm:flex-row sm:items-center sm:space-y-0">
          <div class="space-y-1">
            <div class="flex items-center gap-3">
              <h4 class="font-mono text-sm font-bold text-[#FF5A1F]">${booking.bike_brand || ""} ${booking.bike_model}</h4>
              ${statusPill}
            </div>
            <p class="text-xs text-[#B9B6AC] capitalize"><i class="fa-solid fa-clock text-[9px]"></i> ${booking.service_type.replace("-", " ")} · ${dt}</p>
            ${locationLabel}
            ${booking.issue_description ? `<p class="text-xs text-[#B9B6AC] italic mt-1 bg-[#14161A] p-2 rounded">" ${booking.issue_description} "</p>` : ""}
          </div>
          <div class="pt-2 sm:pt-0 shrink-0">
            <a href="tracking.html?id=${booking.id}" class="btn btn-outline !py-1.5 !px-3 !text-xs w-full sm:w-auto text-center"><i class="fa-solid fa-route"></i> Track Status</a>
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("Error loading user bookings list:", err);
    listEl.innerHTML = `<p class="text-sm text-red-400">Failed to load booking history: ${err.message || err}</p>`;
  }
}

// ---- Account Details Tab Controller (Personal Information) ----
const personalView = document.getElementById("personal-view-mode");
const personalForm = document.getElementById("personal-edit-form");
const btnEditPersonal = document.getElementById("btn-edit-personal");
const btnCancelPersonal = document.getElementById("btn-cancel-personal");

function setupAccountDetailsController() {
  if (btnEditPersonal) {
    btnEditPersonal.addEventListener("click", () => {
      personalView.classList.add("hidden");
      personalForm.classList.remove("hidden");
      
      // Populate fields from current profileData state
      document.getElementById("e-name").value = profileData.full_name;
      
      const phoneInputVal = profileData.phone || "";
      let matchedCode = "+977";
      let localNum = phoneInputVal;
      
      // Parse phone code
      ["+977", "+91", "+1"].forEach(code => {
        if (phoneInputVal.startsWith(code)) {
          matchedCode = code;
          localNum = phoneInputVal.substring(code.length);
        }
      });
      
      document.getElementById("e-phone-code").value = matchedCode;
      document.getElementById("e-phone").value = localNum;
    });
  }

  if (btnCancelPersonal) {
    btnCancelPersonal.addEventListener("click", () => {
      personalForm.classList.add("hidden");
      personalView.classList.remove("hidden");
      // Reset validation states
      clearFieldError(document.getElementById("e-name"), document.getElementById("e-name-error"));
      clearFieldError(document.getElementById("e-phone"), document.getElementById("e-phone-error"));
    });
  }

  // Handle personal info saving
  personalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("e-name");
    const codeSelect = document.getElementById("e-phone-code");
    const phoneInput = document.getElementById("e-phone");
    const saveBtn = document.getElementById("btn-save-personal");

    const rules = [
      { input: nameInput, error: document.getElementById("e-name-error"), required: true },
      { input: phoneInput, error: document.getElementById("e-phone-error"), required: true, validator: (val) => isValidPhone(val, codeSelect.value) }
    ];

    if (!validateForm(rules)) return;

    const originalBtnText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span> Saving...`;

    const cleanedLocal = cleanPhoneNumber(phoneInput.value, codeSelect.value);
    const combinedPhone = `${codeSelect.value}${cleanedLocal}`;

    const updatedData = {
      full_name: nameInput.value.trim(),
      phone: combinedPhone,
      updated_at: new Date().toISOString()
    };

    const toastSuccess = document.getElementById("account-success");
    const toastError = document.getElementById("account-error");

    try {
      toastSuccess.classList.add("hidden");
      toastError.classList.add("hidden");

      // 1. Update profiles table
      const { error } = await window.supabaseClient
        .from("profiles")
        .upsert({ id: currentUser.id, ...updatedData });

      if (error && error.code !== "42P01") throw error;

      // 2. Also update auth user metadata for fallback sync
      await window.supabaseClient.auth.updateUser({
        data: {
          full_name: updatedData.full_name,
          phone: updatedData.phone
        }
      });

      // Update local state
      profileData.full_name = updatedData.full_name;
      profileData.phone = updatedData.phone;
      populateProfileHeaders();

      // Show view mode again
      document.getElementById("v-name").textContent = profileData.full_name;
      document.getElementById("v-phone").textContent = profileData.phone;
      
      btnCancelPersonal.click();

      // Trigger success confirmation toast popup
      toastSuccess.classList.remove("hidden");
      setTimeout(() => {
        toastSuccess.classList.add("hidden");
      }, 4000);

    } catch (err) {
      console.error(err);
      toastError.textContent = `Update Failed: ${err.message || err}`;
      toastError.classList.remove("hidden");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalBtnText;
    }
  });

  // Handle dynamic loading values
  document.getElementById("v-name").textContent = profileData.full_name;
  document.getElementById("v-phone").textContent = profileData.phone || "No phone added";
  document.getElementById("v-email").textContent = currentUser.email;
}

// ---- Change Password Accordion Controller ----
function setupChangePasswordController() {
  const form = document.getElementById("password-change-form");
  const toggleBtn = document.getElementById("btn-toggle-password");
  const cancelBtn = document.getElementById("btn-cancel-password");
  const saveBtn = document.getElementById("btn-save-password");

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      form.classList.toggle("hidden");
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      form.classList.add("hidden");
      form.reset();
      clearFieldError(document.getElementById("pw-current"), document.getElementById("pw-current-error"));
      clearFieldError(document.getElementById("pw-new"), document.getElementById("pw-new-error"));
      clearFieldError(document.getElementById("pw-confirm"), document.getElementById("pw-confirm-error"));
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentInput = document.getElementById("pw-current");
    const newInput = document.getElementById("pw-new");
    const confirmInput = document.getElementById("pw-confirm");

    const rules = [
      { input: currentInput, error: document.getElementById("pw-current-error"), required: true },
      { input: newInput, error: document.getElementById("pw-new-error"), required: true },
      { input: confirmInput, error: document.getElementById("pw-confirm-error"), required: true }
    ];

    if (!validateForm(rules)) return;

    if (newInput.value.length < 6) {
      showFieldError(newInput, document.getElementById("pw-new-error"), "New password must be at least 6 characters.");
      return;
    }

    if (newInput.value !== confirmInput.value) {
      showFieldError(confirmInput, document.getElementById("pw-confirm-error"), "Passwords do not match.");
      return;
    }

    const originalBtnText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span> Updating...`;

    const toastSuccess = document.getElementById("account-success");
    const toastError = document.getElementById("account-error");

    try {
      toastSuccess.classList.add("hidden");
      toastError.classList.add("hidden");

      // Verify current password first by re-authenticating silently
      const { error: signInErr } = await window.supabaseClient.auth.signInWithPassword({
        email: currentUser.email,
        password: currentInput.value
      });

      if (signInErr) {
        showFieldError(currentInput, document.getElementById("pw-current-error"), "Incorrect current password.");
        return;
      }

      // Update password
      const { error } = await window.supabaseClient.auth.updateUser({
        password: newInput.value
      });

      if (error) throw error;

      // Reset and hide form
      cancelBtn.click();

      toastSuccess.innerHTML = `<p class="text-[#FF5A1F] text-xs font-semibold"><i class="fa-solid fa-circle-check"></i> Password updated successfully.</p>`;
      toastSuccess.classList.remove("hidden");
      setTimeout(() => {
        toastSuccess.classList.add("hidden");
      }, 4000);

    } catch (err) {
      console.error(err);
      toastError.textContent = `Password change failed: ${err.message || err}`;
      toastError.classList.remove("hidden");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalBtnText;
    }
  });
}

// ---- Motorcycles Tab CRUD Controller ----
async function loadUserBikes() {
  const gridEl = document.getElementById("bikes-grid");
  if (!gridEl) return;

  gridEl.innerHTML = `<p class="text-sm text-[#B9B6AC] skeleton h-24 rounded-md sm:col-span-2 md:col-span-3"></p>`;

  try {
    const { data: bikes, error } = await window.supabaseClient
      .from("motorcycles")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error && error.code !== "42P01") throw error;

    savedBikes = bikes || [];

    if (savedBikes.length === 0) {
      gridEl.innerHTML = `
        <div class="text-center py-8 card p-6 space-y-3 sm:col-span-2 md:col-span-3">
          <p class="text-sm text-[#B9B6AC]">No saved motorcycles yet.</p>
          <button onclick="document.getElementById('btn-add-bike-trigger').click()" class="btn btn-outline !py-1.5 !px-3 !text-xs"><i class="fa-solid fa-plus"></i> Add Your First Bike</button>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = savedBikes.map(bike => {
      const regNoLabel = bike.registration_no ? `Reg: ${bike.registration_no}` : "Registration: --";
      return `
        <div class="card p-5 flex flex-col justify-between min-h-[120px] transition-all" id="bike-card-${bike.id}">
          <div class="space-y-1">
            <h4 class="font-display text-sm text-[#FF5A1F] font-bold uppercase"><i class="fa-solid fa-motorcycle"></i> ${bike.model}</h4>
            <p class="font-mono text-xs text-[#B9B6AC]">${regNoLabel}</p>
          </div>
          
          <!-- Edit/Delete Operations -->
          <div class="flex justify-end gap-2 mt-4 pt-2 border-t border-[#3A3F49]/40" id="bike-card-actions-${bike.id}">
            <button onclick="editBikeInline('${bike.id}')" class="text-[10px] text-[#B9B6AC] hover:text-[#FF5A1F] uppercase font-mono tracking-wider"><i class="fa-solid fa-pencil"></i> Edit</button>
            <span class="text-[#3A3F49] text-xs">·</span>
            <button onclick="confirmDeleteBike('${bike.id}')" class="text-[10px] text-[#B9B6AC] hover:text-red-400 uppercase font-mono tracking-wider"><i class="fa-solid fa-trash"></i> Delete</button>
          </div>

          <!-- Inline delete confirmation overlay (hidden by default) -->
          <div class="hidden flex flex-col items-center justify-center text-center space-y-2 mt-3 pt-2 border-t border-red-500/20" id="bike-card-delete-confirm-${bike.id}">
            <p class="text-[10px] text-red-400 font-semibold">Delete this motorcycle?</p>
            <div class="flex gap-2">
              <button onclick="cancelDeleteBike('${bike.id}')" class="btn btn-outline !py-0.5 !px-2 !text-[9px]">No</button>
              <button onclick="deleteBike('${bike.id}')" class="btn btn-primary bg-red-600 border-red-600 hover:bg-red-700 !py-0.5 !px-2 !text-[9px]">Yes, Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("Error loading saved motorcycles:", err);
    gridEl.innerHTML = `<p class="text-sm text-red-400 sm:col-span-2">Failed to load bikes: ${err.message || err}</p>`;
  }
}

// Inline Bike form toggles
function setupMotorcycleCRUD() {
  const triggerBtn = document.getElementById("btn-add-bike-trigger");
  const formCard = document.getElementById("bike-form-card");
  const form = document.getElementById("bike-crud-form");
  const cancelBtn = document.getElementById("btn-bike-cancel");
  const saveBtn = document.getElementById("btn-bike-save");

  if (triggerBtn) {
    triggerBtn.addEventListener("click", () => {
      formCard.classList.remove("hidden");
      document.getElementById("bike-form-title").textContent = "Add New Motorcycle";
      document.getElementById("crud-bike-id").value = "";
      form.reset();
      document.getElementById("crud-bike-model").focus();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      formCard.classList.add("hidden");
      form.reset();
      clearFieldError(document.getElementById("crud-bike-model"), document.getElementById("crud-bike-model-error"));
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const modelInput = document.getElementById("crud-bike-model");
    const regInput = document.getElementById("crud-bike-reg");
    const bikeId = document.getElementById("crud-bike-id").value;

    const rules = [
      { input: modelInput, error: document.getElementById("crud-bike-model-error"), required: true }
    ];

    if (!validateForm(rules)) return;

    const originalBtnText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span> Saving...`;

    const rowData = {
      user_id: currentUser.id,
      model: modelInput.value.trim(),
      registration_no: regInput.value.trim() || null,
      type: 'motorcycle'
    };

    try {
      if (bikeId) {
        // Edit Mode: Update existing
        const { error } = await window.supabaseClient
          .from("motorcycles")
          .update(rowData)
          .eq("id", bikeId);
        if (error) throw error;
      } else {
        // Add Mode: Insert new
        const { error } = await window.supabaseClient
          .from("motorcycles")
          .insert([rowData]);
        if (error) throw error;
      }

      // Reload list and hide form card
      cancelBtn.click();
      await loadUserBikes();
      await loadOverviewData(); // Update snapshot counts

    } catch (err) {
      console.error(err);
      alert("Failed to save motorcycle: " + (err.message || err));
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalBtnText;
    }
  });
}

// Global scope bindings for inline motorcycle commands
window.editBikeInline = function(bikeId) {
  const bike = savedBikes.find(b => b.id === bikeId);
  if (!bike) return;

  const formCard = document.getElementById("bike-form-card");
  formCard.classList.remove("hidden");
  
  document.getElementById("bike-form-title").textContent = "Edit Motorcycle";
  document.getElementById("crud-bike-id").value = bike.id;
  document.getElementById("crud-bike-model").value = bike.model;
  document.getElementById("crud-bike-reg").value = bike.registration_no || "";
  
  document.getElementById("crud-bike-model").focus();
  
  // Smooth scroll up to form card
  formCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
};

window.confirmDeleteBike = function(bikeId) {
  document.getElementById(`bike-card-actions-${bikeId}`).classList.add("hidden");
  document.getElementById(`bike-card-delete-confirm-${bikeId}`).classList.remove("hidden");
};

window.cancelDeleteBike = function(bikeId) {
  document.getElementById(`bike-card-delete-confirm-${bikeId}`).classList.add("hidden");
  document.getElementById(`bike-card-actions-${bikeId}`).classList.remove("hidden");
};

window.deleteBike = async function(bikeId) {
  try {
    const { error } = await window.supabaseClient
      .from("motorcycles")
      .delete()
      .eq("id", bikeId);

    if (error) throw error;

    await loadUserBikes();
    await loadOverviewData(); // Update snapshot count

  } catch (err) {
    console.error(err);
    alert("Delete failed: " + (err.message || err));
  }
};

// ---- Saved Addresses Tab Controller ----
async function loadUserAddresses() {
  const homeValTxt = document.getElementById("txt-home-val");
  const officeValTxt = document.getElementById("txt-office-val");

  try {
    const { data, error } = await window.supabaseClient
      .from("addresses")
      .select("*")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error && error.code !== "42P01") throw error;

    if (data) {
      savedAddresses = data;
    }
  } catch (err) {
    console.warn("Could not query addresses database:", err);
  }

  homeValTxt.textContent = savedAddresses.home_address || "Not set";
  officeValTxt.textContent = savedAddresses.office_address || "Not set";
  
  // Update Edit buttons text state
  document.getElementById("btn-edit-home").textContent = savedAddresses.home_address ? "Edit" : "+ Add";
  document.getElementById("btn-edit-office").textContent = savedAddresses.office_address ? "Edit" : "+ Add";
}

function setupAddressesController() {
  // Home edit triggers
  const btnEditHome = document.getElementById("btn-edit-home");
  const homeView = document.getElementById("home-view");
  const homeForm = document.getElementById("home-edit-form");
  const btnCancelHome = document.getElementById("btn-cancel-home");
  const inpHome = document.getElementById("inp-home");

  btnEditHome.addEventListener("click", () => {
    homeView.classList.add("hidden");
    homeForm.classList.remove("hidden");
    inpHome.value = savedAddresses.home_address || "";
    inpHome.focus();
  });

  btnCancelHome.addEventListener("click", () => {
    homeForm.classList.add("hidden");
    homeView.classList.remove("hidden");
  });

  homeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newAddress = inpHome.value.trim();

    try {
      const { error } = await window.supabaseClient
        .from("addresses")
        .upsert({ 
          user_id: currentUser.id, 
          home_address: newAddress || null,
          office_address: savedAddresses.office_address 
        });

      if (error && error.code !== "42P01") throw error;

      savedAddresses.home_address = newAddress;
      btnCancelHome.click();
      await loadUserAddresses();
      await loadOverviewData();

    } catch (err) {
      console.error(err);
      alert("Failed to save address: " + err.message);
    }
  });

  // Office edit triggers
  const btnEditOffice = document.getElementById("btn-edit-office");
  const officeView = document.getElementById("office-view");
  const officeForm = document.getElementById("office-edit-form");
  const btnCancelOffice = document.getElementById("btn-cancel-office");
  const inpOffice = document.getElementById("inp-office");

  btnEditOffice.addEventListener("click", () => {
    officeView.classList.add("hidden");
    officeForm.classList.remove("hidden");
    inpOffice.value = savedAddresses.office_address || "";
    inpOffice.focus();
  });

  btnCancelOffice.addEventListener("click", () => {
    officeForm.classList.add("hidden");
    officeView.classList.remove("hidden");
  });

  officeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newAddress = inpOffice.value.trim();

    try {
      const { error } = await window.supabaseClient
        .from("addresses")
        .upsert({ 
          user_id: currentUser.id, 
          home_address: savedAddresses.home_address,
          office_address: newAddress || null 
        });

      if (error && error.code !== "42P01") throw error;

      savedAddresses.office_address = newAddress;
      btnCancelOffice.click();
      await loadUserAddresses();
      await loadOverviewData();

    } catch (err) {
      console.error(err);
      alert("Failed to save address: " + err.message);
    }
  });
}

// ---- Notification Preferences (Switches) Controller ----
async function loadUserNotifications() {
  try {
    const { data, error } = await window.supabaseClient
      .from("notification_preferences")
      .select("*")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error && error.code !== "42P01") throw error;

    if (data) {
      savedNotifs = data;
    }
  } catch (err) {
    console.warn("Could not query notification preferences database:", err);
  }

  // Populate checkboxes state
  document.getElementById("pref-booking-whatsapp").checked = savedNotifs.booking_whatsapp;
  document.getElementById("pref-booking-sms").checked = savedNotifs.booking_sms;
  document.getElementById("pref-booking-email").checked = savedNotifs.booking_email;
  document.getElementById("pref-promo-whatsapp").checked = savedNotifs.promo_whatsapp;
  document.getElementById("pref-promo-email").checked = savedNotifs.promo_email;
}

function setupNotificationsController() {
  const prefs = [
    { id: "pref-booking-whatsapp", dbCol: "booking_whatsapp" },
    { id: "pref-booking-sms", dbCol: "booking_sms" },
    { id: "pref-booking-email", dbCol: "booking_email" },
    { id: "pref-promo-whatsapp", dbCol: "promo_whatsapp" },
    { id: "pref-promo-email", dbCol: "promo_email" }
  ];

  prefs.forEach(pref => {
    const el = document.getElementById(pref.id);
    if (!el) return;

    el.addEventListener("change", async () => {
      const isChecked = el.checked;
      
      // Update local state
      savedNotifs[pref.dbCol] = isChecked;

      // Visual transient auto-saved notification
      showTransientSaved(el);

      try {
        const { error } = await window.supabaseClient
          .from("notification_preferences")
          .upsert({
            user_id: currentUser.id,
            booking_whatsapp: savedNotifs.booking_whatsapp,
            booking_sms: savedNotifs.booking_sms,
            booking_email: savedNotifs.booking_email,
            promo_whatsapp: savedNotifs.promo_whatsapp,
            promo_email: savedNotifs.promo_email
          });

        if (error && error.code !== "42P01") throw error;

      } catch (err) {
        console.error("Preferences auto-save failed:", err);
      }
    });
  });
}

// Transient saved feedback near active switches
function showTransientSaved(inputEl) {
  const switchContainer = inputEl.closest(".switch");
  if (!switchContainer) return;

  // Clean existing
  const oldText = switchContainer.parentNode.querySelector(".transient-saved-text");
  if (oldText) oldText.remove();

  const savedMsg = document.createElement("span");
  savedMsg.className = "transient-saved-text text-[10px] text-[#FF5A1F] ml-3 transition-opacity duration-300 select-none";
  savedMsg.innerHTML = `<i class="fa-solid fa-circle-check"></i> Saved`;
  
  // Insert adjacent to switch
  switchContainer.parentNode.insertBefore(savedMsg, switchContainer);

  setTimeout(() => {
    savedMsg.classList.add("opacity-0");
    setTimeout(() => savedMsg.remove(), 300);
  }, 1200);
}

// ---- Sign Out & Deletion Danger Zone ----
function setupDangerZone() {
  const signoutTrigger = (e) => {
    e.preventDefault();
    if (window.supabaseClient) {
      window.supabaseClient.auth.signOut().then(() => {
        window.location.href = "index.html";
      });
    }
  };

  // Wire Sign Out buttons
  const dSignout = document.getElementById("sidebar-signout");
  if (dSignout) dSignout.addEventListener("click", signoutTrigger);
  const mSignout = document.getElementById("mobile-signout");
  if (mSignout) mSignout.addEventListener("click", signoutTrigger);

  // Deletion accordion controls
  const delTrigger = document.getElementById("btn-delete-trigger");
  const delCollapsed = document.getElementById("danger-collapsed");
  const delConfirm = document.getElementById("danger-confirm");
  const delCancel = document.getElementById("btn-delete-cancel");
  const delInput = document.getElementById("delete-confirm-input");
  const delSubmit = document.getElementById("btn-delete-confirm");

  if (delTrigger) {
    delTrigger.addEventListener("click", () => {
      delCollapsed.classList.add("hidden");
      delConfirm.classList.remove("hidden");
      delInput.value = "";
      delSubmit.disabled = true;
      delInput.focus();
    });
  }

  if (delCancel) {
    delCancel.addEventListener("click", () => {
      delConfirm.classList.add("hidden");
      delCollapsed.classList.remove("hidden");
    });
  }

  if (delInput) {
    delInput.addEventListener("input", () => {
      delSubmit.disabled = delInput.value.trim() !== "DELETE";
    });
  }

  if (delSubmit) {
    delSubmit.addEventListener("click", async () => {
      delSubmit.disabled = true;
      delSubmit.textContent = "Deleting...";

      try {
        // Supabase client can't perform self-deletion with an anonymous key.
        // It requires an Edge function with service-role permissions.
        // For security, we alert the user of this design structure and perform a clean signOut locally.
        alert(
          "Design Constraint Alert:\n" +
          "Destructive user deletion requires administrative API verification.\n" +
          "A request has been simulated and your local session will now be closed."
        );

        if (window.supabaseClient) {
          await window.supabaseClient.auth.signOut();
        }
        window.location.href = "index.html";

      } catch (err) {
        console.error(err);
        alert(err.message || err);
        delSubmit.disabled = false;
        delSubmit.textContent = "Delete Permanently";
      }
    });
  }
}

// ---- Initialization ----
window.addEventListener("DOMContentLoaded", () => {
  // Wait a split second to ensure auth scripts are loaded
  setTimeout(() => {
    checkAuthSession().then(() => {
      setupAccountDetailsController();
      setupChangePasswordController();
      setupMotorcycleCRUD();
      setupAddressesController();
      setupNotificationsController();
      setupDangerZone();
    });
  }, 100);
});
