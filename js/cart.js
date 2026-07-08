import { MENU_DATA } from '../menu-data.js';
import { state, createItemId, persistState } from './state.js';
import { resolveAvailability, isWithinSchedule } from './availability.js';
import { formatCurrency, setHelper, announceStatus } from './ui-helpers.js';

let renderCartRef = () => {};

export function setRenderCart(fn) {
  renderCartRef = typeof fn === 'function' ? fn : () => {};
}

export function getBusinessLocation() {
  const location = MENU_DATA.businessLocation;
  if (!location || typeof location !== 'object') return null;
  return {
    lat: Number(location.lat),
    lng: Number(location.lng),
    label: location.label || 'Sucursal',
  };
}

export function hasValidCoordinates(point) {
  if (!point || typeof point !== 'object') return false;
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function calculateDistanceKm(from, to) {
  const earthRadiusKm = 6371;
  const lat1 = toRadians(Number(from.lat));
  const lat2 = toRadians(Number(to.lat));
  const deltaLat = toRadians(Number(to.lat) - Number(from.lat));
  const deltaLng = toRadians(Number(to.lng) - Number(from.lng));

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

export function roundDistanceKm(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  return Math.ceil(distanceKm);
}

export function formatDistanceKm(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return 0;
  return Number(distanceKm.toFixed(1));
}

export function calculateShippingFromDistance(distanceKm, ratePerKm) {
  if (!Number.isFinite(ratePerKm) || ratePerKm <= 0) return 0;
  const roundedDistanceKm = roundDistanceKm(distanceKm);
  return roundedDistanceKm * ratePerKm;
}

export function getPickupChargeAmount() {
  return Number(MENU_DATA.pricing?.pickupCharge?.amount || 0);
}

export function resolveShipping(currentState) {
  if (currentState.orderMeta.orderType !== 'delivery') {
    return {
      shippingDistanceKmRaw: null,
      shippingDistanceKmBilled: null,
      shipping: 0,
      shippingLabel: 'No aplica',
    };
  }

  const customerLocation = currentState.customer?.location;
  const businessLocation = getBusinessLocation();
  if (!hasValidCoordinates(customerLocation) || !hasValidCoordinates(businessLocation)) {
    return {
      shippingDistanceKmRaw: null,
      shippingDistanceKmBilled: null,
      shipping: 0,
      shippingLabel: 'Por confirmar',
    };
  }

  const distanceKmRaw = calculateDistanceKm(businessLocation, customerLocation);
  const roundedDistanceKm = roundDistanceKm(distanceKmRaw);
  const displayDistanceKm = formatDistanceKm(distanceKmRaw);
  const ratePerKm = Number(MENU_DATA.pricing?.deliveryPerKm || 0);
  const shipping = calculateShippingFromDistance(distanceKmRaw, ratePerKm);

  return {
    shippingDistanceKmRaw: displayDistanceKm,
    shippingDistanceKmBilled: roundedDistanceKm,
    shipping,
    shippingLabel: `${formatCurrency(shipping)} (${displayDistanceKm} km, cobro ${roundedDistanceKm} km)`,
  };
}

export function calculateTotals(currentState) {
  const subtotal = currentState.cartItems.reduce((sum, item) => sum + item.lineSubtotal, 0);
  const totalQty = currentState.cartItems.reduce((sum, item) => sum + item.qty, 0);

  const packagingAmount = Number(MENU_DATA.pricing?.packaging?.amount || 0);
  const needsPackaging = currentState.orderMeta.orderType !== 'local';
  const packaging = needsPackaging ? packagingAmount * totalQty : 0;
  const pickupCharge = currentState.orderMeta.orderType === 'pickup' ? getPickupChargeAmount() : 0;
  const shippingData = resolveShipping(currentState);
  const shippingNumeric = shippingData.shipping;
  const shippingLabel = shippingData.shippingLabel;

  return {
    subtotal,
    packaging,
    pickupCharge,
    shippingDistanceKmRaw: shippingData.shippingDistanceKmRaw,
    shippingDistanceKmBilled: shippingData.shippingDistanceKmBilled,
    shipping: shippingNumeric,
    shippingLabel,
    total: subtotal + packaging + pickupCharge + shippingNumeric,
  };
}

export function addItem(product, selectedModifiers = [], qty = 1) {
  const unitBase = product.basePrice + selectedModifiers.reduce((sum, mod) => sum + (mod.priceDelta || 0), 0);

  const item = {
    id: createItemId(product.id),
    productId: product.id,
    name: product.name,
    qty,
    unitBase,
    selectedModifiers,
    lineSubtotal: unitBase * qty,
  };

  state.cartItems.push(item);
  persistState();
  renderCartRef();
  setHelper('Producto agregado al pedido.', false);
  announceStatus('Producto agregado al pedido');
}

export function removeItem(itemId) {
  state.cartItems = state.cartItems.filter((entry) => entry.id !== itemId);
  persistState();
  renderCartRef();
}

export function updateQty(itemId, qty) {
  const item = state.cartItems.find((entry) => entry.id === itemId);
  if (!item) return;

  if (qty < 1) {
    removeItem(itemId);
    return;
  }

  item.qty = qty;
  item.lineSubtotal = item.unitBase * item.qty;
  persistState();
  renderCartRef();
}

const dayLabelMap = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
};

export function formatScheduleLabel(availability) {
  const days = (availability.days || []).map((d) => dayLabelMap[d]).join(', ');
  return `${days} ${availability.start}-${availability.end}`.trim();
}

export function isProductAvailableNow(product) {
  const availability = resolveAvailability(product?.availability);

  if (availability.mode === 'always') {
    return { available: true, label: '' };
  }

  if (availability.mode === 'manual') {
    return {
      available: Boolean(availability.available),
      label: availability.label || 'No disponible por el momento',
    };
  }

  if (!isWithinSchedule(availability, new Date(), MENU_DATA?.timezone)) {
    return {
      available: false,
      label: `Disponible: ${formatScheduleLabel(availability)}`,
    };
  }

  return { available: true, label: '' };
}
