# Ginhawa Google Maps JavaScript API

Customer bookings use Google Maps in `public/js/location.js`. The browser API key is configured in `public/js/google-maps-config.js`.

## HTML script loading

In `public/booking.html`, load these scripts **in order**:

```html
<script defer src="js/google-maps-config.js"></script>
<script defer src="js/location.js"></script>
```

Remove the legacy Leaflet CDN CSS and JS scripts; the Google Maps module dynamically loads the Maps JavaScript API when the customer opens the location picker. The existing HTML elements must have the IDs `location-map-modal`, `customer-location-map`, `open-location-picker`, `close-location-picker`, `map-use-gps`, `map-confirm`, `map-coordinates`, `book-lat`, `book-lng`, `selected-location-label`.

The center-screen pin overlay is positioned using `.map-fixed-pin` CSS, and the map is moved underneath it (Uber/Grab-style). The user must move the map, tap or use GPS before confirming a new pin. Customer coordinates are then included in the Firebase `submitBooking` call. Therapist proximity matching remains in Firebase RTDB and Cloud Functions.

## Required Google Cloud setup

1. Select the Cloud project that owns the supplied browser key.
2. Enable **Maps JavaScript API** and configure billing.
3. Restrict the key to **Maps JavaScript API** under API restrictions.
4. Restrict to approved **Websites (HTTP referrers)** under application restrictions, including your Firebase Hosting URL, custom production domain, and explicit local development origins as needed.
5. Configure quota/budget alerts for Dynamic Maps usage. The Maps JavaScript API is not unlimited free usage.

The key is a public web API key, not a server credential; never give this key unrestricted access to other APIs.

This commit includes backend integration plus map module. Deploying a complete frontend additionally requires the other `public/` HTML, CSS, JS and image assets supplied in the Ginhawa source archive.
