# ScoreFlow 3.1.1 — Password usability

Organizer signup and recovery now accept passwords from 8 to 128 characters. Login retains compatibility with existing passwords. The same minimum is enforced by HTML validation and Node routes. A dedicated eye button in login, signup and reset toggles visibility without submitting, modifying the value or consuming the recovery token. The button has accessible labels, pressed state and keyboard focus styling.

No database, Auth service configuration, ownership or subscription changes. Existing passwords, organization data and trial dates are preserved.

Real-account QA on 21 October: signup, inbox delivery (SPF/DKIM/DMARC pass), email confirmation, login, persistence after reload, account-to-organization creation and logout passed. The linked trial is exactly 14 days and the event is empty. Recovery email was requested; the user paused before choosing a replacement password to request this usability fix. Real reset/re-login validation remains pending user completion.
