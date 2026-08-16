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
      
      // 1. Desktop Buttons
      if (dBtnAuth) {
        dBtnAuth.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i> Sign Out`;
        dBtnAuth.href = "#";
        dBtnAuth.className = "btn btn-outline !py-2 !px-4 !text-xs !text-red-400 border-red-500/40 hover:!text-red-300 hover:bg-red-500/10";
        dBtnAuth.onclick = async (e) => {
          e.preventDefault();
          const { error } = await window.supabaseClient.auth.signOut();
          if (error) alert("Error signing out: " + error.message);
          window.location.reload();
        };
      }
      if (dBtnTrack) {
        dBtnTrack.innerHTML = `<i class="fa-solid fa-route"></i> My Repairs`;
        dBtnTrack.href = "tracking.html";
        dBtnTrack.className = "btn btn-primary !py-2 !px-4 !text-xs";
      }

      // 2. Mobile Buttons
      if (mBtnAuth) {
        mBtnAuth.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i> Sign Out`;
        mBtnAuth.href = "#";
        mBtnAuth.className = "btn btn-outline w-full text-center !text-red-400 border-red-500/40 hover:bg-red-500/10";
        mBtnAuth.onclick = async (e) => {
          e.preventDefault();
          const { error } = await window.supabaseClient.auth.signOut();
          if (error) alert("Error signing out: " + error.message);
          window.location.reload();
        };
      }
      if (mBtnTrack) {
        mBtnTrack.innerHTML = `<i class="fa-solid fa-route"></i> My Repairs`;
        mBtnTrack.href = "tracking.html";
        mBtnTrack.className = "btn btn-primary w-full text-center";
      }

      // Redirect logged-in users away from the auth page
      if (window.location.pathname.endsWith("auth.html")) {
        window.location.href = "booking.html";
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
