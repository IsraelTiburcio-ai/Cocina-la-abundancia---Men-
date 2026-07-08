import { MENU_DATA } from '../menu-data.js';
import { state, persistState } from './state.js';
import { el } from './dom.js';
import {
  formatCurrency,
  setHelper,
  lockBodyScroll,
  unlockBodyScroll,
  restoreFocus,
  installTouchScrollGuards,
} from './ui-helpers.js';
import {
  addItem,
  updateQty,
  removeItem,
  calculateTotals,
  isProductAvailableNow,
  hasValidCoordinates,
  setRenderCart,
} from './cart.js';

let lastOrderTrigger = null;
let lastConfigTrigger = null;
let pendingMapSelection = null;

export function setPendingMapSelection(value) {
  pendingMapSelection = value;
}

export function getPendingMapSelection() {
  return pendingMapSelection;
}

export function setLastOrderTrigger(el) {
  lastOrderTrigger = el instanceof HTMLElement ? el : null;
}

export function setLastConfigTrigger(el) {
  lastConfigTrigger = el instanceof HTMLElement ? el : null;
}

export function restoreInitialAnchor() {
  const anchorId = window.location.hash.slice(1);
  if (!anchorId) return;

  const scrollToAnchor = () => {
    document.getElementById(anchorId)?.scrollIntoView({ block: 'start' });
  };

  requestAnimationFrame(() => requestAnimationFrame(scrollToAnchor));
  window.addEventListener('load', scrollToAnchor, { once: true });
}

export function setActivePanel(panelName) {
  state.ui.panel = panelName;

  el.stepBtns.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.step === panelName);
  });

  el.panels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.panel === panelName);
  });

  document.getElementById('send-step')?.classList.toggle('is-next', panelName === 'checkout');
  if (panelName === 'menu' && el.nextBtn) el.nextBtn.textContent = 'Ir al resumen';
  if (panelName === 'cart' && el.nextBtn) el.nextBtn.textContent = 'Ir a datos';
  if (panelName === 'checkout' && el.nextBtn) el.nextBtn.textContent = 'Volver al resumen';
}

export function openOrderSheet(initialPanel = 'menu', trigger = document.activeElement) {
  setLastOrderTrigger(trigger);
  lockBodyScroll();
  el.orderSheet.hidden = false;
  el.orderBackdrop.hidden = false;

  requestAnimationFrame(() => {
    el.orderSheet.classList.add('is-open');
    el.orderBackdrop.classList.add('is-open');
  });

  setActivePanel(initialPanel);
  if (el.orderSheetScroll) el.orderSheetScroll.scrollTop = 0;
  state.ui.sheetOpen = true;
  el.closeOrderBtn?.focus();
}

export function closeOrderSheet() {
  state.ui.sheetOpen = false;
  el.orderSheet.classList.remove('is-open');
  el.orderBackdrop.classList.remove('is-open');

  window.setTimeout(() => {
    if (!state.ui.sheetOpen) {
      el.orderSheet.hidden = true;
      el.orderBackdrop.hidden = true;
      unlockBodyScroll();
      restoreFocus(lastOrderTrigger);
    }
  }, 200);
}

export function handleNextStep() {
  if (state.ui.panel === 'menu') {
    if (!state.cartItems.length) {
      setHelper('Agrega al menos un producto para continuar.', true);
      return;
    }
    setActivePanel('cart');
    return;
  }

  if (state.ui.panel === 'cart') {
    if (!state.cartItems.length) {
      setHelper('Tu resumen está vacío.', true);
      return;
    }
    setActivePanel('checkout');
    return;
  }

  setActivePanel('cart');
}

export function renderCategoryChips() {
  const html = [...MENU_DATA.categories]
    .sort((a, b) => a.order - b.order)
    .map((category) => {
      const active = category.id === state.activeCategory ? 'is-active' : '';
      return `<button type="button" class="category-chip ${active}" data-category="${category.id}">${category.name}</button>`;
    })
    .join('');

  el.categoryChips.innerHTML = html;
}

export function renderProducts() {
  const products = MENU_DATA.products.filter((p) => p.categoryId === state.activeCategory);
  const html = products.map((product) => renderProductCard(product)).join('');

  el.productGrid.innerHTML = html || '<p>No hay productos en esta categoría.</p>';
}

