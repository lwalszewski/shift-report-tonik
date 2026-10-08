# Shift Report

Night-shift incident capture prototype for venue managers. Run: `npx serve -l 4174` from this folder, open `index.html`.

Built: live capture, attention queue, accepted stack, pre-submit review, closed view. Stubbed: View report, backend, auth.

Scoped as an 8h design exploration. Next: real extraction model, mobile pass, production token handoff.

## Structure

- `index.html` – product prototype (capture, review, pre-submit, closed view).
- `ds.html` – starting-point component sketch, intentionally not kept in sync. Current patterns live in `index.html` and `css/shift-report.css`.
- `css/shift-report.css` – style entry; imports the files below.
- `css/tokens.css` – design tokens (color, spacing, type, motion).
- `css/base.css` – reset, typography utilities, page shell.
- `css/components.css` – buttons, cards, inputs, review panel, modals.
- `css/product.css` – product layout (topbar, workspace, pre-submit, submitted).
- `js/review-queue.js` – attention queue, accepted stack, live detection routing, panel sync.
- `js/capture-detect.js` – shift notes capture, rule-based detection, status line.
- `js/pre-submit-review.js` – pre-submit sentence review and incident confirmation.
- `js/app.js` – navigation, theme, submit flow, submitted view, dev shortcuts.
