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
- Sign-in failures now display the Firebase error code (without exposing credentials) to make configuration and credential problems diagnosable.
- Added owner-only Firestore rules for the seven app collections, retaining the existing field checks and accepting Firestore timestamps where the app writes server timestamps. The rules use the project owner's Firebase Auth UID.
- Added React Native AsyncStorage for persistent Firebase Auth sessions.
- Activity log writes now use numeric timestamps compatible with the original rules, and read/write failures are shown in the Activity Log instead of only being logged to the developer console.
- Expo dependencies were upgraded incrementally to SDK 58. The splash screen uses its config plugin, OTA runtime versions use fingerprints, and CI uses the SDK-supported Node 22 line.
- CI runs tests and Expo Doctor on pushes and pull requests; APK builds are now manual-only on `main`. A separate manual workflow publishes JavaScript-only changes to the `preview` update channel. EAS deployment steps validate that the preview Firebase key is configured first.
- npm dependency overrides address the remaining audited transitive advisories.

## Still requires project-owner configuration or a larger design decision

- The owner reports publishing the owner-only rules. Deployed rules were not independently verified against `firestore.rules`.
- Firebase sign-in was blocked by the API key: a direct, non-account-creating Firebase Auth endpoint check of the repository's configured key returned `API_KEY_INVALID`. The old APK workflow did not provide a Firebase key and silently bundled that fallback. The fallback was removed; the app now requires `EXPO_PUBLIC_FIREBASE_API_KEY` from EAS. A verifier checks the configured key before APK or OTA deployment. The owner must set a valid key in the Expo project's `preview` environment and manually run **Publish Android Preview Update**. Existing preview APKs can receive this JavaScript-only correction without rebuilding if they use Expo Updates and the `preview` channel.
- Authentication and activity logging still require on-device verification after the preview update is published and downloaded.
- Firestore collections are still listened to in full. True cursor pagination must preserve cross-screen aggregates, reports, and Trash behavior; simply adding `limit()` would silently hide older records.
- The owner reports that an APK was built, but sign-in failed. Verify authentication and activity logging after the preview update; gestures, offline writes, fee settlement, PDF sharing, and navigation still need device checks.

## Validation performed

- Unit tests: 5/5 passed.
- Expo Doctor: 20/20 checks passed after the sign-in/activity-log changes.
- Firebase Auth API-key probe: rejected the repository's previously configured key with `API_KEY_INVALID`; the request used a dummy non-routable email and did not create an account.
- Android Metro export passed with Hermes bytecode disabled. The Windows Hermes compiler subprocess returned `spawn UNKNOWN`; the Linux EAS build remains the authoritative APK check.
- `npm audit`: 0 vulnerabilities after the SDK/dependency update and overrides.
- `git diff --check` passed.
- The Firestore Emulator was not run in this environment; the owner reports publishing the rules, but their live state was not independently verified.
