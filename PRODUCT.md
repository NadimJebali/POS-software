# Product

## Register

product

## Users

Café and restaurant floor staff (cashiers, servers, and the owner/admin) operating a **fixed landscape touchscreen** cash-register terminal (~1366×850). They work fast, standing, one-handed, sometimes with greasy or gloved fingers, under variable ambient light. Tunisian market: prices in TND (millimes), UI in English, French, or Arabic (RTL).

## Product Purpose

A self-contained Electron POS for taking orders and getting paid: open a table, build an order, apply discounts, take payment (cash/card, split by item), print a receipt, and review history/analytics — plus admin (products, tables, users, settings) and an optional customer-facing second display. Success = the hot path (Floor → Order → Checkout → pay) is fast, unambiguous, and error-resistant under fingertip operation.

## Brand Personality

"Espresso & Ember" — warm, hospitable, confident, calm. Feels like a well-run café counter, not a sterile enterprise terminal: warm dark surfaces, ember-amber accents, a quiet ambient glow and film grain. Three words: **warm, assured, unfussy.**

## Anti-references

- A mouse-and-keyboard web admin dashboard shrunk onto a touchscreen (tiny controls, hover-dependent affordances, dense toolbars).
- Generic SaaS cool-grey/blue + the hero-metric template.
- Anything that needs precision pointing, hover to reveal, or close-packed tap targets.

## Design Principles

1. **Touch is the only input.** Every affordance is reachable and comfortable with a fingertip; nothing hides behind hover; primary actions sit where a thumb lands.
2. **The hot path is sacred.** Floor → Order → Checkout → pay is optimized for one-handed speed and zero ambiguity before any secondary screen.
3. **Money is unmistakable.** Always tabular figures, clear hierarchy, the total never in doubt.
4. **Holds in every language and direction.** Every change survives en/fr/ar and `dir="rtl"` with no truncation or mirrored-numpad mistakes.
5. **Build on the house style.** Extend Espresso & Ember; identity is preserved even as themes become selectable.

## Accessibility & Inclusion

- Tap targets ≥ ~44px, generous spacing, no hover-only reveals.
- Body/label text meets WCAG AA contrast (≥4.5:1) on dark surfaces; money and primary actions are high-contrast.
- Full RTL support; numeric keypads stay physically LTR.
- Motion is brief and state-conveying; honor `prefers-reduced-motion`.
- Selectable themes must each preserve these contrast guarantees.
