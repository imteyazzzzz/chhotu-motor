/* =========================================================================
   CHHOTU MOTORCYCLES WORKSHOP — SHARED JS
   Loaded by every page. Handles: mobile nav, active-link highlighting,
   scroll-reveal animation, back-to-top button, lazy image loading,
   and WhatsApp link helpers. Page-specific form logic lives inline
   at the bottom of booking.html / contact.html.
   ========================================================================= */

const WHATSAPP_NUMBER = "9779813691072"; // +977 981 369 1072, no plus/spaces for wa.me

/**
 * Build a wa.me link with an encoded, context-specific prefilled message.
 * @param {string} message
 * @returns {string}
 */
function buildWhatsAppLink(message) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/* ---- Mobile hamburger menu (slide-in overlay) ---- */
function initMobileMenu() {
  const toggle = document.getElementById("nav-toggle");
  const overlay = document.getElementById("mobile-menu");
  const closeBtn = document.getElementById("nav-close");
  if (!toggle || !overlay) return;

  const open = () => {
    overlay.classList.remove("translate-x-full");
    overlay.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  };
  const close = () => {
    overlay.classList.add("translate-x-full");
    overlay.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };

  toggle.addEventListener("click", open);
  if (closeBtn) closeBtn.addEventListener("click", close);
  overlay.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
}

/* ---- Active nav-link highlighting for current page ---- */
function initActiveNav() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    const linkPath = link.getAttribute("href");
    if (linkPath === path || (path === "" && linkPath === "index.html")) {
      link.classList.add("active");
    }
  });
}

/* ---- Scroll-reveal animation via IntersectionObserver ---- */
function initScrollReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  items.forEach((el) => observer.observe(el));
}

/* ---- Back-to-top button ---- */
function initBackToTop() {
  const btn = document.getElementById("back-to-top");
  if (!btn) return;
  window.addEventListener("scroll", () => {
    if (window.scrollY > 480) btn.classList.add("show");
    else btn.classList.remove("show");
  });
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

/* ---- Lazy-load images: swap data-src into src when near viewport ---- */
function initLazyImages() {
  const imgs = document.querySelectorAll("img[data-src]");
  if (!imgs.length) return;

  if (!("IntersectionObserver" in window)) {
    imgs.forEach((img) => {
      img.src = img.getAttribute("data-src");
      img.classList.remove("lazy-ph");
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.getAttribute("data-src");
          img.addEventListener("load", () => img.classList.remove("lazy-ph"), { once: true });
          observer.unobserve(img);
        }
      });
    },
    { rootMargin: "150px" }
  );

  imgs.forEach((img) => observer.observe(img));
}

/* ---- Wire up every WhatsApp link that carries data-wa-message ---- */
function initWhatsAppLinks() {
  document.querySelectorAll("[data-wa-message]").forEach((el) => {
    const msg = el.getAttribute("data-wa-message");
    el.setAttribute("href", buildWhatsAppLink(msg));
  });
}

/* ---- Hide floating call and WhatsApp buttons when footer or cta-section is visible ---- */
function initFloatingButtonsVisibility() {
  const whatsappBtn = document.querySelector(".fab-whatsapp");
  const callBtn = document.querySelector(".fab-call");
  const targets = document.querySelectorAll("footer, .cta-section");

  if ((!whatsappBtn && !callBtn) || targets.length === 0) return;

  const hideButtons = () => {
    if (whatsappBtn) {
      whatsappBtn.style.opacity = "0";
      whatsappBtn.style.visibility = "hidden";
      whatsappBtn.style.pointerEvents = "none";
    }
    if (callBtn) {
      callBtn.style.opacity = "0";
      callBtn.style.visibility = "hidden";
      callBtn.style.pointerEvents = "none";
    }
  };

  const showButtons = () => {
    if (whatsappBtn) {
      whatsappBtn.style.opacity = "1";
      whatsappBtn.style.visibility = "visible";
      whatsappBtn.style.pointerEvents = "auto";
    }
    if (callBtn) {
      callBtn.style.opacity = "1";
      callBtn.style.visibility = "visible";
      callBtn.style.pointerEvents = "auto";
    }
  };

  if ("IntersectionObserver" in window) {
    const targetStates = new Map();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        targetStates.set(entry.target, entry.isIntersecting);
      });

      // Hide buttons if ANY observed target is intersecting
      const shouldHide = Array.from(targetStates.values()).some((state) => state === true);
      if (shouldHide) {
        hideButtons();
      } else {
        showButtons();
      }
    }, {
      root: null,
      threshold: 0,
      rootMargin: "0px"
    });

    targets.forEach((target) => {
      targetStates.set(target, false);
      observer.observe(target);
    });
  } else {
    // Fallback scroll detection
    window.addEventListener("scroll", () => {
      let shouldHide = false;
      targets.forEach((target) => {
        const rect = target.getBoundingClientRect();
        if (rect.top < window.innerHeight) {
          shouldHide = true;
        }
      });
      if (shouldHide) {
        hideButtons();
      } else {
        showButtons();
      }
    });
  }
}

