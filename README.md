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

The `preview` EAS profile produces an internal APK. The GitHub Actions workflow builds it on pushes to `main` and manual dispatch; pull requests run tests and Expo diagnostics without access to the Expo token.

The workflow requires the repository secret `EXPO_TOKEN` and valid EAS Android signing credentials. Successful APKs are uploaded as the `JSM-App-APK` workflow artifact.

## Firebase security

The client contains Firebase project configuration, but the repository does not define Firestore Security Rules or an app sign-in policy. Review and secure the deployed Firebase rules before using real student or fee data. Client-side validation and the Firebase API key are not access controls.
