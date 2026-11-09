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

The app automatically creates and persists an anonymous Firebase Authentication session; it no longer asks for an email or password. Firestore remains owner-only. On first launch, the app displays the new anonymous user's UID if the published rules have not approved it yet. Add that exact UID to the owner-only rule in `firestore.rules` and publish the rules—never allow all users or public access. Firebase Auth still requires valid project configuration. The anonymous session is stored on the device; clearing app data or reinstalling can create a different UID and require updating the rules again. Keep the existing email/password provider enabled as a separate recovery option.
