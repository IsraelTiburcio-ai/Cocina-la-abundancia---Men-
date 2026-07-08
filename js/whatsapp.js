import { state } from './state.js';
import { el } from './dom.js';
import { calculateTotals } from './cart.js';
import { formatCurrency, setHelper, announceStatus } from './ui-helpers.js';
import { setActivePanel } from './menu-render.js';
import { validateCheckout } from './checkout.js';

export const ORDER_PHONE = '525573342834';

export function formatOrderType(orderType) {
  if (orderType === 'pickup') return 'Para llevar';
  if (orderType === 'delivery') return 'Envío a domicilio';
  return 'Consumo local';
}

function normalizeModifierLabel(groupLabel, optionLabel, priceDelta) {
  const group = String(groupLabel || '').trim().toLowerCase();
  const option = String(optionLabel || '').trim();

  if (group.includes('prepar')) return 'Preparación';
  if (group.includes('relleno')) return 'Relleno';
  if (group.includes('tipo') || group.includes('versi')) return 'Tipo';
  if (group.includes('extra')) return option || 'Extra';
  if ((priceDelta || 0) > 0) return option || 'Extra';

  return groupLabel || 'Opción';
}

function formatItemModifiersForMessage(item) {
  if (!Array.isArray(item.selectedModifiers) || !item.selectedModifiers.length) return [];

  return item.selectedModifiers.map((modifier) => {
    const label = normalizeModifierLabel(modifier.groupLabel, modifier.label, modifier.priceDelta);
    if ((modifier.priceDelta || 0) > 0) {
      return `${label}: +${formatCurrency(modifier.priceDelta)}`;
    }
    return `${label}: ${modifier.label}`;
  });
}

export function generateWhatsAppMessage(currentState, totals) {
  const lines = [];

  lines.push('Hola, buen día.');
  lines.push(`Mi nombre es ${currentState.customer.name}`);
  lines.push('');
  lines.push(`Tipo de pedido: ${formatOrderType(currentState.orderMeta.orderType)}`);

  if (currentState.orderMeta.orderType === 'pickup' && currentState.customer.pickupTime) {
    lines.push(`Hora estimada de recolección: ${currentState.customer.pickupTime}`);
  }

  if (currentState.orderMeta.orderType === 'delivery') {
    lines.push('');
    lines.push('Dirección de entrega:');

    if (currentState.customer.address) {
      lines.push(currentState.customer.address);
    }

    if (currentState.customer.betweenStreets) {
      lines.push(`Entre calles: ${currentState.customer.betweenStreets}`);
    }

    if (currentState.customer.references) {
      lines.push(`Referencias: ${currentState.customer.references}`);
    }

    if (currentState.customer.location?.mapsUrl) {
      lines.push(currentState.customer.location.mapsUrl);
    }
  }

  lines.push('');
  lines.push('ORDEN:');

  currentState.cartItems.forEach((item) => {
    const unitPriceLabel =
      item.qty > 1 ? `${formatCurrency(item.unitBase)} c/u` : `${formatCurrency(item.unitBase)}`;
    lines.push(`- ${item.qty} x ${item.name} — ${unitPriceLabel}`);

    const modifierLines = formatItemModifiersForMessage(item);
    modifierLines.forEach((line) => lines.push(`  ${line}`));
    lines.push(`  Subtotal línea: ${formatCurrency(item.lineSubtotal)}`);
    lines.push('');
  });

  lines.push(`SUBTOTAL PRODUCTOS: ${formatCurrency(totals.subtotal)}`);
  lines.push(`EMPAQUE: ${formatCurrency(totals.packaging)}`);
  if (totals.pickupCharge > 0) {
    lines.push(`CARGO POR LLEVAR: ${formatCurrency(totals.pickupCharge)}`);
  }
  if (totals.shippingDistanceKmRaw !== null) {
    lines.push(`DISTANCIA ESTIMADA: ${totals.shippingDistanceKmRaw} km`);
  }
  lines.push(`ENVÍO: ${totals.shippingLabel}`);
  if (currentState.orderMeta.orderType === 'delivery' && totals.shippingDistanceKmRaw === null) {
    lines.push('Costo de envío pendiente de validación manual.');
  }
  lines.push(`TOTAL ESTIMADO: ${formatCurrency(totals.total)}`);

  if (currentState.customer.notes) {
    lines.push('');
    lines.push('Notas:');
    lines.push(currentState.customer.notes);
  }

  lines.push('');
  lines.push('Entiendo que la disponibilidad y el envío se confirman por WhatsApp.');

  return lines.join('\n');
}

export function handleSendOrder() {
  const errors = validateCheckout(state);

  if (errors.length) {
    const firstError = errors[0];
    setHelper(firstError.message, true);
    announceStatus(firstError.message);
    setActivePanel(firstError.panel);
    requestAnimationFrame(() => {
      firstError.target()?.focus();
    });
    return;
  }

  const totals = calculateTotals(state);
  const message = generateWhatsAppMessage(state, totals);
  const url = `https://wa.me/${ORDER_PHONE}?text=${encodeURIComponent(message)}`;

  if (url.length > 2000) {
    setHelper('Tu pedido es muy largo para WhatsApp. Reduce productos o mándalo en 2 partes.', true);
    return;
  }

  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) {
    setHelper('No se pudo abrir WhatsApp. Copia el mensaje y mándalo al 55 7334 2834.', true);
    return;
  }
  setHelper('Abriendo WhatsApp con tu pedido...', false);
}
