import { state, persistState } from './state.js';
import { el } from './dom.js';
import { getBusinessLocation, hasValidCoordinates } from './cart.js';
import { lockBodyScroll, unlockBodyScroll, restoreFocus } from './ui-helpers.js';
import { renderCart } from './menu-render.js';

let locationMapInstance = null;
let businessMapMarker = null;
let customerMapMarker = null;
let pendingMapSelection = null;
let lastMapTrigger = null;

function setPendingMap(value) {
  pendingMapSelection = value;
}

function getPendingMap() {
  return pendingMapSelection;
}

export function openMapModal(trigger = document.activeElement) {
  if (!el.mapPickerModal || !el.mapPickerBackdrop) return;

  lastMapTrigger = trigger instanceof HTMLElement ? trigger : null;
  lockBodyScroll();
  el.mapPickerModal.hidden = false;
  el.mapPickerBackdrop.hidden = false;

  requestAnimationFrame(() => {
    el.mapPickerModal.classList.add('is-open');
    el.mapPickerBackdrop.classList.add('is-open');
  });

  setPendingMap(
    hasValidCoordinates(state.customer.location)
      ? { lat: Number(state.customer.location.lat), lng: Number(state.customer.location.lng) }
      : null
  );

  initMap();
  refreshMapSelectionUI();
  el.closeMapPickerBtn?.focus();
}

export function closeMapModal() {
  if (!el.mapPickerModal || !el.mapPickerBackdrop) return;

  el.mapPickerModal.classList.remove('is-open');
  el.mapPickerBackdrop.classList.remove('is-open');

  window.setTimeout(() => {
    el.mapPickerModal.hidden = true;
    el.mapPickerBackdrop.hidden = true;
    unlockBodyScroll();
    restoreFocus(lastMapTrigger);
  }, 180);
}

function initMap() {
  if (!el.locationMap || !el.mapPickerStatus) return;
  if (!window.L) {
    el.mapPickerStatus.textContent = 'No se pudo cargar el mapa. Puedes usar ubicación actual o dirección manual.';
    return;
  }

  const businessLocation = getBusinessLocation();
  const selectedLocation = hasValidCoordinates(state.customer.location)
    ? { lat: Number(state.customer.location.lat), lng: Number(state.customer.location.lng) }
    : null;
  const initialCenter =
    getPendingMap() ||
    selectedLocation ||
    businessLocation || {
      lat: 19.4326,
      lng: -99.1332,
    };

  if (!locationMapInstance) {
    locationMapInstance = window.L.map(el.locationMap, {
      zoomControl: true,
      attributionControl: true,
    }).setView([initialCenter.lat, initialCenter.lng], 15);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(locationMapInstance);

    locationMapInstance.on('click', (event) => {
      handleMapClick(event.latlng);
    });
    locationMapInstance.on('moveend', () => {
      if (!getPendingMap()) refreshMapSelectionUI();
    });
  }

  if (businessLocation) {
    if (!businessMapMarker) {
      businessMapMarker = window.L.marker([businessLocation.lat, businessLocation.lng], {
        title: businessLocation.label || 'Negocio',
      }).addTo(locationMapInstance);
    } else {
      businessMapMarker.setLatLng([businessLocation.lat, businessLocation.lng]);
    }
  }

  if (getPendingMap()) {
    ensureCustomerMapMarker(getPendingMap().lat, getPendingMap().lng);
    locationMapInstance.setView([getPendingMap().lat, getPendingMap().lng], 16);
  } else {
    if (customerMapMarker) {
      locationMapInstance.removeLayer(customerMapMarker);
      customerMapMarker = null;
    }
    locationMapInstance.setView([initialCenter.lat, initialCenter.lng], 15);
  }

  window.setTimeout(() => {
    locationMapInstance?.invalidateSize();
  }, 80);
}

function handleMapClick(latlng) {
  if (!latlng) return;
  setPendingMap({ lat: Number(latlng.lat), lng: Number(latlng.lng) });
  ensureCustomerMapMarker(getPendingMap().lat, getPendingMap().lng);
  refreshMapSelectionUI();
}

function ensureCustomerMapMarker(lat, lng) {
  if (!locationMapInstance || !window.L) return;

  if (!customerMapMarker) {
    customerMapMarker = window.L.marker([lat, lng], {
      draggable: false,
      title: 'Ubicación de entrega',
    }).addTo(locationMapInstance);
    return;
  }

  customerMapMarker.setLatLng([lat, lng]);
}

function getCenterSelection() {
  if (!locationMapInstance) return null;
  const center = locationMapInstance.getCenter();
  if (!center) return null;
  return { lat: Number(center.lat), lng: Number(center.lng) };
}

function refreshMapSelectionUI() {
  if (!el.mapPickerStatus) return;

  const selected = getPendingMap();
  if (selected) {
    el.mapPickerStatus.textContent = `Ubicación seleccionada ✔ (${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)})`;
    return;
  }

  const center = getCenterSelection();
  if (center) {
    el.mapPickerStatus.textContent = `Centro del mapa listo: ${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;
    return;
  }

  el.mapPickerStatus.textContent = 'Sin punto seleccionado.';
}

function buildMapsLink(lat, lng) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function setCustomerLocation(lat, lng, source = 'manual') {
  const safeLat = Number(lat);
  const safeLng = Number(lng);
  if (!Number.isFinite(safeLat) || !Number.isFinite(safeLng)) return;

  const mapsUrl = buildMapsLink(safeLat, safeLng);
  state.customer.location = { lat: safeLat, lng: safeLng, mapsUrl };
  if (source === 'map') {
    el.geoStatus.textContent = 'Ubicación seleccionada ✔ desde el mapa.';
  } else {
    el.geoStatus.textContent = 'Ubicación capturada. Se enviará el link en tu pedido.';
  }
  renderCart();
  persistState();
}

export function handleGeolocation() {
  if (!navigator.geolocation) {
    state.customer.location = null;
    el.geoStatus.textContent = 'Tu navegador no soporta ubicación. Escribe dirección manual.';
    renderCart();
    persistState();
    return;
  }

  el.geoStatus.textContent = 'Solicitando ubicación...';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setCustomerLocation(lat, lng, 'geolocation');
    },
    () => {
      state.customer.location = null;
      el.geoStatus.textContent = 'No se pudo obtener ubicación. Puedes continuar con dirección manual.';
      renderCart();
      persistState();
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    }
  );
}

export function confirmMapSelection() {
  const selected = getPendingMap() || getCenterSelection();
  if (!selected) {
    if (el.mapPickerStatus) {
      el.mapPickerStatus.textContent = 'Selecciona un punto en el mapa antes de confirmar.';
    }
    return;
  }

  setCustomerLocation(selected.lat, selected.lng, 'map');
  closeMapModal();
}
