// =========================================================================
// CHHOTU MOTORCYCLES WORKSHOP — AUTH HEADER HELPER
// Handles dynamic sign-in/sign-out visual states in the header buttons.
// =========================================================================

async function updateAuthHeader() {
  if (!window.supabaseClient) return;

  try {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    
    const dBtnAuth = document.getElementById("d-btn-auth");
    const dBtnTrack = document.getElementById("d-btn-track");
    const mBtnAuth = document.getElementById("m-btn-auth");
    const mBtnTrack = document.getElementById("m-btn-track");

    if (session && session.user) {
      // USER IS LOGGED IN
      
      // Determine destination dashboard based on role
      let targetDashboard = "profile.html";
      try {
        const { data: profile } = await window.supabaseClient
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();
        if (profile && (profile.role === "admin" || profile.role === "staff")) {
          targetDashboard = "admin-dashboard.html";
        }
      } catch(_) {}
      
      // 1. Desktop Buttons
      if (dBtnAuth) {
        dBtnAuth.innerHTML = `<i class="fa-solid fa-user"></i> ${targetDashboard === "admin-dashboard.html" ? "Dashboard" : "My Profile"}`;
        dBtnAuth.href = targetDashboard;
        dBtnAuth.className = "btn btn-primary !py-2 !px-4 !text-xs";
        dBtnAuth.onclick = null;
      }
      if (dBtnTrack) {
        dBtnTrack.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i> Sign Out`;
        dBtnTrack.href = "#";
        dBtnTrack.className = "btn btn-outline !py-2 !px-4 !text-xs !text-red-400 border-red-500/40 hover:!text-red-300 hover:bg-red-500/10";
        dBtnTrack.onclick = async (e) => {
          e.preventDefault();
          const { error } = await window.supabaseClient.auth.signOut();
          if (error) alert("Error signing out: " + error.message);
          window.location.reload();
        };
      }

      // 2. Mobile Buttons
      if (mBtnAuth) {
        mBtnAuth.innerHTML = `<i class="fa-solid fa-user"></i> ${targetDashboard === "admin-dashboard.html" ? "Dashboard" : "My Profile"}`;
        mBtnAuth.href = targetDashboard;
        mBtnAuth.className = "btn btn-primary w-full text-center";
        mBtnAuth.onclick = null;
      }
      if (mBtnTrack) {
        mBtnTrack.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i> Sign Out`;
        mBtnTrack.href = "#";
        mBtnTrack.className = "btn btn-outline w-full text-center !text-red-400 border-red-500/40 hover:bg-red-500/10";
        mBtnTrack.onclick = async (e) => {
          e.preventDefault();
          const { error } = await window.supabaseClient.auth.signOut();
          if (error) alert("Error signing out: " + error.message);
          window.location.reload();
        };
      }

      // Redirect logged-in users away from the auth page
      if (window.location.pathname.endsWith("auth.html")) {
        // If there's a redirect query parameter, use it
        const redirectParam = new URLSearchParams(window.location.search).get("redirect");
        window.location.href = redirectParam || (targetDashboard === "admin-dashboard.html" ? "admin-dashboard.html" : "booking.html");
      }

    } else {
      // USER IS GUEST / LOGGED OUT
      
      // 1. Desktop Buttons
      if (dBtnAuth) {
        dBtnAuth.innerHTML = `<i class="fa-solid fa-user-plus"></i> Sign In / Sign Up`;
        dBtnAuth.href = "auth.html";
        dBtnAuth.className = "btn btn-outline !py-2 !px-4 !text-xs";
        dBtnAuth.onclick = null;
      }
      if (dBtnTrack) {
        dBtnTrack.innerHTML = `<i class="fa-solid fa-route"></i> Track Booking`;
        dBtnTrack.href = "tracking.html";
        dBtnTrack.className = "btn btn-primary !py-2 !px-4 !text-xs";
      }

      // 2. Mobile Buttons
      if (mBtnAuth) {
        mBtnAuth.innerHTML = `<i class="fa-solid fa-user-plus"></i> Sign In / Sign Up`;
        mBtnAuth.href = "auth.html";
        mBtnAuth.className = "btn btn-primary w-full text-center";
        mBtnAuth.onclick = null;
      }
      if (mBtnTrack) {
        mBtnTrack.innerHTML = `<i class="fa-solid fa-route"></i> Track Booking`;
        mBtnTrack.href = "tracking.html";
        mBtnTrack.className = "btn btn-outline w-full text-center";
      }
    }

  } catch (err) {
    console.error("Error updating auth header:", err);
  }
}

// Run when scripts are ready
window.addEventListener("DOMContentLoaded", () => {
  // Wait brief moment for supabaseClient to initialize
  setTimeout(updateAuthHeader, 100);
});
