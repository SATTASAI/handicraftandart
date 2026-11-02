# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Accepted project direction

- Preserve the selected compact blue/white header and pale-blue left navigation; do not use the rejected oversized header.
- Site title: ศิลปหัตถกรรม / ศูนย์เครือข่ายสองพี่น้อง ห้วยแม่เพรียง ป่าเด็ง.
- Home is a six-cover competition grid. Card opens details/criteria/schedule/venue and a registration button.
- Target hosting is Cloudflare Workers + D1; password reset provider is Resend. School is required on teacher registration and persisted server-side.
- Keep synthetic local accounts and deployment secrets out of git. New accounts must never become administrators automatically.
- Authentication uses full pages at /login, /signup, and /forgot-password in the accepted blue/white layout. Signup collects exactly one requested role (judge or coach); admins assign actual permissions separately. Admin user lists show applicant details.
- All competition pages require login, including home, competition listings/details, and results. Anonymous visitors go to /login; only signup, forgot-password, and reset-password remain available. Hide the main navigation before login and omit any back-to-home link from auth pages. Protect competition and results APIs as well.
- Login's left welcome heading reads: ยินดีต้อนรับ สู่ระบบการแข่งขันศิลปหัตถกรรม ศูนย์เครือข่ายสองพี่น้อง ห้วยแม่เพรียง ป่าเด็ง. The form heading is เข้าสู่ระบบ.
- Event confirmed by the owner: งานศิลปหัตถกรรม ศูนย์เครือข่ายสองพี่น้อง ห้วยแม่เพรียง ป่าเด็ง ประจำปีการศึกษา 2569. Dates, official scoring rules and certificate signatory remain unconfirmed; do not invent them or disable demo mode without confirmation of the real configuration.

- Owner approved importing all primary activities from the 12 supplied 2568 rules PDFs, including inclusive schools, disability-specific schools, and a separate special-centre age 7–12 division. Exclude kindergarten and secondary intake. Use previous-year rules for testing until new rules arrive. Preserve existing registrations/results; create new competition versions for changed rules.