/* ---- Testimonial Auto Scroll (mobile only) ---- */
function initTestimonialAutoScroll() {
  const slider = document.querySelector(".testimonial-slider");
  if (!slider) return;

  let autoScrollInterval;

  const startAutoScroll = () => {
    // Only auto-scroll on mobile viewports (< 768px)
    if (window.innerWidth >= 768) return;

    autoScrollInterval = setInterval(() => {
      const firstCard = slider.querySelector("blockquote");
      if (!firstCard) return;

      const cardWidth = firstCard.offsetWidth + 16; // card width + gap
      const maxScroll = slider.scrollWidth - slider.clientWidth;

      if (slider.scrollLeft >= maxScroll - 5) {
        slider.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        slider.scrollBy({ left: cardWidth, behavior: "smooth" });
      }
    }, 4000);
  };

  const stopAutoScroll = () => {
    clearInterval(autoScrollInterval);
  };

  startAutoScroll();

  // Pause on touch interaction to keep UX clean
  slider.addEventListener("touchstart", stopAutoScroll);
  slider.addEventListener("touchend", startAutoScroll);

  // Restart/re-evaluate on resize
  window.addEventListener("resize", () => {
    stopAutoScroll();
    startAutoScroll();
  });
}

/* ---- Emergency WhatsApp Auto Location Detection ---- */
function initEmergencyWhatsApp() {
  const triggers = document.querySelectorAll(".emergency-wa-trigger");
  if (triggers.length === 0) return;

  triggers.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();

      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
      }

      const originalText = btn.innerHTML;
      btn.style.pointerEvents = "none";
      
      // Determine if this is an icon-only trigger or text trigger
      const isIcon = btn.querySelector("i.fa-whatsapp") && !btn.innerText;
      if (isIcon) {
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;
      } else {
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Detecting location...`;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          let locationStr = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          
          try {
            // Reverse geocode via osm nominatim
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`, {
              headers: { "Accept-Language": "en" }
            });
            if (response.ok) {
              const data = await response.json();
              if (data && data.display_name) {
                locationStr = data.display_name;
              }
            }
          } catch (err) {
            console.error("Reverse geocoding failed for emergency WhatsApp", err);
          } finally {
            const finalMsg = `Hi Chhotu Motorcycles, I need EMERGENCY roadside help right now. My location: ${locationStr}`;
            window.open(buildWhatsAppLink(finalMsg), "_blank");
            btn.style.pointerEvents = "auto";
            btn.innerHTML = originalText;
          }
        },
        (error) => {
          console.error("Emergency Geolocation error:", error);
          let errorDesc = "Unable to retrieve your location.";
          if (error.code === error.PERMISSION_DENIED) {
            errorDesc = "Location permission denied. Please allow location access to request emergency roadside assistance.";
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errorDesc = "Location details unavailable. Please turn on your device's GPS/location services and try again.";
          } else if (error.code === error.TIMEOUT) {
            errorDesc = "Location request timed out. Please check your signal and try again.";
          }
          
          alert(errorDesc);
          btn.style.pointerEvents = "auto";
          btn.innerHTML = originalText;
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  });
}

/* ---- Emergency banner call/WhatsApp shortcuts already use tel: / wa.me directly in HTML ---- */

/* ---- Bootstrap ---- */
document.addEventListener("DOMContentLoaded", () => {
  initMobileMenu();
  initActiveNav();
  initScrollReveal();
  initBackToTop();
  initLazyImages();
  initWhatsAppLinks();
  initFloatingButtonsVisibility();
  initTestimonialAutoScroll();
  initEmergencyWhatsApp();
});
