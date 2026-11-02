# Design QA

final result: passed

## Source and capture

- Visual source of truth: `qa/selected-reference.webp` (selected compact blue/white design, 1487 × 1058 source pixels). The user explicitly reverted the enlarged-title variant.
- Browser-rendered desktop: `qa/handicraft-home-final.jpg` (1348 × 926 captured pixels; cloud browser reports 1363 × 936 CSS viewport, with capture excluding scrollbar/client chrome). Desktop page verified at `/`.
- Full-view comparison: `qa/comparison-final.jpg`; focused header/type/filter comparison: `qa/comparison-focus-final.jpg`. Reference normalized proportionally to 1348px content width (959px high); no stretching. Viewport height difference and fixed-width usable controls were accounted for instead of treating normalized geometry as exact CSS coordinates.
- Form screenshot: `qa/handicraft-signup-qa.jpg`.
- Responsive browser check: `qa/mobile-390.jpg`, 390 × 844 iframe viewport at scale 1 inside `qa/mobile-check.html`; complete enclosing browser capture is `qa/handicraft-mobile-final.jpg`. This is a real browser responsive iframe check, not a physical-device test.
- State: public, signed out. Reference account/admin-only controls intentionally differ: those controls appear only after a role-authorized session. Both comparisons inspect the same homepage content and unfiltered competition grid.

## Findings and comparison history

1. Initial capture contained unloaded images and a stale active-nav paint immediately after navigation. Discarded as incomplete evidence. Confirmed six images `complete=true`, natural width 1000, and only the home link active before final capture. Not treated as a layout defect.
2. [P2, fixed] Responsive drawer had no explicit close control inside the drawer; the overlay's center was covered by the drawer, making an accessible close action unreliable.
   - Fix: visible mobile-only close button, `aria-expanded`, and `aria-controls` on the menu trigger.
   - Post-fix browser evidence: opened the drawer, clicked “ปิดแถบเมนู”, confirmed drawer/overlay disappeared from the DOM and recaptured `qa/handicraft-mobile-final.jpg` / `qa/mobile-390.jpg`.
3. Final full-view and focused comparisons: no remaining actionable P0/P1/P2 visual findings.

## Required fidelity surfaces

- Fonts/typography: bundled Noto Sans Thai, navy heading hierarchy, compact two-line site title, readable Thai form labels. Slight face/optical-weight differences from generated reference are acceptable P3. Competition titles wrap naturally on the narrow responsive layout.
- Spacing/layout: white topbar, pale-blue left menu, search plus two filters, three-column desktop standalone cover cards, lightweight borders, consistent gaps. Narrower viewport naturally shows less of the second row; scrolling retains all controls. No horizontal document overflow in desktop DOM check. On 390px, search becomes its own row, cards use two columns, menu collapses.
- Colors/tokens: cobalt primary `#0759e6`, navy `#122449`, white main surface, pale-blue sidebar `#f5faff`, restrained green status chips; match selected direction. No decorative gradients or heavy shadows.
- Images: six independently generated photographic assets, converted to WebP, same subject/crop strategy as reference; verified all loaded. Phosphor icon library provides the outlined icons. No image placeholders, invented seals, or handcrafted icon approximations.
- Copy/content: exact accepted site/network name and correct Phetchaburi Area 2 affiliation. User requested cover cards lead to details before registration. Example eligibility/venue/schedule are marked as sample/pending instead of invented official data. Admin and judge menus are role-restricted intentionally.

## Interactions verified

Cloud browser:
- Home grid, loaded covers, search reduces to matching competition.
- Card opens correct detail page with eligibility, schedule, venue and registration CTA.
- Registration CTA opens login dialog when signed out.
- Login / signup / forgot-password switches; signup visibly requires school and teacher name.
- Mobile menu opens and explicit close button closes it.
- Browser logs checked: no application runtime errors after successful API startup; extension-only metadata errors excluded. Initial API proxy failure was fixed by same-process Miniflare middleware and reloaded successfully.

Automated real Workers runtime + D1 in Miniflare:
- Signup and persisted school; server ignores forged school on competition signup.
- Login/logout, password hash/pepper, cookie sessions, same-origin mutation guard.
- Participant blocked from admin/judge actions; judge blocked until assignment.
- Grade/score validation, pending result privacy, incomplete-publication guard.
- Assigned scoring, average results, publication locks scoring, owner-only certificate access.
- Resend HTTP mocked: generic forgot response, expiring single-use hashed token, reset revokes sessions, old password rejected and new one accepted.
- PDF uses Thai/Latin/digit-capable bundled font; separate student and coach pages.
- No real email was sent. Signed-in UI forms were not submitted through the cloud browser; authenticated flows are covered by API integration tests. Live Resend/D1/Cloudflare deployment still requires account configuration described in README.

## Follow-up polish

- P3: optional per-competition official certificate artwork/signature and final rubric once supplied by organizers.
- P3: PDF module is lazy-loaded; its fontkit dependency creates a larger separate download chunk, without blocking homepage load.

## Implementation checklist

- [x] Accepted compact header and cover grid implemented.
- [x] Search, details, registration, account dialogs, role controls, results and certificate gating implemented.
- [x] P2 mobile close issue fixed and rechecked.
- [x] Source and rendered output compared in combined full/focused inputs.
- [x] Local backend tests and Cloudflare packaging checks passed.
- [ ] Live account configuration and live email delivery (outside current push-only scope).
