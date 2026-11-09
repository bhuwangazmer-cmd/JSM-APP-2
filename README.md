# JSM

JSM is an Expo / React Native administration app for student records, lessons, attendance, fees, and notices. It uses Firebase Firestore for data storage.

## Local development

```sh
npm ci --legacy-peer-deps
npm start
```

Useful checks:

```sh
npm test
npm run doctor
```

The project targets Expo SDK 58. Use Node.js 22 or newer within Expo's supported versions.

Trash records remain available until a user explicitly restores or permanently deletes them; the app does not run clock-based automatic purges.

## Android APK

The `preview` EAS profile produces an internal APK. Pushes and pull requests run tests and Expo diagnostics. To build an APK, manually run **Build APK** in GitHub Actions on `main`.

The APK workflow requires the repository secret `EXPO_TOKEN`, valid EAS Android signing credentials, and `EXPO_PUBLIC_FIREBASE_API_KEY` in the Expo project's `preview` environment. Before deploying, it checks the key against Firebase Authentication without creating an account. Successful APKs are uploaded as the `JSM-App-APK` workflow artifact for seven days.

For JavaScript-only fixes, use **Publish Android Preview Update** in GitHub Actions instead of rebuilding the APK. It publishes to the `preview` channel used by the internal APKs and checks the key before publishing. In the Expo dashboard, open this project’s **Environment variables**, select `preview`, and add `EXPO_PUBLIC_FIREBASE_API_KEY` with Sensitive visibility. Use the valid API key for this Firebase project. Firebase client API keys are included in the app bundle; they are not passwords or access controls.

## Firebase security

The app uses Firebase email/password authentication and owner-only Firestore rules from `firestore.rules`. Confirm deployed rules match that file and the owner UID belongs to the intended Firebase Authentication account. Client-side validation and the Firebase API key are not access controls.
