# Ginhawa Native Mobile PWA · RTDB Nearest Therapist Dispatch

## What changed

- **Mobile UI** (< 768px): fixed top app header, fixed safe-area bottom nav, no footer, compact page content, vertical scrolling, no pinch/scale zoom in mobile viewport.
- **Customer booking**: therapist now optional. An unassigned request automatically enters matching. Home/venue bookings require an **interactive Leaflet + OpenStreetMap location pin** and a manual address/landmark. Map selection does NOT auto-geocode or expose a reverse-geocode provider.
- **Therapist**: approved providers may opt in with `Go online with GPS`; the signed-in session sends a heartbeat with their position and receives offers in real time. Offers can be accepted/declined. The first accepted booking is assigned atomically.
- **Firebase RTDB**: private customer booking status, provider offer inbox, accepted bookings, provider location status, push device tokens, matching status and administrative approvals.
- **Optional push**: Firebase Cloud Messaging (FCM) background notifications only after configuring the **public VAPID** key and device permission. When app is open, Firebase Realtime Database listeners deliver offers without FCM.
- **Backend**: Cloud Functions validate new bookings, check eligibility/active services, find up to 3 nearest online verified therapists within 30 km, send offers, run a 2-minute retry for 20 minutes and mark `no_provider` when no match is found. Direct therapist choice routes a request to that provider.

## Structure

```
ginhawa-static/
├── public/
│   ├── *.html
│   ├── css/styles.css
│   ├── css/native-mobile.css
│   ├── js/app.js
│   ├── js/booking.js
│   ├── js/location.js
│   ├── js/dispatch.js
│   ├── js/firebase.js
│   ├── js/push-config.js
│   ├── firebase-messaging-sw.js
│   ├── sw.js
│   └── assets/
├── functions/
│   ├── index.js
│   ├── matching.js
│   ├── matching.test.js
│   ├── package.json
│   └── scripts/
│       ├── seed-services.js
│       └── approve-therapist.js
├── database.rules.json
├── firebase.json
├── .firebaserc
└── seed-services.json
```

## Deploy Ginhawa project `ginhawa-app`

**Preconditions**: use an authorized Firebase owner account. Enable Firebase Authentication Email/Password and Google. The RTDB instance must already exist at `https://ginhawa-app-default-rtdb.asia-southeast1.firebasedatabase.app`. Deploying rules replaces existing rules, so export/review first. Functions + scheduled matching require an appropriate **Blaze billing plan**, Cloud Functions and Cloud Scheduler enabled. Firebase Hosting can serve the static HTML.

```bash
cd ginhawa-static
npm --prefix functions install
npm --prefix functions test
firebase login
firebase deploy --only database,functions,hosting --project ginhawa-app
```

### Seed real services before booking

Create appropriate Google Cloud Application Default Credentials for an authorized administrator (do not expose service account keys in the web app):

```bash
# From project root; after `npm --prefix functions install`:
node functions/scripts/seed-services.js
```

The seed script only writes services if `/catalog/services` does not already exist. Modify and review `seed-services.json` before seeding. Clients cannot create production bookings if their service isn't active in RTDB.

### Provision approved therapists (manual verification required)

After you **verify credentials and approve** an existing Firebase Auth UID:

```bash
node functions/scripts/approve-therapist.js YOUR_VERIFIED_UID massage,joint "Therapist Name" Tuguegarao
```

The script sets the admin-only `therapist: true` custom claim and creates the trusted `providerProfiles/{uid}` record and public catalog listing. A new account cannot self-approve by selecting “therapist” in signup. The approved therapist should sign out and back in before opening `therapist-dashboard.html` and choosing **Go online with GPS**. They must enable browser/device location access on HTTPS.

### Optional background push

Go to Firebase Console > Cloud Messaging > Web Push certificates, generate a **public VAPID** key, then paste it into `public/js/push-config.js`. On the verified therapist dashboard, tap **Enable notifications** to grant push permission and register this device. The app uses a separate FCM service worker scope (`/fcm/`) so it does not replace the PWA offline shell service worker. Browser/platform support varies; on iOS, add the PWA to the Home Screen to use web push.

## Booking dispatch design

1. Customer signs in, chooses an active service/date/time, optional therapist, and pins home/venue location.
2. `submitBooking` callable validates all input and writes `/bookingRequests/{id}` plus a private `/customerBookings/{uid}/{id}` status mirror.
3. An RTDB create trigger loads **trusted** `/providerProfiles` and recent opted-in `/providerPresence`. For unassigned requests it sorts eligible providers by haversine distance and selects at most **3 within 30 km**. For direct requests it targets the selected approved therapist.
4. Each selected therapist receives `/providerInbox/{uid}/{id}` without the customer's precise street or coordinates; optional FCM sends the generic area summary.
5. `respondToOffer` callable re-verifies the provider and the offer, atomically changes booking status from `searching` to `assigned`, and only then writes `/assignedBookings/{uid}/{id}` including the exact service address.
6. Customer's My Bookings shows real-time `searching`, `assigned`, or `no_provider` status. No payment is captured; no session is considered completed until proper workflows are built.

### RTDB paths

| Path | Browser access | Writer |
|---|---|---|
| `profiles/{uid}` | private user | Auth onboarding (create only) |
| `catalog/services`, `catalog/therapists` | public approved catalog | admin only |
| `bookingDrafts/{uid}` | private user | user (old drafts) |
| `bookingRequests/{id}` | server only | Cloud Functions |
| `customerBookings/{uid}/{id}` | private customer | Cloud Functions |
| `providerProfiles/{uid}` | provider/admin | admin only |
| `providerPresence/{uid}` | provider/admin | approved provider while online |
| `providerInbox/{uid}/{id}` | provider/admin | Cloud Functions |
| `assignedBookings/{uid}/{id}` | provider/admin | Cloud Functions |
| `providerPushTokens/{uid}/{id}` | provider/admin | approved provider |
| `bookingQuotas`, `offersByBooking` | server only | Cloud Functions |

## Important operational constraints

- **Google Maps isn't used**. Leaflet + OpenStreetMap is a **no-key/no-map-billing demo**. OSM Foundation public tile infrastructure is a limited community resource; obey its tile usage policy and move to a suitable hosted/self-hosted tile provider for commercial scale. Tile fetching requires internet and is not precached/offline.
- No geocoding/autocomplete calls are made. Customers supply their address and manually position the pin, or use device GPS. The default map location is an **example center**, never claimed to be the user's actual location.
- Background **web push is optional** and needs VAPID configuration; real-time inbox notifications only work while the app is running. Nothing is deployed or enabled in Firebase Console by this source code alone.
- Production geo dispatch currently scans approved providers and heartbeat locations server-side. For a large marketplace, replace full scans with a geohash/spatial index and regional matching queues.
- Booking `assigned` means a provider accepted the *request*, not a paid or completed treatment. Schedule conflict checks, cancellations, refunds, payment authorization, professional verification workflows, fraud controls, and operational support must be implemented before commercial launch.
- Some devices' accessibility features are impacted by disabling page zoom. This was explicitly requested for the native-app presentation; revisit accessibility requirements before public launch.
- GPS and exact service addresses are sensitive. Respect customer/provider consent, audit logs, consent retention, and delete stale presence, offer, booking and push records according to policy.