export function renderLandingMenus() {
  el.landingProductGrids.forEach((grid) => {
    const categoryId = grid.dataset.menuCategory;
    const products = MENU_DATA.products.filter((product) => product.categoryId === categoryId);
    grid.innerHTML =
      products.map((product) => renderProductCard(product, 'landing-product-card')).join('') ||
      '<p>No hay productos en esta categoría.</p>';
  });
}

export function renderProductCard(product, extraClass = '') {
  const availability = isProductAvailableNow(product);
  const disabled = availability.available ? '' : 'disabled';
  const statusText = availability.available
    ? ''
    : `<p class="product-status">${availability.label}</p>`;
  const hasConfig = Array.isArray(product.modifiers) && product.modifiers.length;

  return `
    <article class="product-card ${extraClass} ${availability.available ? '' : 'is-disabled'}">
      <div class="product-card-copy">
        <h4>${product.name}</h4>
        ${product.description ? `<p class="product-desc">${product.description}</p>` : ''}
        ${hasConfig ? '<p class="product-config-label">Elige tus opciones al agregar</p>' : ''}
        ${statusText}
      </div>
      <div class="product-card-action">
        <p class="product-price">${formatCurrency(product.basePrice)}</p>
        <button type="button" data-add-product="${product.id}" ${disabled}>Agregar</button>
      </div>
    </article>
  `;
}

export function handleProductAdd(event) {
  const addBtn = event.target.closest('button[data-add-product]');
  if (!addBtn) return;

  const product = MENU_DATA.products.find((entry) => entry.id === addBtn.dataset.addProduct);
  if (!product) return;

  const availability = isProductAvailableNow(product);
  if (!availability.available) return;

  if (Array.isArray(product.modifiers) && product.modifiers.length > 0) {
    openConfigSheet(product, addBtn);
    return;
  }

  addItem(product, [], 1);
}

function renderCartItemDetails(item) {
  if (!item.selectedModifiers || !item.selectedModifiers.length) return 'Sin configuraciones';
  return item.selectedModifiers.map((entry) => entry.label).join(' · ');
}

export function renderCart() {
  if (!state.cartItems.length) {
    el.cartList.innerHTML = '';
    el.cartEmpty.style.display = 'block';
  } else {
    el.cartEmpty.style.display = 'none';
    el.cartList.innerHTML = state.cartItems
      .map(
        (item) => `
          <article class="cart-item">
            <div>
              <h4>${item.name}</h4>
              <p>${renderCartItemDetails(item)}</p>
              <strong>${formatCurrency(item.lineSubtotal)}</strong>
            </div>
            <div class="cart-actions">
              <div class="qty-control">
                <button type="button" data-cart-minus="${item.id}" aria-label="Restar">−</button>
                <span>${item.qty}</span>
                <button type="button" data-cart-plus="${item.id}" aria-label="Sumar">+</button>
              </div>
              <button type="button" class="remove-btn" data-cart-remove="${item.id}">Quitar</button>
            </div>
          </article>
        `
      )
      .join('');
  }

  const totals = calculateTotals(state);
  el.orderSubtotal.textContent = formatCurrency(totals.subtotal);
  el.orderPackaging.textContent = formatCurrency(totals.packaging);
  if (el.orderShippingDistanceRow && el.orderShippingDistance) {
    if (totals.shippingDistanceKmRaw !== null) {
      el.orderShippingDistanceRow.hidden = false;
      el.orderShippingDistance.textContent = `${totals.shippingDistanceKmRaw} km`;
    } else {
      el.orderShippingDistanceRow.hidden = true;
      el.orderShippingDistance.textContent = '—';
    }
  }
  el.orderShipping.textContent = totals.shippingLabel;
  el.orderTotal.textContent = formatCurrency(totals.total);

  renderOrderBar();
  persistState();
}

