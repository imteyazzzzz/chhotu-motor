/**
 * Goo Drag Toggle (GTG) Component Controller
 * Multi-instance, touch-friendly, physics-based custom toggle switch.
 * Syncs visually with underlying hidden checkboxes and handles auto-flipping states.
 */
document.addEventListener("DOMContentLoaded", () => {
  initGooDragToggles();
});

function initGooDragToggles() {
  const svgFilterHTML = `
    <svg class="gtg-filter" aria-hidden="true" style="position: absolute; width: 0; height: 0; pointer-events: none;">
      <defs>
        <filter id="gtgGoo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b"/>
          <feColorMatrix in="b" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -9"/>
        </filter>
      </defs>
    </svg>
  `;
  if (!document.querySelector(".gtg-filter")) {
    document.body.insertAdjacentHTML("afterbegin", svgFilterHTML);
  }

  const toggles = document.querySelectorAll(".gtg-container");
  toggles.forEach(container => {
    const checkbox = container.querySelector("input[type='checkbox']");
    const btn = container.querySelector(".gtg");
    if (!btn || !checkbox) return;

    const knob = btn.querySelector(".gtg-knob");
    const tail = btn.querySelector(".gtg-tail");
    const reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    const W = 104;
    const PAD = 26;
    const MIN = PAD;
    const MAX = W - PAD;

    let on = checkbox.checked;
    let pos = on ? MAX : MIN;
    let vel = 0;
    let tailPos = pos;
    let dragging = false;
    let dragX = 0;
    let userActive = false;
    let lastTouch = 0;

    btn.classList.toggle("gtg--on", on);
    btn.setAttribute("aria-checked", on ? "true" : "false");

    function apply() {
      knob.style.transform = `translateX(${pos.toFixed(1)}px)`;
      tailPos += (pos - tailPos) * 0.42;
      tail.style.transform = `translateX(${tailPos.toFixed(1)}px)`;
    }

    function setOn(v, byUser = false) {
      if (byUser) {
        userActive = true;
        lastTouch = Date.now();
      }
      if (on !== v) {
        on = v;
        checkbox.checked = v;
        btn.classList.toggle("gtg--on", v);
        btn.setAttribute("aria-checked", v ? "true" : "false");
        
        if (byUser) {
          checkbox.dispatchEvent(new Event("change"));
        }
      }
    }

    function syncState() {
      if (checkbox.checked !== on) {
        on = checkbox.checked;
        btn.classList.toggle("gtg--on", on);
        btn.setAttribute("aria-checked", on ? "true" : "false");
        if (reduced) {
          pos = on ? MAX : MIN;
          apply();
        }
      }
    }

    // Sync from database/external scripts updating the checkbox directly
    let lastChecked = checkbox.checked;
    setInterval(() => {
      if (checkbox.checked !== lastChecked) {
        lastChecked = checkbox.checked;
        syncState();
      }
    }, 100);

    function frame() {
      if (!dragging) {
        const target = on ? MAX : MIN;
        vel += (target - pos) * 0.16;
        vel *= 0.78;
        pos += vel;
      }
      apply();
      requestAnimationFrame(frame);
    }

    btn.addEventListener("pointerdown", (e) => {
      userActive = true;
      lastTouch = Date.now();
      dragging = true;
      vel = 0;
      dragX = e.clientX - btn.getBoundingClientRect().left - pos;
      if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
    });

    btn.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const x = e.clientX - btn.getBoundingClientRect().left - dragX;
      const next = Math.max(MIN, Math.min(MAX, x));
      vel = next - pos;
      pos = next;
    });

    function release() {
      if (!dragging) return;
      dragging = false;
      lastTouch = Date.now();
      const predicted = pos + vel * 6;
      setOn(predicted > (MIN + MAX) / 2, true);
    }

    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);

    btn.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        userActive = true;
        lastTouch = Date.now();
        setOn(!on, true);
      }
    });

    let downAt = 0;
    btn.addEventListener("pointerdown", () => {
      downAt = pos;
    });

    btn.addEventListener("pointerup", () => {
      if (Math.abs(pos - downAt) < 4) {
        setOn(!on, true);
      }
    });

    if (reduced) {
      pos = on ? MAX : MIN;
      apply();
    } else {
      apply();
      requestAnimationFrame(frame);
    }
  });
}
