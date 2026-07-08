import { state, persistState } from './state.js';
import { el } from './dom.js';
import { calculateTotals } from './cart.js';
import { formatCurrency, setHelper, announceStatus } from './ui-helpers.js';
import { setActivePanel } from './menu-render.js';

export function validateCheckout(currentState) {
  const errors = [];

  currentState.customer.name = el.customerName?.value.trim() || '';
  currentState.customer.address = el.customerAddress?.value.trim() || '';
  currentState.customer.betweenStreets = el.customerBetweenStreets?.value.trim() || '';
  currentState.customer.references = el.customerReferences?.value.trim() || '';
  currentState.customer.pickupTime = el.pickupTime?.value || '';
  currentState.customer.notes = el.customerNotes?.value.trim() || '';

  if (!currentState.cartItems.length) {
    errors.push({
      message: 'Agrega al menos un producto al pedido.',
      panel: 'menu',
      target: () => el.productGrid?.querySelector('button[data-add-product]:not(:disabled)'),
    });
  }
  if (!currentState.customer.name) {
    errors.push({
      message: 'Tu nombre es obligatorio.',
      panel: 'checkout',
      target: () => el.customerName,
    });
  }

  if (
    currentState.orderMeta.orderType === 'delivery' &&
    !currentState.customer.address &&
    !currentState.customer.location?.mapsUrl
  ) {
    errors.push({
      message: 'Para envío a domicilio, ingresa dirección o comparte tu ubicación.',
      panel: 'checkout',
      target: () => el.customerAddress,
    });
  }

  persistState();
  return errors;
}

export function syncCustomerForm() {
  if (el.customerName) el.customerName.value = state.customer.name || '';
  if (el.customerAddress) el.customerAddress.value = state.customer.address || '';
  if (el.customerBetweenStreets) el.customerBetweenStreets.value = state.customer.betweenStreets || '';
  if (el.customerReferences) el.customerReferences.value = state.customer.references || '';
  if (el.pickupTime) el.pickupTime.value = state.customer.pickupTime || '';
  if (el.customerNotes) el.customerNotes.value = state.customer.notes || '';

  if (state.customer.location?.mapsUrl && el.geoStatus) {
    el.geoStatus.textContent = 'Ubicación seleccionada ✔. Se enviará el link en tu pedido.';
  }
}

export function syncOrderMetaControls() {
  el.orderTypeInputs.forEach((input) => {
    input.checked = input.value === state.orderMeta.orderType;
  });
}

export function syncOrderTypeFields() {
  el.orderTypeSections.forEach((section) => {
    section.hidden = section.dataset.orderSection !== state.orderMeta.orderType;
  });
}
