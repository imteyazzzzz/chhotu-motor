---
name: Chhotu Garage Dark System
colors:
  surface: '#14161A'
  surface-dim: '#111317'
  surface-bright: '#1B1E24'
  surface-container-lowest: '#14161A'
  surface-container-low: '#181B21'
  surface-container: '#1B1E24'
  surface-container-high: '#22262E'
  surface-container-highest: '#2A2F38'
  on-surface: '#F4F1E8'
  on-surface-variant: '#B9B6AC'
  inverse-surface: '#F4F1E8'
  inverse-on-surface: '#14161A'
  outline: '#3A3F49'
  outline-variant: '#2D323B'
  surface-tint: '#FF5A1F'
  primary: '#FF5A1F'
  on-primary: '#14161A'
  primary-container: '#FF5A1F'
  on-primary-container: '#14161A'
  inverse-primary: '#C7440F'
  secondary: '#FFC530'
  on-secondary: '#14161A'
  secondary-container: '#FFC530'
  on-secondary-container: '#14161A'
  tertiary: '#25D366'
  on-tertiary: '#14161A'
  tertiary-container: '#10B981'
  on-tertiary-container: '#14161A'
  error: '#EF4444'
  on-error: '#FFFFFF'
  error-container: '#7F1D1D'
  on-error-container: '#FECACA'
  primary-fixed: '#FF8A5B'
  primary-fixed-dim: '#C7440F'
  on-primary-fixed: '#14161A'
  on-primary-fixed-variant: '#3D1303'
  secondary-fixed: '#FFE088'
  secondary-fixed-dim: '#CCA026'
  on-secondary-fixed: '#14161A'
  on-secondary-fixed-variant: '#423307'
  background: '#14161A'
  on-background: '#F4F1E8'
  surface-variant: '#22262E'
  hazard-orange: '#FF5A1F'
  hazard-yellow: '#FFC530'
  steel-border: '#3A3F49'
  steel-text: '#8C93A3'
  whatsapp-green: '#25D366'
typography:
  display-hero:
    fontFamily: Oswald
    fontSize: 60px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: 0.01em
  display-hero-mobile:
    fontFamily: Oswald
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.15'
  headline-lg:
    fontFamily: Oswald
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Oswald
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Oswald
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
  label-mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.1em
  label-mono-xs:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.14em
  readout-digit:
    fontFamily: JetBrains Mono
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1'
  button-text:
    fontFamily: Oswald
    fontSize: 15px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 1.5rem
  section-gap-mobile: 3.5rem
  section-gap-desktop: 7rem
  stack-sm: 0.5rem
  stack-md: 1rem
  stack-lg: 2rem
---

# Chhotu Motorcycles Workshop — Design System Specification

## 1. Brand & Aesthetic Philosophy
The **Chhotu Motorcycles Workshop** design system is engineered around **Industrial Garage-at-Night Utility & Emergency Precision**. It represents Kathmandu’s premier rapid-response mobile technical motorcycle squad and physical workshop.

- **Atmosphere:** Deep charcoal backgrounds evoking an active late-night workshop floor, high-contrast Safety Orange illumination, and emergency hazard stripes.
- **Ergonomics:** Purpose-built for roadside emergencies where users may be stranded in rain, direct daylight, or complete darkness on the ring road.
- **Tone:** Rugged, highly reliable, professional, and instant.

---

## 2. Color System & Design Tokens

### Dark Canvas & Surface Architecture
- **`--charcoal` (`#14161A`):** The absolute dark ground canvas across all pages.
- **`--surface-dim` (`#111317`):** Recessed canvas used for subtle alternating contrast.
- **`--charcoal-2` (`#1B1E24`):** Elevated cards, bento modules, dialog backgrounds, and dropzones.
- **`--charcoal-3` (`#22262E`):** Micro-surface containers, table row hovers, and disabled button state fills.
- **`--steel` (`#3A3F49`):** 1px structural borders and dividers that define cards without loud shadows.

### High-Voltage Accents & Functional Signals
- **`--orange` (`#FF5A1F`):** Signature Safety Orange. Used for primary conversion CTAs, active steps, brand logos, and status badges.
- **`--orange-hover` (`#FF6B37`):** Elevated hover glow state for buttons.
- **`--yellow` (`#FFC530`):** Hazard Yellow for 24/7 Emergency Roadside alerts, direct telephone call CTAs, and focus outlines.
- **`--status-error` (`#EF4444`):** Red alert banners, rejected payment warnings, and button error shake feedback.
- **`--status-success` (`#10B981`):** Green checkmarks, verified deposits, and completed service indicators.
- **`--whatsapp-green` (`#25D366`):** Direct WhatsApp floating action button and chat links.

