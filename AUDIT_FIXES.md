# Repository hardening status

## Fixed in the repository

- Firestore cache snapshots no longer trigger automatic age-based permanent purges. Trash remains until an explicit permanent-delete action. Orphan cleanup waits for server-confirmed collection snapshots and verifies the child and parent again inside a transaction.
- Trash timestamps use server time. Student cascades tag linked records, process children before the parent, and restore tagged children with the parent. Permanent cascades also process children before parents.
- New subject, student, lesson, and fee records reuse a stable document ID while a write is unresolved, preventing duplicate records after a timeout/retry.
- Re-entered attendance no longer overwrites a soft-deleted record; it creates a new versioned record. Restore conflicts are explicit.
- Fee balance settlement creates a separate, idempotent payment record and preserves the original transaction date. Monthly reports use `monthPaidFor` consistently.
- Student-note edits use a Firestore transaction to detect concurrent edits and provide reload/replace choices. Late inline saves do not reset a different or edited draft.
- Attendance grouping uses a prototype-free map.
- Expo dependencies were upgraded incrementally to SDK 58. The splash screen uses its config plugin, OTA runtime versions use fingerprints, and CI uses the SDK-supported Node 22 line.
- CI runs tests and Expo Doctor on pull requests, skips token-backed EAS builds for PR code, pins EAS CLI, and writes the APK outside the repository.
- npm dependency overrides address the remaining audited transitive advisories.

## Still requires project-owner configuration or a larger design decision

- The app still has no sign-in flow, and no Firestore rules are tracked. Review the deployed rules and choose an administrator access policy before using real student or fee data. Do not deploy guessed rules: a deny-all ruleset would also disable the current app.
- Firestore collections are still listened to in full. True cursor pagination must preserve cross-screen aggregates, reports, and Trash behavior; simply adding `limit()` would silently hide older records.
- Full EAS Android build and on-device checks are still required, especially for gestures, offline writes, fee settlement, PDF sharing, OTA updates, and navigation.

## Validation performed

- Expo Doctor: 20/20 checks passed.
- `App.js` Babel transform passed.
- Android Metro export passed with Hermes bytecode disabled. The Windows Hermes compiler subprocess returned `spawn UNKNOWN`; the Linux EAS build remains the authoritative APK check.
- `npm audit`: 0 vulnerabilities after the SDK/dependency update and overrides.
- Unit tests were not rerun during this implementation turn.
