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
  let googleMapsLoading = null;
  let chosen = null;
  let touched = false;
  let focusReturn = null;
  const format = ({ lat, lng }) => `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
  const positionOf = () => {
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
  function createMap(googleMaps) {
    if (map) return;
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
    try {
      const googleMaps = await loadGoogleMaps();
      if (!modal.classList.contains('open')) return;
      createMap(googleMaps);
      map.setCenter(chosen || DEFAULT_CENTER);
      window.setTimeout(() => {
        if (modal.classList.contains('open')) {
          googleMaps.event.trigger(map, 'resize');
          map.setCenter(chosen || DEFAULT_CENTER);
          readout();
        }
      }, 80);
    } catch (error) {
      readout(`${error.message} You can still try “Use my current location”.`);
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
    map?.setCenter(chosen);
    map?.setZoom(16);
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
