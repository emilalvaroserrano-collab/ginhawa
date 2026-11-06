# Ginhawa launch-mode automatic onboarding

## Current temporary signup policy
- **Customer:** Email/Password and Google login create an immediately usable customer profile.
- **Therapist:** Email/Password or Google signup + explicit acceptance of the code of conduct calls `activateTherapist` (Firebase callable function) and immediately grants a Firebase Auth `therapist` custom claim.
- **Therapist RTDB profile:** `providerProfiles/{uid}` receives `active: true`, `onboardingStatus: 'auto_approved'`, `verified: false`, and `credentialStatus: 'not_verified'`.
- **Automatically eligible service IDs:** `massage`, `wellness`, `home`. This allows basic general wellness booking matching with no Ginhawa admin approval. Specialized/regulated services such as rehabilitation and consultation require verified permissions; the automatic onboarding path does not grant them.
- **Presence and inbox:** The updated RTDB rules allow auto-onboarded therapists with server-issued custom claims to go online and receive nearby service offers.
- **Credentials:** Auto activation is NOT identity, qualification, license, background, or professional credential verification. Do not label an auto-onboarded therapist as verified.

## Required deployment
The automatic signup flow only works after deploying the updated Firebase Cloud Functions and Realtime Database rules from GitHub `main`:

```bash
npm --prefix functions install
npm --prefix functions test
firebase deploy --only functions,database --project ginhawa-app
```

## Vercel source / public environment
Source contains **no embedded Firebase web API key or Google Maps key**. Create/link the `ginhawa` Vercel project, populate the public `GINHAWA_*` build variables in Vercel Project Settings (see `README_VERCEL.md`), and deploy `main`. Without those variables the production build intentionally fails, rather than creating a broken public app.

The browser necessarily receives the Firebase SDK web config and Maps JavaScript browser API key from the built `runtime-config.js`. They are not server secrets. Restrict them by Cloud API and Firebase rules.

## Future policy switch
To introduce manual professional verification later, preserve `verified: false` by default and require credentials for higher-risk services through the existing admin verification workflow. Never use a user's self-selected role to grant admin access.