export function renderOrderBar() {
  if (!el.orderBarMeta) return;

  const qty = state.cartItems.reduce((sum, item) => sum + item.qty, 0);
  const totals = calculateTotals(state);
  const orderBar = document.getElementById('open-order-sheet');

  if (!qty) {
    el.orderBarMeta.textContent = 'Sin productos';
    orderBar?.setAttribute('aria-label', 'Realizar pedido, sin productos');
    return;
  }

  const summary = `${qty} artículo${qty > 1 ? 's' : ''} · ${formatCurrency(totals.total)}`;
  el.orderBarMeta.textContent = summary;
  orderBar?.setAttribute('aria-label', `Realizar pedido, ${summary}`);
}

export function openConfigSheet(product, trigger = document.activeElement) {
  setLastConfigTrigger(trigger);
  state.config.product = product;
  state.config.qty = 1;
  el.configError.textContent = '';

  el.configTitle.textContent = `Configurar ${product.name}`;
  el.configName.textContent = product.name;
  el.configPrice.textContent = `Desde ${formatCurrency(product.basePrice)}`;
  el.configQty.textContent = '1';

  const optionsHtml = (product.modifiers || [])
    .map((group) => {
      const inputs = (group.options || [])
        .map((option) => {
          const inputType = group.type === 'multi' ? 'checkbox' : 'radio';
          const priceText = option.priceDelta ? ` (+${formatCurrency(option.priceDelta)})` : '';

          return `
            <label class="option-row">
              <input
                type="${inputType}"
                name="mod-${group.id}"
                value="${option.id}"
                data-group-id="${group.id}"
                data-group-label="${group.label}"
                data-group-type="${group.type}"
                data-required="${group.required ? '1' : '0'}"
                data-option-label="${option.label}"
                data-option-price="${option.priceDelta || 0}"
              />
              <span>${option.label}${priceText}</span>
            </label>
          `;
        })
        .join('');

      return `
        <fieldset class="option-group">
          <legend>${group.label}${group.required ? ' *' : ''}</legend>
          ${inputs}
        </fieldset>
      `;
    })
    .join('');

  el.configOptions.innerHTML = optionsHtml;

  lockBodyScroll();
  el.configSheet.hidden = false;
  el.configBackdrop.hidden = false;

  requestAnimationFrame(() => {
    el.configSheet.classList.add('is-open');
    el.configBackdrop.classList.add('is-open');
    el.closeConfigBtn?.focus();
  });
}

export function closeConfigSheet() {
  el.configSheet.classList.remove('is-open');
  el.configBackdrop.classList.remove('is-open');

  window.setTimeout(() => {
    el.configSheet.hidden = true;
    el.configBackdrop.hidden = true;
    unlockBodyScroll();
    restoreFocus(lastConfigTrigger);
  }, 180);
}

export function updateConfigQty(delta) {
  state.config.qty = Math.max(1, state.config.qty + delta);
  el.configQty.textContent = String(state.config.qty);
}

function collectSelectedModifiers(product) {
  const result = [];

  (product.modifiers || []).forEach((group) => {
    const inputs = el.configOptions.querySelectorAll(`input[name="mod-${group.id}"]:checked`);
    inputs.forEach((input) => {
      result.push({
        groupId: group.id,
        groupLabel: group.label,
        optionId: input.value,
        label: input.dataset.optionLabel,
        priceDelta: Number(input.dataset.optionPrice || 0),
      });
    });
  });

  return result;
}

function validateItemConfig(product, selectedModifiers) {
  const modifiers = product.modifiers || [];

  for (const group of modifiers) {
    if (!group.required) continue;

    const hasSelection = selectedModifiers.some((entry) => entry.groupId === group.id);
    if (!hasSelection) {
      return {
        valid: false,
        message: `Selecciona ${group.label.toLowerCase()}.`,
      };
    }
  }

  return { valid: true, message: '' };
}

export function handleAddConfiguredProduct() {
  const product = state.config.product;
  if (!product) return;

  const selectedModifiers = collectSelectedModifiers(product);
  const validation = validateItemConfig(product, selectedModifiers);

  if (!validation.valid) {
    el.configError.textContent = validation.message;
    return;
  }

  addItem(product, selectedModifiers, state.config.qty);
  closeConfigSheet();
}

export function initMenuRender() {
  setRenderCart(renderCart);
  installTouchScrollGuards();
}

export { hasValidCoordinates };
