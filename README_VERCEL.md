# Ginhawa App — Vercel hosting

## Deployment architecture
- GitHub repo: https://github.com/emilalvaroserrano-collab/ginhawa
- Production branch: `main`
- Project root: repository root (do not set Root Directory to `public`)
- Framework preset: **Other** (static HTML/CSS/JS)
- Build command: none
- Output directory: `public` (set in `vercel.json`)
- Public entry URL: `/` or `/index.html`, both render `public/index.html`.
- Static routes: `/booking.html`, `/services.html`, `/about.html` etc.
- CSS: `/css/styles.css`; assets: `/assets/*.jpg`; scripts: `/js/*.js`.

Vercel hosts only the **static frontend**. Firebase Authentication, Firebase Realtime Database, and Firebase Cloud Functions remain in the `ginhawa-app` Firebase project.

## Firebase Auth and Maps configuration
1. Add the final `*.vercel.app` host (without scheme or path) to Firebase Console → Authentication → Settings → Authorized domains. Configure Email/Password + Google auth.
2. In Google Cloud Console, limit the Maps JavaScript browser key in `public/js/google-maps-config.js` to the Maps JavaScript API, and whitelist `https://<your-vercel-host>/*` plus approved custom domains as HTTP referrers. Check billing/quota.
3. Deploy RTDB rules and Firebase functions separately with the Firebase CLI; Vercel doesn't run the code under `functions/`.

## PWA and branding
Actual committed JPEG assets are referenced by CSS and HTML: `ginhawa-logo.jpg`, `hero-therapy.jpg`, `wellness-care.jpg`. The v3 service-worker cache refreshes previously cached CSS and JS.

## Migration
The prior GitHub Pages custom-domain error (`ginhawa`) does not affect Vercel. You may disable Pages after the Vercel deployment works and Google/Firebase authorized domains are updated.

## Public runtime configuration from Vercel environment (no keys in Git)
Vercel project settings: **Root Directory: ./; Framework: Other; Build Command: node scripts/build-client-config.mjs; Output Directory: public**.
Add these keys for Production and Preview before deploying:

```text
GINHAWA_FIREBASE_API_KEY
GINHAWA_FIREBASE_AUTH_DOMAIN
GINHAWA_FIREBASE_DATABASE_URL
GINHAWA_FIREBASE_PROJECT_ID
GINHAWA_FIREBASE_STORAGE_BUCKET
GINHAWA_FIREBASE_MESSAGING_SENDER_ID
GINHAWA_FIREBASE_APP_ID
GINHAWA_FIREBASE_MEASUREMENT_ID
GINHAWA_GOOGLE_MAPS_API_KEY
GINHAWA_FCM_VAPID_KEY
```

Use the existing Ginhawa Firebase web config and Google Maps JavaScript browser key values. Deployment generates `public/js/runtime-config.js` from environment variables; tracked source includes an empty fallback only. The build fails with missing variable names (not values) when required credentials are absent. **Browser SDK keys remain visible to visitors after deployment**; use Google Maps API/referrer restrictions, Firebase Auth authorized domains and RTDB rules. Do not store private service account credentials or payment secrets as browser config.
