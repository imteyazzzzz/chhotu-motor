/**
 * Morph Button Global Decorator
 * Automatically upgrades standard .btn components to the premium Morph Button design
 * while preserving all original attributes, events, and layouts.
 */

if (document.readyState === "interactive" || document.readyState === "complete") {
  initMorphButtons();
} else {
  document.addEventListener("DOMContentLoaded", () => {
    initMorphButtons();
  });
}

function initMorphButtons() {
  // Add SVG filter defs globally if not present
  const filterHTML = `
    <svg class="bsm-filter" aria-hidden="true" style="position: absolute; width: 0; height: 0; pointer-events: none;">
      <defs></defs>
    </svg>
  `;
  if (!document.querySelector(".bsm-filter")) {
    document.body.insertAdjacentHTML("afterbegin", filterHTML);
  }

  // Target all .btn elements (excluding small specific controllers like mobile hamburgers, sliders, etc.)
  const buttons = document.querySelectorAll(".btn:not([data-morph-initialized])");
  buttons.forEach(btn => {
    // Avoid double initialization
    btn.setAttribute("data-morph-initialized", "true");

    // Skip utility elements
    if (btn.classList.contains("gtg") || btn.id === "back-to-top" || btn.id === "nav-toggle" || btn.id === "nav-close") return;

    // Get original content, attributes, and styles
    const originalHTML = btn.innerHTML;
    const btnText = btn.textContent.trim() || "Action";
    
    // Create inline wrapper
    const wrap = document.createElement("span");
    wrap.className = "bsm-wrap-inline";

    const cell = document.createElement("span");
    cell.className = "bsm-cell";

    // Transfer layout, flex, grid, margin, width, order classes to wrap and cell
    const layoutClassPatterns = [
      /^flex-/, /^sm:flex-/, /^md:flex-/, /^lg:flex-/,
      /^w-/, /^sm:w-/, /^md:w-/, /^lg:w-/,
      /^min-w-/, /^max-w-/,
      /^order-/, /^sm:order-/, /^md:order-/, /^lg:order-/,
      /^grow/, /^shrink/, /^self-/,
      /^(m|mx|my|mt|mb|ml|mr)-/,
      /^col-span-/, /^row-span-/
    ];

    btn.classList.forEach(cls => {
      if (layoutClassPatterns.some(p => p.test(cls))) {
        wrap.classList.add(cls);
        cell.classList.add(cls);
      }
    });

    if (btn.classList.contains("flex-1") || btn.classList.contains("w-full")) {
      wrap.classList.add("w-full");
      cell.classList.add("w-full");
    }

    // Insert wrapper into DOM
    btn.parentNode.insertBefore(wrap, btn);
    wrap.appendChild(cell);
    cell.appendChild(btn);

    // Aura and spark ring
    cell.insertAdjacentHTML("afterbegin", `
      <span class="bsm-aura" aria-hidden="true"></span>
      <span class="bsm-spark-ring" aria-hidden="true">
        <i class="bsm-spark" style="--bsm-a:12deg"></i>
        <i class="bsm-spark bsm-spark-ok" style="--bsm-a:72deg"></i>
        <i class="bsm-spark" style="--bsm-a:132deg"></i>
        <i class="bsm-spark bsm-spark-ok" style="--bsm-a:192deg"></i>
        <i class="bsm-spark" style="--bsm-a:252deg"></i>
        <i class="bsm-spark bsm-spark-ok" style="--bsm-a:312deg"></i>
      </span>
    `);

    // Live status region
    const live = document.createElement("span");
    live.className = "bsm-live";
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    wrap.appendChild(live);

    // Set morph classes on button
    btn.classList.add("bsm-btn");
    btn.setAttribute("data-state", "idle");

    // Determine context-based loading text
    let loadingText = "Sending";
    if (btn.id === "b-submit" || btn.id === "btn-reupload-submit") loadingText = "Uploading";
    else if (btnText.toLowerCase().includes("save")) loadingText = "Saving";
    else if (btnText.toLowerCase().includes("search") || btn.id === "lookup-btn") loadingText = "Searching";
    else if (btnText.toLowerCase().includes("login") || btnText.toLowerCase().includes("sign")) loadingText = "Verifying";
    else if (btnText.toLowerCase().includes("book")) loadingText = "Processing";

    // Set inside structure
    const updateInnerMarkup = (content) => {
      btn.innerHTML = `
        <span class="bsm-ripple" aria-hidden="true"></span>
        <span class="bsm-sheen" aria-hidden="true"></span>
        <span class="bsm-stack">
          <span class="bsm-face bsm-face-idle">
            <span class="bsm-txt">${content}</span>
          </span>
          <span class="bsm-face bsm-face-load" aria-hidden="true">
            <span class="bsm-spinner"></span>
            <span class="bsm-txt bsm-txt-shim">${loadingText}</span>
          </span>
          <span class="bsm-face bsm-face-done" aria-hidden="true">
            <svg class="bsm-check" viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
              <path class="bsm-check-p" d="M5 12.5l4.3 4.4L19 7.2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="bsm-txt">Done</span>
          </span>
          <span class="bsm-face bsm-face-error" aria-hidden="true">
            <svg class="bsm-error-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span class="bsm-txt bsm-txt-error">Failed</span>
          </span>
        </span>
      `;
    };

    updateInnerMarkup(originalHTML);

    // Watch for attributes (like disabled, to auto-trigger loading state) and innerHTML changes from external JS
    let isMutatingSelf = false;
    const observer = new MutationObserver((mutations) => {
      if (isMutatingSelf) return;

      mutations.forEach(mutation => {
        if (mutation.type === "attributes" && mutation.attributeName === "disabled") {
          const isDisabled = btn.disabled;
          const currentState = btn.getAttribute("data-state");

          if (isDisabled && currentState === "idle") {
            btn.setAttribute("data-state", "loading");
            if (live) live.textContent = `${loadingText}...`;
          } else if (!isDisabled && currentState === "loading") {
            // Check if there was an error in the form or error container
            const form = btn.closest("form");
            const hasError = form && (
              form.querySelector(".field-error.show") ||
              form.querySelector(".error-box:not(.hidden)") ||
              document.querySelector("#auth-error:not(.hidden)") ||
              document.querySelector("#b-error:not(.hidden)")
            );

            if (hasError) {
              btn.setAttribute("data-state", "error");
              if (live) live.textContent = "Failed";
              setTimeout(() => {
                isMutatingSelf = true;
                btn.setAttribute("data-state", "idle");
                if (live) live.textContent = "";
                isMutatingSelf = false;
              }, 2000);
            } else {
              isMutatingSelf = true;
              btn.setAttribute("data-state", "idle");
              if (live) live.textContent = "";
              isMutatingSelf = false;
            }
          }
        }
      });
    });

    observer.observe(btn, { attributes: true, attributeFilter: ["disabled"] });

    // Handle standard click/hover/sheen animations
    let engaged = false;
    let running = false;
    let autoTimer = null;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const cancelAuto = () => { if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; } };
    const scheduleAuto = (delay) => {
      cancelAuto();
      if (reduce) return;
      autoTimer = setTimeout(function tick() {
        autoTimer = null;
        if (reduce || engaged || running) return;
        if (document.hidden) { autoTimer = setTimeout(tick, 800); return; }
        
        // Sheen animation triggers
        btn.setAttribute("data-state", "idle");
        scheduleAuto(4600);
      }, delay);
    };

    btn.addEventListener("click", () => {
      // Create transient ripple at pointer coordinates
      const ripple = btn.querySelector(".bsm-ripple");
      if (ripple) {
        ripple.style.opacity = "1";
        ripple.style.transform = "scale(5.6)";
        setTimeout(() => {
          ripple.style.opacity = "0";
          ripple.style.transform = "scale(0.3)";
        }, 850);
      }

      // Submit loading visual transition if form triggers
      if (btn.type === "submit" && btn.getAttribute("data-state") === "idle") {
        setTimeout(() => {
          if (btn.disabled) {
            btn.setAttribute("data-state", "loading");
          }
        }, 50);
      }
    });

    btn.addEventListener("pointerenter", () => { engaged = true; cancelAuto(); });
    btn.addEventListener("pointerleave", () => { engaged = false; scheduleAuto(3000); });
    btn.addEventListener("focus", () => { engaged = true; cancelAuto(); });
    btn.addEventListener("blur", () => { engaged = false; scheduleAuto(3000); });

    scheduleAuto(1000);
  });
}

window.setMorphButtonState = function(btn, state, customText) {
  if (!btn) return;
  const live = btn.parentElement?.parentElement?.querySelector(".bsm-live");
  const errorTxtEl = btn.querySelector(".bsm-face-error .bsm-txt-error");
  const doneTxtEl = btn.querySelector(".bsm-face-done .bsm-txt");

  if (state === "loading") {
    btn.setAttribute("data-state", "loading");
    if (live) live.textContent = customText || "Loading...";
  } else if (state === "success") {
    if (customText && doneTxtEl) doneTxtEl.textContent = customText;
    btn.setAttribute("data-state", "success");
    if (live) live.textContent = customText || "Done";
    setTimeout(() => {
      btn.setAttribute("data-state", "idle");
      if (live) live.textContent = "";
    }, 1800);
  } else if (state === "error") {
    if (customText && errorTxtEl) errorTxtEl.textContent = customText;
    btn.setAttribute("data-state", "error");
    if (live) live.textContent = customText || "Failed";
    setTimeout(() => {
      btn.setAttribute("data-state", "idle");
      if (live) live.textContent = "";
    }, 2000);
  } else {
    btn.setAttribute("data-state", "idle");
    if (live) live.textContent = "";
  }
};
