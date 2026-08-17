// =========================================================================
// CHHOTU MOTORCYCLES WORKSHOP — ADMIN PANELS CONTROLLER
// Handles role-based authentication guards, layout injections,
// live realtime badge counts, and shared database operations.
// =========================================================================

let currentAdmin = null;
let adminProfile = null;

// Run auth check immediately on script execution
checkAdminAuth();

async function checkAdminAuth() {
  const currentPage = window.location.pathname.split("/").pop() || "admin-dashboard.html";
  
  if (!window.supabaseClient) {
    console.error("Supabase client is not ready.");
    return;
  }

  try {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    
    if (!session || !session.user) {
      console.warn("No active admin session. Redirecting to auth.html...");
      window.location.href = `auth.html?redirect=${currentPage}`;
      return;
    }

    currentAdmin = session.user;
    
    // Fetch profile role check
    const { data: profile, error } = await window.supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", currentAdmin.id)
      .maybeSingle();

    if (error || !profile || !["admin", "staff"].includes(profile.role)) {
      console.error("Access denied: Not an administrator profile.", profile);
      window.location.href = "index.html";
      return;
    }

    adminProfile = profile;

    // Wait for DOM to load to inject layout
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => initAdminSuite(currentPage));
    } else {
      initAdminSuite(currentPage);
    }

  } catch (err) {
    console.error("Admin auth check failed:", err);
    window.location.href = "index.html";
  }
}

function initAdminSuite(pageName) {
  injectAdminLayout(pageName);
  initRealtimeCounters();
  setupTopbarActions();
}

function injectAdminLayout(pageName) {
  const sidebar = document.getElementById("admin-sidebar");
  const topbar = document.getElementById("admin-topbar");

  // Sidebar Injection
  if (sidebar) {
    const navItems = [
      { page: "admin-dashboard.html", icon: "fa-gauge-high", label: "Overview" },
      { page: "admin-bookings.html", icon: "fa-calendar-days", label: "Bookings", badgeId: "badge-bookings-count" },
      { page: "admin-emergency.html", icon: "fa-triangle-exclamation", label: "Emergency Queue", badgeId: "badge-emergency-count", pulse: true },
      { page: "admin-mechanics.html", icon: "fa-wrench", label: "Mechanics" },
      { page: "admin-customers.html", icon: "fa-users", label: "Customers" },
      { page: "admin-broadcast.html", icon: "fa-bullhorn", label: "Broadcast" },
      { page: "admin-settings.html", icon: "fa-sliders", label: "Settings" }
    ];

    const navLinksHTML = navItems.map(item => {
      const isActive = pageName === item.page;
      const activeClass = isActive 
        ? "border-l-2 border-[#FF5A1F] text-[#FF5A1F]" 
        : "border-l-2 border-transparent text-[#B9B6AC] hover:text-[#F4F1E8]";
      
      const badgeHTML = item.badgeId 
        ? `<span id="${item.badgeId}" class="hidden ml-auto px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FF5A1F] text-black ${item.pulse ? 'animate-pulse bg-red-600 text-white' : ''}">0</span>`
        : "";

      return `
        <a href="${item.page}" class="flex items-center gap-3 px-4 py-3 text-left font-display text-sm tracking-wider uppercase transition-all ${activeClass}">
          <i class="fa-solid ${item.icon} w-5"></i> ${item.label}
          ${badgeHTML}
        </a>
      `;
    }).join("");

    sidebar.innerHTML = `
      <div class="flex flex-col h-full justify-between">
        <div>
          <div class="p-6 border-b border-[#3A3F49] flex items-center justify-between">
            <span class="font-display font-semibold text-sm tracking-wide">CHHOTU <span class="text-[#FF5A1F]">ADMIN</span></span>
            <!-- Mobile Menu Close (Slide Drawer) -->
            <button id="admin-nav-close" class="lg:hidden text-[#B9B6AC] hover:text-[#F4F1E8] text-xl" aria-label="Close Admin Navigation">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <nav class="flex flex-col py-4" role="tablist" aria-label="Admin Operations Navigation">
            ${navLinksHTML}
          </nav>
        </div>
        <div class="p-4 border-t border-[#3A3F49]">
          <button id="admin-signout" class="flex items-center gap-3 px-4 py-3 text-left font-display text-sm tracking-wider uppercase text-red-400 hover:text-red-300 hover:bg-red-500/5 rounded w-full transition-all">
            <i class="fa-solid fa-right-from-bracket w-5"></i> Sign Out
          </button>
        </div>
      </div>
    `;

    // Handle Mobile Drawer Navigation close trigger
    const navCloseBtn = document.getElementById("admin-nav-close");
    if (navCloseBtn) {
      navCloseBtn.addEventListener("click", () => {
        sidebar.classList.add("hidden");
        sidebar.classList.remove("fixed", "inset-y-0", "left-0", "z-50", "w-[260px]");
      });
    }
  }

  // Topbar Injection
  if (topbar) {
    const formattedTitle = pageName.replace("admin-", "").replace(".html", "").replace("-", " ").toUpperCase();
    const initials = adminProfile && adminProfile.full_name
      ? adminProfile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2)
      : "AD";

    topbar.innerHTML = `
      <div class="flex items-center gap-3">
        <!-- Mobile Hamburger Trigger -->
        <button id="admin-nav-toggle" class="lg:hidden text-[#B9B6AC] hover:text-[#F4F1E8] text-xl w-10 h-10 flex items-center justify-center border border-[#3A3F49] rounded-md" aria-label="Open Admin Menu">
          <i class="fa-solid fa-bars"></i>
        </button>
        <h2 class="font-display text-lg font-bold tracking-wide">${formattedTitle}</h2>
      </div>
      
      <div class="flex items-center gap-4">
        <!-- Global Search -->
        <div class="relative hidden sm:block">
          <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#B9B6AC]">
            <i class="fa-solid fa-magnifying-glass text-xs"></i>
          </span>
          <input type="text" id="admin-global-search" class="bg-[#1B1E24] border border-[#3A3F49] text-xs rounded-md pl-9 pr-4 py-2 w-64 text-[#F4F1E8] focus:outline-none focus:border-[#FF5A1F]" placeholder="Search bookings...">
        </div>

        <!-- Admin Profile Info -->
        <div class="flex items-center gap-3">
          <div class="text-right hidden md:block">
            <p class="text-xs font-semibold text-[#F4F1E8]">${adminProfile ? adminProfile.full_name : "Administrator"}</p>
            <p class="text-[10px] text-[#B9B6AC] uppercase font-mono">${adminProfile ? adminProfile.role : "Staff"}</p>
          </div>
          <div class="w-9 h-9 rounded-full bg-[#FF5A1F]/15 text-[#FF5A1F] border border-[#FF5A1F]/30 flex items-center justify-center text-xs font-bold font-display uppercase">
            ${initials}
          </div>
        </div>
      </div>
    `;

    // Handle Mobile Hamburger Trigger
    const navToggleBtn = document.getElementById("admin-nav-toggle");
    if (navToggleBtn && sidebar) {
      navToggleBtn.addEventListener("click", () => {
        sidebar.classList.remove("hidden");
        sidebar.classList.add("fixed", "inset-y-0", "left-0", "z-50", "w-[260px]");
      });
    }
  }

  // Handle global sign out button actions
  const signOutBtn = document.getElementById("admin-signout");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      try {
        await window.supabaseClient.auth.signOut();
        window.location.href = "index.html";
      } catch (err) {
        console.error("Signout failed:", err);
      }
    });
  }
}

