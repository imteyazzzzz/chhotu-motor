// =========================================================================
// CHHOTU MOTORCYCLES WORKSHOP — AUTH HEADER HELPER
// Handles dynamic sign-in/sign-out visual states in the header.
// =========================================================================

async function updateAuthHeader() {
  if (!window.supabaseClient) return;

  try {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    
    // Find desktop nav container
    const nav = document.querySelector("nav[aria-label='Primary']");
    const mobileNav = document.querySelector("nav[aria-label='Mobile Primary']");

    if (!nav || !mobileNav) return;

    if (session && session.user) {
      // 1. Desktop Nav Update
      // Add "My Repairs" tracking link if it doesn't exist
      if (!document.getElementById("nav-tracking")) {
        const trackLink = document.createElement("a");
        trackLink.id = "nav-tracking";
        trackLink.href = "tracking.html";
        trackLink.className = "nav-link";
        trackLink.setAttribute("data-nav-link", "");
        trackLink.textContent = "My Repairs";
        nav.appendChild(trackLink);
      }
      
      // Add "Sign Out" button/link
      if (!document.getElementById("nav-signout")) {
        const signoutLink = document.createElement("a");
        signoutLink.id = "nav-signout";
        signoutLink.href = "#";
        signoutLink.className = "nav-link !text-red-400 hover:!text-red-300";
        signoutLink.textContent = "Sign Out";
        signoutLink.addEventListener("click", async (e) => {
          e.preventDefault();
          const { error } = await window.supabaseClient.auth.signOut();
          if (error) alert("Error signing out: " + error.message);
          window.location.reload();
        });
        nav.appendChild(signoutLink);
      }

      // 2. Mobile Nav Update
      if (!document.getElementById("m-nav-tracking")) {
        const mTrackLink = document.createElement("a");
        mTrackLink.id = "m-nav-tracking";
        mTrackLink.href = "tracking.html";
        mTrackLink.className = "nav-link";
        mTrackLink.textContent = "My Repairs";
        mobileNav.insertBefore(mTrackLink, mobileNav.querySelector(".btn-call"));
      }

      if (!document.getElementById("m-nav-signout")) {
        const mSignoutLink = document.createElement("a");
        mSignoutLink.id = "m-nav-signout";
        mSignoutLink.href = "#";
        mSignoutLink.className = "nav-link !text-red-400";
        mSignoutLink.textContent = "Sign Out";
        mSignoutLink.addEventListener("click", async (e) => {
          e.preventDefault();
          await window.supabaseClient.auth.signOut();
          window.location.reload();
        });
        mobileNav.insertBefore(mSignoutLink, mobileNav.querySelector(".btn-call"));
      }

      // If we are on auth.html, redirect logged-in users
      if (window.location.pathname.endsWith("auth.html")) {
        window.location.href = "booking.html";
      }

    } else {
      // User is guest
      // Add "Sign In" link
      if (!document.getElementById("nav-signin")) {
        const signinLink = document.createElement("a");
        signinLink.id = "nav-signin";
        signinLink.href = "auth.html";
        signinLink.className = "nav-link";
        signinLink.setAttribute("data-nav-link", "");
        signinLink.textContent = "Sign In";
        nav.appendChild(signinLink);
      }

      if (!document.getElementById("m-nav-signin")) {
        const mSigninLink = document.createElement("a");
        mSigninLink.id = "m-nav-signin";
        mSigninLink.href = "auth.html";
        mSigninLink.className = "nav-link";
        mSigninLink.textContent = "Sign In";
        mobileNav.insertBefore(mSigninLink, mobileNav.querySelector(".btn-call"));
      }
    }

    // Run nav active-highlighting again to account for newly added links
    if (typeof initActiveNav === "function") {
      initActiveNav();
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
