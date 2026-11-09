const PROJECT_ID = 'jsm-app-cde22';

const verifyFirebaseApiKey = async () => {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('EXPO_PUBLIC_FIREBASE_API_KEY is missing from the selected Expo environment.');
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'codex-diagnostic@example.invalid',
        continueUri: `https://${PROJECT_ID}.firebaseapp.com`,
      }),
    }
  );
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const firebaseStatus = result?.error?.message || `HTTP_${response.status}`;
    if (/API_KEY_INVALID|INVALID_API_KEY|API key not valid/i.test(firebaseStatus)) {
      throw new Error('Firebase rejected EXPO_PUBLIC_FIREBASE_API_KEY as invalid. No account was created.');
    }
    if (/API_KEY_SERVICE_BLOCKED|SERVICE_BLOCKED/i.test(firebaseStatus)) {
      throw new Error('The API key is valid but its API restrictions block Firebase Authentication.');
    }
    throw new Error(`Firebase API-key check failed with ${firebaseStatus}. No account was created.`);
  }

  console.log(`Firebase Authentication accepted the configured API key for project ${PROJECT_ID}. No account was created.`);
};

verifyFirebaseApiKey().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