async function initRealtimeCounters() {
  if (!window.supabaseClient) return;

  // Initial fetch of unassigned/pending counts
  await updateSidebarBadges();

  // Subscribe to changes in the bookings table
  window.supabaseClient
    .channel("bookings-realtime-admin-badge")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "bookings" },
      async () => {
        await updateSidebarBadges();
      }
    )
    .subscribe();
}

async function updateSidebarBadges() {
  try {
    // 1. Fetch pending bookings count
    const { data: pendingB, error: pendingErr } = await window.supabaseClient
      .from("bookings")
      .select("id")
      .eq("status", "pending");

    if (!pendingErr && pendingB) {
      const bookingsBadge = document.getElementById("badge-bookings-count");
      if (bookingsBadge) {
        bookingsBadge.textContent = pendingB.length;
        if (pendingB.length > 0) {
          bookingsBadge.classList.remove("hidden");
        } else {
          bookingsBadge.classList.add("hidden");
        }
      }
    }

    // 2. Fetch unassigned emergency bookings count
    const { data: emergencyB, error: emergencyErr } = await window.supabaseClient
      .from("bookings")
      .select("id")
      .eq("service_type", "emergency")
      .eq("status", "pending");

    if (!emergencyErr && emergencyB) {
      const emergencyBadge = document.getElementById("badge-emergency-count");
      if (emergencyBadge) {
        emergencyBadge.textContent = emergencyB.length;
        if (emergencyB.length > 0) {
          emergencyBadge.classList.remove("hidden");
        } else {
          emergencyBadge.classList.add("hidden");
        }
      }
    }

  } catch (err) {
    console.warn("Could not query sidebar badge counts:", err);
  }
}

function setupTopbarActions() {
  const searchInput = document.getElementById("admin-global-search");
  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const query = searchInput.value.trim();
        if (query) {
          // Redirect to Bookings queue page with search param
          window.location.href = `admin-bookings.html?search=${encodeURIComponent(query)}`;
        }
      }
    });
  }
}
