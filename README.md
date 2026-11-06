**Production frontend: Vercel** — see [README_VERCEL.md](README_VERCEL.md) for static hosting and Firebase configuration.

# Ginhawa App — Native Mobile PWA + Firebase Authentication + Realtime Therapist Dispatch

**Primary guide: [README_NATIVE_DISPATCH.md](README_NATIVE_DISPATCH.md)**

The main app is built from standalone static HTML pages inside `public/`, shared CSS/JS and local assets. It uses Firebase Email/Password and Google Authentication, **Firebase Realtime Database (RTDB), not Firestore**, and Cloud Functions for security-sensitive booking matching and acceptance.

## Run locally

```bash
python3 -m http.server 8080 --directory public
# Open http://localhost:8080
```

This displays the responsive PWA. To create live bookings and notify therapists, deploy database rules, the Cloud Functions backend, and publish verified therapists; see the deployment guide. Firebase Hosting can serve the static `public/` directory.

## Deployment

```bash
npm --prefix functions install
npm --prefix functions test
firebase login
firebase deploy --only database,functions,hosting --project ginhawa-app
```

Functions and scheduled matching require a Firebase Blaze plan. The user must approve and enable the authentication providers, review database rules, configure authorized hosting domains, seed active services, and provision verified provider accounts (these are not created or authorized merely by the static project source). Background push notifications require an extra public Web Push VAPID key in `public/js/push-config.js` and device permission.

## Tests

```bash
node --test functions/matching.test.js
python3 test_native_offline.py   # requires playwright + beautifulsoup4 + system Chromium
```

Live Google/Firebase Auth and RTDB writes, deployed functions, push delivery, GPS permissions and map tiles must still be verified in the Firebase environment.

## Functional scope

Customer booking requests are **requests**, not confirmed paid sessions. A verified therapist can accept the request. This update does not implement payment capture, licensing review workflows, completion check-offs, refunds or insurance fund transactions.

Automatic onboarding policy: [README_AUTO_ONBOARDING.md](README_AUTO_ONBOARDING.md).