### Text Contrast
- **`--off-white` (`#F4F1E8`):** Primary text with 100% legibility on dark surfaces.
- **`--off-white-dim` (`#B9B6AC`):** Secondary descriptions and helper labels.
- **`--steel-text` (`#8C93A3`):** Metadata, placeholders, and footer copyright text.

---

## 3. Typography & Hierarchy

1. **Display & Headings (`Oswald`):**
   - Industrial, condensed grotesque font loaded with uppercase letter-spacing (`0.01em` to `0.04em`).
   - Conveys urgency, mechanical precision, and structural authority.
2. **Body Copy (`Inter`):**
   - High-legibility neutral sans-serif with comfortable `1.6` line-height for effortless reading.
3. **Instrument Telemetry (`JetBrains Mono`):**
   - Fixed-pitch digital monospace used for dashboard readout counters (`.gauge .readout`), booking UUIDs (`#BK-XXXXXXXX`), timestamps, and status chips.

---

## 4. Signature Motifs

### A. The Hazard Stripe (`.hazard-stripe`)
- Diagonal 135° repeating stripes in Safety Orange and dark carbon.
- Framed at top banners, section dividers, and modal headers.

### B. Dashboard Readout Gauges (`.gauge`)
- Card modules inspired by motorcycle digital LCD clusters. Monospace glowing digits backlit by radial orange gradients.

### C. Morph State Buttons (`.bsm-btn`)
- State machine buttons that transition from:
  - **Idle:** Subtle sheen sweep.
  - **Loading:** Spinning circular gradient.
  - **Success:** Green morph with drawn checkmark and spark ring.
  - **Error:** Red shake animation with exclamation feedback.

---

## 5. Component Standards

### 1. Buttons
- **Primary CTA (`.btn-primary`):** `#FF5A1F` solid fill, `#14161A` text, min-height `48px`.
- **Emergency Call (`.btn-call`):** `#FFC530` solid fill with phone icon.
- **Outline (`.btn-outline`):** Transparent background with `2px solid #3A3F49` border, hovering to `#FF5A1F`.
- **Dimmed (`.btn-dimmed`):** `#22262E` fill with `#8C93A3` text when required fields are missing.

### 2. Form Inputs
- 1px `#3A3F49` border on `#14161A` base.
- High-contrast focus state with `#FF5A1F` border glow or `#FFC530` focus ring.
- Immediate inline error alerts below missing fields in `#EF4444`.

### 3. Step Timeline
- Numbered circular beads connected by progress tracks.
- Active step glows with pulsing orange aura; completed steps render with bold checkmarks.

### 4. Floating Action Buttons (FABs)
- Fixed at viewport bottom-right: WhatsApp chat (`#25D366`), Call hotline (`#FFC530`), and smooth Back-To-Top trigger.

---

## 6. Full Website Audit Summary

| Page | Primary Purpose | Key Components & State Systems |
|---|---|---|
| **`index.html`** | Workshop Homepage | Hero with 24/7 hotline, Gauges, Bento Grid Services, "By The Numbers" Stats Counter, Floating WhatsApp FAB. |
| **`booking.html`** | Service Booking & Payment | 3-Step Flow: Brand/Model auto-filler, Slot picker, Live QR Scanner, Proof Upload Dropzone, LocalStorage Cache. |
| **`tracking.html`** | Real-Time Repair Tracker | UUID/Phone lookup, Live status timeline, Realtime Supabase listener, Invoice viewer, WhatsApp support trigger. |
| **`services.html`** | Service Catalog | Detailed breakdowns of Emergency Roadside, Home Visits, and Workshop Appointments. |
| **`about.html`** | Brand Heritage & Crew | Workshop story, master mechanic profiles, tooling standards, live experience counters. |
| **`contact.html`** | Direct Dispatch Center | Kathmandu workshop geolocation, quick message form, direct one-tap calling & WhatsApp. |
| **`auth.html`** | Authentication & Account | Sign In, Sign Up, Password recovery, automatic guest booking claim & role-based dashboard redirection. |
| **`profile.html`** | Customer Portal | Active repair tracker, booking history, saved motorcycles CRUD, saved addresses, notification toggles. |
| **`admin-*.html`** | Admin Command Center | Real-time booking triage, payment verification & OCR inspection, mechanic dispatch, customer CRM. |
| **`job.html`** | Mechanic Mobile Portal | Field mechanic job execution view, status toggle (En Route, In Progress, Completed), invoice itemizer, payment collector. |
