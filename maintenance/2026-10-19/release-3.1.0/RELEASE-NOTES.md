# ScoreFlow 3.1.0 — Organization accounts and limited trial

Supabase Auth handles organizer signup, email confirmation, login and recovery. Tokens stay in HttpOnly, Secure, SameSite=Lax cookies. A verified account owns one organization. Each request checks ownership on the server; tenant secrets no longer grant access to account-owned tenants. Existing tenants retain their prior keys and links.

The server starts a fixed 14-day trial when the verified organizer creates the organization. Postgres serializes trial writes on the account row: one event, six athletes combined across public registrations and the manual roster, three judges, two categories and ten email attempts including tests. Approved linked registrations retain their original slot. Forged registration/name links cannot hide another athlete. Public voting and bulk import are disabled in trial. Required athlete attachments remain supported; optional event archives require an active license.

Expired trials preserve state and registrations for reading and export. State, athlete profiles, uploads, access links, reviews and email writes stop. Signed file downloads and license activation remain available. A valid license lifts restrictions on the same tenant; no data migration is required. Card checkout, recurring subscriptions, invoices and automated billing webhooks are not part of this release.

## Validation

- 18 backend account/session/security tests, with a mocked identity and mail provider.
- 11 account/UI tests, including six-athlete trial creation, restore and expiry.
- 27 existing email backend regressions and 9 email UI regressions.
- 20 scoring/control regressions, including an entire 12-athlete licensed qualification and final; fixtures are local only.
- 8 navigation and 10 health/status regressions.
- Transactional tests executed against Postgres under service_role, then rolled back: fixed dates, one owner/organization, all capacity limits, mixed roster/registration counting, approval deduplication, email limit, expiry and upgrade.
- Total: 103 automatic JavaScript checks plus the database suite. Real Supabase Auth email confirmation/recovery is not exercised by the mocked provider suite.

## Deployment

Production source files are server.js, app.js, index.html, styles.css, db.js and the package/lock files. Preserve the existing assets/, scripts/, display.html and example CSV. Apply trial-schema.sql before deploying Node. Keep the server-side Supabase service key and managed Resend configuration in Hostinger environment variables. Do not deploy test SQL, regression scripts or release notes to the public root. Maintain Hostinger hbuilds/last-source as the deployment source; environment changes also redeploy from this directory.

## Review notes

New tables and RPCs are service-only with RLS and no public grants. Direct browser roles cannot write ScoreFlow tables; all browser actions use authenticated Node API routes. Static files are allowlisted to prevent server/schema downloads.

Supabase advisors found no new exposed table or invoker-function permissions. Two pre-existing SECURITY DEFINER helper RPCs remain callable by anon/authenticated; automatic approval review rejected a separate request to revoke their EXECUTE permissions because compatibility with previous clients needs specific approval. Their definitions and permissions were left unchanged. Review: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable and https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable . Existing performance findings (legacy RLS policies and FK indexes) were not changed: https://supabase.com/docs/guides/database/database-linter .

## Production verification

Hostinger deployment completed. `/health` and `/api/status` reported 3.1.0 with database and managed email available. `/api/account/session` returned the anonymous state. Live signup rejected malformed input with HTTP 400 and login rejected synthetic unknown credentials with HTTP 401 without sending mail. Published JS/HTML/CSS hashes matched the tested release. Browser inspection confirmed the organizer access and trial signup screens; no real organizer was enrolled or emailed by this validation.
