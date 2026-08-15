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

/* ---- Hide floating call and WhatsApp buttons when footer is visible ---- */
function initFloatingButtonsVisibility() {
  const whatsappBtn = document.querySelector(".fab-whatsapp");
  const callBtn = document.querySelector(".fab-call");
  const footer = document.querySelector("footer");

  if (!whatsappBtn && !callBtn) return;

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

  if ("IntersectionObserver" in window && footer) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          hideButtons();
        } else {
          showButtons();
        }
      });
    }, {
      root: null,
      threshold: 0, // Trigger as soon as the footer enters the viewport
      rootMargin: "0px"
    });
    observer.observe(footer);
  } else {
    // Fallback scroll detection
    window.addEventListener("scroll", () => {
      if (!footer) return;
      const footerRect = footer.getBoundingClientRect();
      if (footerRect.top < window.innerHeight) {
        hideButtons();
      } else {
        showButtons();
      }
    });
  }
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
});
