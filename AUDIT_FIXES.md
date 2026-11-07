# Repository audit fixes

## Implemented on this branch

- Fixed the recent-attendance month filter so it rejects future dates, malformed dates, and impossible calendar dates. The filter includes the current and immediately preceding calendar month.
- Split bulk "All Present" attendance writes into batches of 450 operations, below Firestore's 500-write batch limit.
- Added unit tests for the date filter and batch chunking helper.
- Added an `npm test` script using Node's built-in test runner.
- Updated the APK workflow to use `npm ci --legacy-peer-deps`, run tests before building, use read-only repository contents permission, and validate pull requests targeting `main`.

## Items requiring Firebase project access / owner decisions

- Firestore security rules are not present in this repository. Do not deploy guessed rules: the correct policy depends on the intended user/authentication model and data-sharing requirements. Review the deployed rules in Firebase Console and confirm unauthenticated clients cannot read or write student, attendance, lesson, fee, activity, settings, or notice-board documents.
- The app currently initializes Firestore without a user sign-in flow. If this is intended to be a single-administrator app, define and implement the administrator authentication model before enforcing authenticated-only rules.
- The repository's Firebase client configuration includes a public API key. Firebase web/mobile API keys are identifiers, not authorization boundaries; restrict the key as appropriate, and rely on Firestore Security Rules/App Check rather than treating the key as a secret.
- Full Firestore query pagination remains a larger architectural change. Current UI limits only reduce rendered rows; collection listeners still load the collections in full. Converting these listeners safely requires cursor-based queries, listener lifecycle design, and changes to aggregates/reports/trash behavior.
- Device-level verification remains required for offline writes, fee retry behavior, bulk attendance, PDF sharing, OTA updates, and Android navigation/gestures.

## Validation

The pull-request workflow runs `npm ci --legacy-peer-deps`, `npm test`, and the local EAS Android APK build. Results must be checked after the workflow completes; source changes alone are not evidence that the APK builds or the app behaves correctly.
