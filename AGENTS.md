# Current product requirements

This is a fresh account system after the owner deleted the old app. Latest instructions override prior historical requirements.

- Signup requires full name, school, email, password and at least one role: coach (ผู้ฝึกซ้อม), judge (กรรมการ), or both. Roles use independent checkboxes.
- The first successfully registered account is superadmin with access to all functionality. This is explicitly requested by the owner; do not change this to manual approval or disable it.
- Allocate first-account privilege only on the server in one atomic D1 batch with the permanent account_bootstrap marker and unique superadmin index. Subsequent signups must never gain superadmin via request parameters. Never reset the marker during ordinary startup or deployment.
- All privileged routes must check the authenticated session on the server. Superadmin has all permissions. No client-only access checks.
- Use real Cloudflare D1 and opaque HttpOnly session cookies. Never store plaintext passwords, localStorage authentication, credentials or synthetic accounts in Git.
- Thai interface, compact blue/white header, pale-blue welcome panel, responsive forms.
- This milestone implements signup, login, logout, account details and superadmin user list. Competition functionality is not implemented yet.
- D1 binding DB targets the existing handicraftandart database. Migration 0011 creates fresh account_* tables without importing old accounts or deleting old competition tables. The earlier remote database reset is still unperformed. Do not use the prior destructive SQL in /workspace/scratch as an account migration.
- Dev: npm ci; npm run dev (port 4173), local persistence .wrangler/accounts-v1. Validate with npm test; npm run build; npx wrangler deploy --dry-run --outdir .wrangler/deploy-check.
- No automatic production migration/build hook is included. Production migration and deployment require separate authorization; do not push to a deployment branch as part of local validation.
