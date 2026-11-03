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
- Authentication uses full pages at /login, /signup, and /forgot-password in the accepted blue/white layout. Signup creates one teacher account usable for both coaching and assigned judging; no exclusive role choice or identity upload is required. Admin user lists show applicant details.
- All competition pages require login, including home, competition listings/details, and results. Anonymous visitors go to /login; only signup, forgot-password, and reset-password remain available. Hide the main navigation before login and omit any back-to-home link from auth pages. Protect competition and results APIs as well.
- Login's left welcome heading reads: ยินดีต้อนรับ สู่ระบบการแข่งขันศิลปหัตถกรรม ศูนย์เครือข่ายสองพี่น้อง ห้วยแม่เพรียง ป่าเด็ง. The form heading is เข้าสู่ระบบ.
- Event confirmed by the owner: งานศิลปหัตถกรรม ศูนย์เครือข่ายสองพี่น้อง ห้วยแม่เพรียง ป่าเด็ง ประจำปีการศึกษา 2569. Dates, official scoring rules and certificate signatory remain unconfirmed; do not invent them or disable demo mode without confirmation of the real configuration.

- Owner approved importing all primary activities from the 12 supplied 2568 rules PDFs, including inclusive schools, disability-specific schools, and a separate special-centre age 7–12 division. Exclude kindergarten and secondary intake. Use previous-year rules for testing until new rules arrive. Preserve existing registrations/results; create new competition versions for changed rules.

- Current owner workflow (supersedes the previous verified workflow): teacher signs up with school, selects a competition, enters students/coaches and registers in one page, then waits for the competition. No account approval, ID-card upload, eligibility checkbox, team approval or repeated approval after edits is required. One teacher can coach and judge with the same account. Admin assignment grants judging access without a role change. Never allow a teacher to judge any competition containing a submitted team from their school (owner explicitly confirmed this restriction).
- Keep the compact blue/white visual style, Thai identity, catalog, production hosting adapter, private historical evidence, account data and published/finalized results. Rewrite the workflow through migration 0010, not a destructive data reset. Do not grant admin privileges on signup.
- Home is now a teacher dashboard with registered teams, schedules/venues and assigned judging jobs; competition cards remain at /competitions. Registration is a single-page form. Preserve roster eligibility/count/grade rules and deadlines as server validation. When no event window is set, registration_open controls simple workflow registration and closes editing/scoring phases; scoring opens once registration closes. Final score locking, automatic publication/ranking and certificate behavior remain.
- See docs/simple-workflow.md. Legacy workflow tests intentionally stop before migration 0010 to protect finalized historical events; new workflow tests apply all migrations.
