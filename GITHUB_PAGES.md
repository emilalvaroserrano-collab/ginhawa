# GitHub Pages deployment
The site source lives in `public/`. GitHub Actions publishes that directory as the website root, so `public/index.html` is served at `https://emilalvaroserrano-collab.github.io/ginhawa/` and `/ginhawa/index.html`.

Go to **Settings → Pages → Build and deployment → Source: GitHub Actions**. Push to `main` or run the workflow manually. GitHub Pages only serves the frontend; Firebase RTDB, Auth and Cloud Functions must be configured separately.

The repository-root `index.html` redirects to `public/index.html` if the site is published from branch root instead. For the GitHub Actions build, the root redirect file is not deployed, because the workflow uploads `public/` directly.

Google Maps key is configured in `public/js/google-maps-config.js`. Enable **Maps JavaScript API** and billing in Google Cloud. Restrict the browser key to HTTP referrers including `https://emilalvaroserrano-collab.github.io/*` (also any custom domain) and API restrictions including Maps JavaScript API. Firebase Authentication must allow `emilalvaroserrano-collab.github.io` as an authorized domain.

Browser-based Google Maps JavaScript API is not the same as the Maps Static API. The pin picker uses Maps JavaScript API for dragging, panning and GPS, with booking details ultimately validated in Cloud Functions.
