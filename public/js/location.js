/* Google Maps JavaScript API: customer service pin. Coordinates are only saved after explicit user selection. */
(() => {
  'use strict';
  const modal = document.getElementById('location-map-modal');
  if (!modal) return;

  const $ = selector => document.querySelector(selector);
  const latitude = $('#book-lat');
  const longitude = $('#book-lng');
  const label = $('#selected-location-label');
  const coordinates = $('#map-coordinates');
  const mapNode = $('#customer-location-map');
  const DEFAULT_CENTER = { lat: 17.6132, lng: 121.7270 }; // Illustrative city center, not device location.
  const MAPS_URL = 'https://maps.googleapis.com/maps/api/js';

  let map = null;
  let leafletMap = null;
  let leafletLoading = null;
  let googleMapsLoading = null;
  let googleAuthFailed = false;
  let fallbackPromise = null;
  const mapStatus = $('#map-engine-status');
  const setStatus = message => { if (mapStatus) { mapStatus.hidden = !message; mapStatus.textContent = message || ''; } };
  let chosen = null;
  let touched = false;
  let focusReturn = null;
  const format = ({ lat, lng }) => `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
  const positionOf = () => {
    if (leafletMap) { const p = leafletMap.getCenter(); return { lat: p.lat, lng: p.lng }; }
    if (!map) return chosen;
    const center = map.getCenter();
    return center ? { lat: center.lat(), lng: center.lng() } : chosen;
  };
  function readout(message = null) {
    if (!coordinates) return;
    if (message) {
      coordinates.textContent = message;
      return;
    }
    const center = positionOf();
    coordinates.textContent = center
      ? `Pin coordinates: ${format(center)}${touched ? '' : ' · Move map or tap to select'}`
      : 'Drag the map, tap a spot, or use GPS to set a pin.';
  }
  function isValid(p) {
    return p && Number.isFinite(p.lat) && Number.isFinite(p.lng)
      && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
  }
  function loadGoogleMaps() {
    if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
    if (googleMapsLoading) return googleMapsLoading;
    const key = window.GINHAWA_GOOGLE_MAPS_KEY;
    if (!key) return Promise.reject(new Error('Google Maps API key has not been configured.'));
    googleMapsLoading = new Promise((resolve, reject) => {
      const callbackName = '__ginhawaGoogleMapsLoaded';
      const timeout = window.setTimeout(() => {
        delete window[callbackName];
        reject(new Error('Google Maps timed out. Check your internet connection and API restrictions.'));
      }, 20000);
      window[callbackName] = () => {
        window.clearTimeout(timeout);
        delete window[callbackName];
        if (window.google?.maps?.Map) resolve(window.google.maps);
        else reject(new Error('Google Maps script loaded without the Maps JavaScript API.'));
      };
      const script = document.createElement('script');
      script.src = `${MAPS_URL}?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=${callbackName}`;
      script.async = true;
      script.defer = true;
      script.dataset.ginhawaGoogleMaps = 'true';
      script.onerror = () => {
        window.clearTimeout(timeout);
        delete window[callbackName];
        reject(new Error('Google Maps failed to load. Check billing, API access and allowed website domains.'));
      };
      document.head.appendChild(script);
    });
    return googleMapsLoading;
  }

  // Google calls this hook for invalid keys, referrer restrictions and billing issues.
  // The JavaScript SDK can appear loaded before authorization fails.
  window.gm_authFailure = () => {
    googleAuthFailed = true;
    console.error('[Ginhawa Maps] Google Maps authorization failed. Check the Maps JavaScript API, Cloud billing and HTTP referrer restrictions for', location.origin);
    if (modal.classList.contains('open')) void switchToFallback('Google Maps authorization failed');
  };

  function loadLeaflet() {
    if (window.L?.map) return Promise.resolve(window.L);
    if (leafletLoading) return leafletLoading;
    leafletLoading = new Promise((resolve, reject) => {
      const cssId = 'ginhawa-leaflet-css';
      if (!document.getElementById(cssId)) {
        const css = document.createElement('link');
        css.id = cssId;
        css.rel = 'stylesheet';
        css.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(css);
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => window.L?.map ? resolve(window.L) : reject(new Error('Alternate maps library is unavailable.'));
      script.onerror = () => reject(new Error('Alternate map script failed to load.'));
      document.head.appendChild(script);
    }).catch(error => { leafletLoading = null; throw error; });
    return leafletLoading;
  }

  // Fallback leaves location selection usable even if Google rejects the browser key.
  // For high-traffic production, configure a commercial OSM-compatible tile provider.
  async function switchToFallback(reason) {
    if (leafletMap) return;
    if (fallbackPromise) return fallbackPromise;
    fallbackPromise = (async () => {
      console.warn('[Ginhawa Maps] Switching to OpenStreetMap:', reason);
      setStatus('Google Maps is unavailable. Using OpenStreetMap as an alternative.');
      if (map && window.google?.maps?.event) window.google.maps.event.clearInstanceListeners(map);
      map = null;
      mapNode.replaceChildren();
      const L = await loadLeaflet();
      if (!modal.classList.contains('open')) return;
      const center = chosen || DEFAULT_CENTER;
      leafletMap = L.map(mapNode, { zoomControl: true, scrollWheelZoom: false })
        .setView([center.lat, center.lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
      }).addTo(leafletMap);
      leafletMap.on('dragstart', () => { touched = true; });
      leafletMap.on('dragend', () => readout());
      leafletMap.on('moveend', () => readout());
      leafletMap.on('click', event => {
        touched = true;
        leafletMap.panTo(event.latlng);
        readout();
      });
      window.setTimeout(() => leafletMap?.invalidateSize(), 100);
      readout();
    })().catch(error => {
      console.error('[Ginhawa Maps] Alternate map unavailable:', error);
      setStatus('Map tiles are unavailable. You can still use GPS to set your location.');
      readout('Use the GPS button to select your current coordinates.');
    }).finally(() => { fallbackPromise = null; });
    return fallbackPromise;
  }
  function createMap(googleMaps) {
    if (map || leafletMap || googleAuthFailed) return;
    map = new googleMaps.Map(mapNode, {
      center: chosen || DEFAULT_CENTER,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      keyboardShortcuts: true,
      gestureHandling: 'greedy',
      zoomControl: true,
    });
    map.addListener('dragstart', () => { touched = true; });
    map.addListener('dragend', () => readout());
    map.addListener('idle', () => readout());
    map.addListener('click', event => {
      if (!event.latLng) return;
      touched = true;
      map.panTo(event.latLng);
      readout();
    });
  }
  async function open() {
    focusReturn = document.activeElement;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('map-open');
    const lat = Number(latitude?.value);
    const lng = Number(longitude?.value);
    if (latitude?.value && longitude?.value && isValid({ lat, lng })) {
      chosen = { lat, lng };
      touched = true;
    } else {
      touched = false;
    }
    readout('Loading Google Maps…');
    $('#close-location-picker')?.focus();
    if (leafletMap) {
      setStatus('Using OpenStreetMap while Google Maps is unavailable.');
      const center = chosen || DEFAULT_CENTER;
      leafletMap.setView([center.lat, center.lng], 15);
      window.setTimeout(() => leafletMap?.invalidateSize(), 60);
      readout();
      return;
    }
    if (googleAuthFailed) {
      await switchToFallback('Previously rejected Google Maps API key');
      return;
    }
    setStatus('');
    try {
      const googleMaps = await loadGoogleMaps();
      if (!modal.classList.contains('open')) return;
      if (googleAuthFailed) throw new Error('Google Maps authentication was rejected.');
      createMap(googleMaps);
      map.setCenter(chosen || DEFAULT_CENTER);
      window.setTimeout(() => {
        if (modal.classList.contains('open')) {
          googleMaps.event.trigger(map, 'resize');
          readout();
        }
      }, 80);
    } catch (error) {
      await switchToFallback(error.message);
    }
  }
  function close() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('map-open');
    focusReturn?.focus?.();
  }
  function selectPosition(lat, lng) {
    if (!isValid({ lat, lng })) return;
    chosen = { lat, lng };
    touched = true;
    if (leafletMap) leafletMap.setView([lat, lng], 16);
    else { map?.setCenter(chosen); map?.setZoom(16); }
    readout();
  }
  function useGps() {
    if (!navigator.geolocation) {
      readout('Location is unavailable in this browser. Choose a spot on the map instead.');
      return;
    }
    readout('Finding your device location…');
    navigator.geolocation.getCurrentPosition(
      p => selectPosition(p.coords.latitude, p.coords.longitude),
      e => readout(`GPS unavailable (${e.message}). You can drag or tap the map to pin your location.`),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }
  function confirm() {
    if (!touched) {
      window.GinhawaUI?.toast('Drag or tap the map, or use GPS, to choose your location first.');
      return;
    }
    const p = positionOf();
    if (!isValid(p)) {
      window.GinhawaUI?.toast('Set a valid map pin or use GPS to continue.');
      return;
    }
    chosen = p;
    latitude.value = p.lat.toFixed(6);
    longitude.value = p.lng.toFixed(6);
    label.textContent = `📍 Pin selected · ${format(p)}`;
    window.dispatchEvent(new CustomEvent('ginhawa:location-changed', { detail: { ...chosen } }));
    close();
  }
  $('#open-location-picker')?.addEventListener('click', open);
  $('#close-location-picker')?.addEventListener('click', close);
  $('#map-use-gps')?.addEventListener('click', useGps);
  $('#map-confirm')?.addEventListener('click', confirm);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('open')) close();
  });
  window.GinhawaLocation = {
    get: () => latitude?.value && longitude?.value
      ? { lat: Number(latitude.value), lng: Number(longitude.value) }
      : null,
    reset: () => {
      latitude.value = '';
      longitude.value = '';
      label.textContent = 'No map pin selected yet';
      chosen = null;
      touched = false;
    },
  };
})();
