# Repository hardening status

## Fixed in the repository

- Firestore cache snapshots no longer trigger automatic age-based permanent purges. Trash remains until an explicit permanent-delete action. Orphan cleanup waits for server-confirmed collection snapshots and verifies the child and parent again inside a transaction.
- Trash timestamps use server time. Student cascades tag linked records, process children before the parent, and restore tagged children with the parent. Permanent cascades also process children before parents.
- New subject, student, lesson, and fee records reuse a stable document ID while a write is unresolved, preventing duplicate records after a timeout/retry.
- Re-entered attendance no longer overwrites a soft-deleted record; it creates a new versioned record. Restore conflicts are explicit.
- Fee balance settlement creates a separate, idempotent payment record and preserves the original transaction date. Monthly reports use `monthPaidFor` consistently.
- Student-note edits use a Firestore transaction to detect concurrent edits and provide reload/replace choices. Late inline saves do not reset a different or edited draft.
- Attendance grouping uses a prototype-free map.
- The app now uses persistent Firebase email/password authentication, gates all app screens behind sign-in, and provides a sign-out action.
- Added owner-only Firestore rules for the seven app collections, retaining the existing field checks and accepting Firestore timestamps where the app writes server timestamps. The rules use the project owner's Firebase Auth UID.
- Added React Native AsyncStorage for persistent Firebase Auth sessions.
- Expo dependencies were upgraded incrementally to SDK 58. The splash screen uses its config plugin, OTA runtime versions use fingerprints, and CI uses the SDK-supported Node 22 line.
- CI runs tests and Expo Doctor on pull requests, skips token-backed EAS builds for PR code, pins EAS CLI, and writes the APK outside the repository.
- npm dependency overrides address the remaining audited transitive advisories.

## Still requires project-owner configuration or a larger design decision

- The owner-only sign-in and rules are prepared in the repository but are not deployed to Firebase. Install/run this updated app, confirm sign-in with the Firebase Auth account whose UID is in `firestore.rules`, test the rules, then publish them in Firebase Console. Until published, the deployed Firebase rules remain unchanged.
- Firestore collections are still listened to in full. True cursor pagination must preserve cross-screen aggregates, reports, and Trash behavior; simply adding `limit()` would silently hide older records.
- Full EAS Android build and on-device checks are still required, especially for authentication persistence, gestures, offline writes, fee settlement, PDF sharing, OTA updates, and navigation.

## Validation performed

- Expo Doctor: 20/20 checks passed.
- Unit tests: 5/5 passed.
- Android Metro export passed with Hermes bytecode disabled. The Windows Hermes compiler subprocess returned `spawn UNKNOWN`; the Linux EAS build remains the authoritative APK check.
- `npm audit`: 0 vulnerabilities after the SDK/dependency update and overrides.
- `git diff --check` passed.
- The Firestore Emulator was not run in this environment; Firebase rules must still be tested before publishing.
