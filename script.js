const revealItems = document.querySelectorAll('.reveal');
const nav = document.querySelector('.main-nav');
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelectorAll('.main-nav .nav-links a');
const sections = document.querySelectorAll('section[id]');

const ORDER_PHONE = '525573342834';
const STORAGE_KEY = 'cla_order_state_v2';
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;
let modalOpenDepth = 0;
let lockedScrollY = 0;
let touchGuardsInstalled = false;
let locationMapInstance = null;
let businessMapMarker = null;
let customerMapMarker = null;
let pendingMapSelection = null;

const DEFAULT_ORDER_META = {
  orderType: 'local',
};

const state = {
  activeCategory: null,
  cartItems: [],
  customer: {
    name: '',
    address: '',
    betweenStreets: '',
    references: '',
    notes: '',
    location: null,
  },
  orderMeta: { ...DEFAULT_ORDER_META },
  ui: {
    sheetOpen: false,
    panel: 'menu',
  },
  config: {
    product: null,
    qty: 1,
  },
};

const el = {
  openOrderBtns: document.querySelectorAll('[data-order-trigger]'),
  orderBarMeta: document.getElementById('order-bar-meta'),
  orderSheet: document.getElementById('order-sheet'),
  orderBackdrop: document.getElementById('order-backdrop'),
  closeOrderBtn: document.getElementById('close-order-sheet'),
  stepBtns: document.querySelectorAll('.order-step'),
  panels: document.querySelectorAll('.order-panel'),
  orderSheetScroll: document.getElementById('order-sheet-scroll'),
  categoryChips: document.getElementById('category-chips'),
  productGrid: document.getElementById('product-grid'),
  cartList: document.getElementById('cart-list'),
  cartEmpty: document.getElementById('cart-empty'),
  orderSubtotal: document.getElementById('order-subtotal'),
  orderPackaging: document.getElementById('order-packaging'),
  orderShippingDistanceRow: document.getElementById('order-shipping-distance-row'),
  orderShippingDistance: document.getElementById('order-shipping-distance'),
  orderShipping: document.getElementById('order-shipping'),
  orderTotal: document.getElementById('order-total'),
  nextBtn: document.getElementById('order-next-btn'),
  sendBtn: document.getElementById('send-order-btn'),
  helper: document.getElementById('order-helper'),
  customerName: document.getElementById('customer-name'),
  customerAddress: document.getElementById('customer-address'),
  customerBetweenStreets: document.getElementById('customer-between-streets'),
  customerReferences: document.getElementById('customer-references'),
  customerNotes: document.getElementById('customer-notes'),
  geoBtn: document.getElementById('geo-btn'),
  mapPickerBtn: document.getElementById('map-picker-btn'),
  geoStatus: document.getElementById('geo-status'),
  mapPickerBackdrop: document.getElementById('map-picker-backdrop'),
  mapPickerModal: document.getElementById('map-picker-modal'),
  closeMapPickerBtn: document.getElementById('close-map-picker'),
  cancelMapPickerBtn: document.getElementById('cancel-map-picker-btn'),
  confirmMapPickerBtn: document.getElementById('confirm-map-picker-btn'),
  mapPickerStatus: document.getElementById('map-picker-status'),
  locationMap: document.getElementById('location-map'),
  orderTypeInputs: document.querySelectorAll('input[name="order-type"]'),
  configSheet: document.getElementById('config-sheet'),
  configBackdrop: document.getElementById('config-backdrop'),
  configTitle: document.getElementById('config-title'),
  configName: document.getElementById('config-product-name'),
  configPrice: document.getElementById('config-product-price'),
  configOptions: document.getElementById('config-options'),
  configQty: document.getElementById('config-qty'),
  configError: document.getElementById('config-error'),
  configQtyDec: document.getElementById('config-qty-dec'),
  configQtyInc: document.getElementById('config-qty-inc'),
  closeConfigBtn: document.getElementById('close-config-sheet'),
  cancelConfigBtn: document.getElementById('cancel-config-btn'),
  addConfigBtn: document.getElementById('add-config-btn'),
};

document.body.classList.add('js-enabled');
initLandingEffects();
initOrderModule();

function initLandingEffects() {
  if (!('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
      },
      { threshold: 0.12 }
    );

    revealItems.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index * 40, 220)}ms`;
      revealObserver.observe(item);
    });
  }

  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.getAttribute('id');
          navLinks.forEach((link) => {
            link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
          });
        });
      },
      { threshold: 0.55 }
    );

    sections.forEach((section) => sectionObserver.observe(section));
  }

  if (!nav || !navToggle) return;

  const closeMenu = () => {
    nav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  };

  navToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  navLinks.forEach((link) => link.addEventListener('click', closeMenu));

  document.addEventListener('click', (event) => {
    if (!nav.classList.contains('is-open')) return;
    if (nav.contains(event.target)) return;
    closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeMenu();
  });

  const updateScrolledNav = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 8);
  };

  updateScrolledNav();
  window.addEventListener('scroll', updateScrolledNav, { passive: true });
}

function initOrderModule() {
  if (!window.MENU_DATA || !el.orderSheet) return;

  restoreState();

  const orderedCategories = [...MENU_DATA.categories].sort((a, b) => a.order - b.order);
  state.activeCategory = state.activeCategory || orderedCategories[0]?.id || null;

  renderCategoryChips();
  renderProducts();
  renderCart();
  renderOrderBar();
  syncCustomerForm();
  syncOrderMetaControls();

  el.openOrderBtns.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      openOrderSheet(state.cartItems.length ? 'cart' : 'menu');
    });
  });

  el.closeOrderBtn?.addEventListener('click', closeOrderSheet);
  el.orderBackdrop?.addEventListener('click', closeOrderSheet);

  el.stepBtns.forEach((btn) => {
    btn.addEventListener('click', () => setActivePanel(btn.dataset.step));
  });

  el.nextBtn?.addEventListener('click', handleNextStep);
  el.sendBtn?.addEventListener('click', handleSendOrder);

  el.orderTypeInputs.forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      state.orderMeta.orderType = input.value;
      renderCart();
      persistState();
    });
  });

  el.categoryChips?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-category]');
    if (!btn) return;
    state.activeCategory = btn.dataset.category;
    renderCategoryChips();
    renderProducts();
  });

  el.productGrid?.addEventListener('click', (event) => {
    const addBtn = event.target.closest('button[data-add-product]');
    if (!addBtn) return;

    const product = MENU_DATA.products.find((p) => p.id === addBtn.dataset.addProduct);
    if (!product) return;

    const availability = isProductAvailableNow(product);
    if (!availability.available) return;

    if (Array.isArray(product.modifiers) && product.modifiers.length > 0) {
      openConfigSheet(product);
      return;
    }

    addItem(product, [], 1);
  });

  el.cartList?.addEventListener('click', (event) => {
    const plus = event.target.closest('button[data-cart-plus]');
    const minus = event.target.closest('button[data-cart-minus]');
    const remove = event.target.closest('button[data-cart-remove]');

    if (plus) {
      const item = state.cartItems.find((entry) => entry.id === plus.dataset.cartPlus);
      if (item) updateQty(item.id, item.qty + 1);
    }

    if (minus) {
      const item = state.cartItems.find((entry) => entry.id === minus.dataset.cartMinus);
      if (item) updateQty(item.id, item.qty - 1);
    }

    if (remove) removeItem(remove.dataset.cartRemove);
  });

  [
    el.customerName,
    el.customerAddress,
    el.customerBetweenStreets,
    el.customerReferences,
    el.customerNotes,
  ].forEach((field) => {
    field?.addEventListener('input', () => {
      state.customer.name = el.customerName?.value.trim() || '';
      state.customer.address = el.customerAddress?.value.trim() || '';
      state.customer.betweenStreets = el.customerBetweenStreets?.value.trim() || '';
      state.customer.references = el.customerReferences?.value.trim() || '';
      state.customer.notes = el.customerNotes?.value.trim() || '';
      persistState();
    });
  });

  el.geoBtn?.addEventListener('click', handleGeolocation);
  el.mapPickerBtn?.addEventListener('click', openMapModal);
  el.closeMapPickerBtn?.addEventListener('click', closeMapModal);
  el.cancelMapPickerBtn?.addEventListener('click', closeMapModal);
  el.mapPickerBackdrop?.addEventListener('click', closeMapModal);
  el.confirmMapPickerBtn?.addEventListener('click', confirmMapSelection);

  el.closeConfigBtn?.addEventListener('click', closeConfigSheet);
  el.cancelConfigBtn?.addEventListener('click', closeConfigSheet);
  el.configBackdrop?.addEventListener('click', closeConfigSheet);
  el.configQtyInc?.addEventListener('click', () => updateConfigQty(1));
  el.configQtyDec?.addEventListener('click', () => updateConfigQty(-1));
  el.addConfigBtn?.addEventListener('click', handleAddConfiguredProduct);
  installTouchScrollGuards();

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!el.configSheet?.hidden) closeConfigSheet();
      else if (!el.mapPickerModal?.hidden) closeMapModal();
      else if (!el.orderSheet?.hidden) closeOrderSheet();
    }

    if (event.key === 'Tab') {
      if (!el.mapPickerModal?.hidden) {
        trapFocus(event, el.mapPickerModal);
      } else if (!el.orderSheet?.hidden) {
        trapFocus(event, el.orderSheet);
      }
    }
  });
}

function setActivePanel(panelName) {
  state.ui.panel = panelName;

  el.stepBtns.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.step === panelName);
  });

  el.panels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.panel === panelName);
  });

  if (panelName === 'menu') el.nextBtn.textContent = 'Ir al resumen';
  if (panelName === 'cart') el.nextBtn.textContent = 'Ir a datos';
  if (panelName === 'checkout') el.nextBtn.textContent = 'Volver al resumen';
}

function openOrderSheet(initialPanel = 'menu') {
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

function closeOrderSheet() {
  state.ui.sheetOpen = false;
  el.orderSheet.classList.remove('is-open');
  el.orderBackdrop.classList.remove('is-open');

  window.setTimeout(() => {
    if (!state.ui.sheetOpen) {
      el.orderSheet.hidden = true;
      el.orderBackdrop.hidden = true;
      unlockBodyScroll();
    }
  }, 200);
}

function handleNextStep() {
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

function renderCategoryChips() {
  const html = [...MENU_DATA.categories]
    .sort((a, b) => a.order - b.order)
    .map((category) => {
      const active = category.id === state.activeCategory ? 'is-active' : '';
      return `<button type="button" class="category-chip ${active}" data-category="${category.id}">${category.name}</button>`;
    })
    .join('');

  el.categoryChips.innerHTML = html;
}

function renderProducts() {
  const products = MENU_DATA.products.filter((p) => p.categoryId === state.activeCategory);

  const html = products
    .map((product) => {
      const availability = isProductAvailableNow(product);
      const disabled = availability.available ? '' : 'disabled';
      const statusText = availability.available ? '' : `<p class="product-status">${availability.label}</p>`;
      const hasConfig = Array.isArray(product.modifiers) && product.modifiers.length;

      return `
        <article class="product-card ${availability.available ? '' : 'is-disabled'}">
          <h4>${product.name}</h4>
          <p class="product-price">${formatCurrency(product.basePrice)}</p>
          ${product.description ? `<p class="product-desc">${product.description}</p>` : ''}
          ${hasConfig ? '<p class="product-desc">Configurable</p>' : ''}
          ${statusText}
          <button type="button" data-add-product="${product.id}" ${disabled}>Agregar</button>
        </article>
      `;
    })
    .join('');

  el.productGrid.innerHTML = html || '<p>No hay productos en esta categoría.</p>';
}

function renderCart() {
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

function renderCartItemDetails(item) {
  if (!item.selectedModifiers || !item.selectedModifiers.length) return 'Sin configuraciones';
  return item.selectedModifiers.map((entry) => entry.label).join(' · ');
}

function renderOrderBar() {
  if (!el.orderBarMeta) return;

  const qty = state.cartItems.reduce((sum, item) => sum + item.qty, 0);
  const totals = calculateTotals(state);

  if (!qty) {
    el.orderBarMeta.textContent = 'Sin productos';
    return;
  }

  el.orderBarMeta.textContent = `${qty} artículo${qty > 1 ? 's' : ''} · ${formatCurrency(totals.total)}`;
}

function openConfigSheet(product) {
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
  });
}

function closeConfigSheet() {
  el.configSheet.classList.remove('is-open');
  el.configBackdrop.classList.remove('is-open');

  window.setTimeout(() => {
    el.configSheet.hidden = true;
    el.configBackdrop.hidden = true;
    unlockBodyScroll();
  }, 180);
}

function openMapModal() {
  if (!el.mapPickerModal || !el.mapPickerBackdrop) return;

  lockBodyScroll();
  el.mapPickerModal.hidden = false;
  el.mapPickerBackdrop.hidden = false;

  requestAnimationFrame(() => {
    el.mapPickerModal.classList.add('is-open');
    el.mapPickerBackdrop.classList.add('is-open');
  });

  pendingMapSelection = hasValidCoordinates(state.customer.location)
    ? { lat: Number(state.customer.location.lat), lng: Number(state.customer.location.lng) }
    : null;

  initMap();
  refreshMapSelectionUI();
  el.closeMapPickerBtn?.focus();
}

function closeMapModal() {
  if (!el.mapPickerModal || !el.mapPickerBackdrop) return;

  el.mapPickerModal.classList.remove('is-open');
  el.mapPickerBackdrop.classList.remove('is-open');

  window.setTimeout(() => {
    el.mapPickerModal.hidden = true;
    el.mapPickerBackdrop.hidden = true;
    unlockBodyScroll();
  }, 180);
}

function confirmMapSelection() {
  const selected = pendingMapSelection || getCenterSelection();
  if (!selected) {
    if (el.mapPickerStatus) {
      el.mapPickerStatus.textContent = 'Selecciona un punto en el mapa antes de confirmar.';
    }
    return;
  }

  setCustomerLocation(selected.lat, selected.lng, 'map');
  closeMapModal();
}

function lockBodyScroll() {
  if (modalOpenDepth === 0) {
    lockedScrollY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }
  modalOpenDepth += 1;
}

function unlockBodyScroll() {
  if (modalOpenDepth === 0) return;
  modalOpenDepth -= 1;
  if (modalOpenDepth > 0) return;

  document.documentElement.classList.remove('modal-open');
  document.body.classList.remove('modal-open');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, lockedScrollY);
}

function installTouchScrollGuards() {
  if (touchGuardsInstalled) return;
  touchGuardsInstalled = true;

  [el.orderBackdrop, el.configBackdrop, el.mapPickerBackdrop].forEach((backdrop) => {
    if (!backdrop) return;
    backdrop.addEventListener(
      'touchmove',
      (event) => {
        event.preventDefault();
      },
      { passive: false }
    );
  });

  const installSheetTouchGuard = (sheet, isOpen, findScroller) => {
    if (!sheet) return;
    let lastY = 0;

    sheet.addEventListener(
      'touchstart',
      (event) => {
        if (!isOpen()) return;
        lastY = event.touches[0]?.clientY || 0;
      },
      { passive: true }
    );

    sheet.addEventListener(
      'touchmove',
      (event) => {
        if (!isOpen()) return;

        const activeScroller = findScroller(event.target);
        if (!activeScroller) {
          event.preventDefault();
          return;
        }

        const currentY = event.touches[0]?.clientY || 0;
        const deltaY = currentY - lastY;
        lastY = currentY;

        const canScroll = activeScroller.scrollHeight > activeScroller.clientHeight;
        if (!canScroll) {
          event.preventDefault();
          return;
        }

        const atTop = activeScroller.scrollTop <= 0;
        const atBottom =
          activeScroller.scrollTop + activeScroller.clientHeight >= activeScroller.scrollHeight - 1;

        if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
          event.preventDefault();
        }
      },
      { passive: false }
    );
  };

  installSheetTouchGuard(
    el.orderSheet,
    () => el.orderSheet?.classList.contains('is-open'),
    (target) => target.closest('.order-sheet-scroll')
  );

  installSheetTouchGuard(
    el.configSheet,
    () => el.configSheet?.classList.contains('is-open'),
    (target) => target.closest('.config-body')
  );
}

function updateConfigQty(delta) {
  state.config.qty = Math.max(1, state.config.qty + delta);
  el.configQty.textContent = String(state.config.qty);
}

function handleAddConfiguredProduct() {
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
  setActivePanel('cart');
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

function addItem(product, selectedModifiers = [], qty = 1) {
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
  renderCart();
  setHelper('Producto agregado al pedido.', false);
}

function removeItem(itemId) {
  state.cartItems = state.cartItems.filter((entry) => entry.id !== itemId);
  renderCart();
}

function updateQty(itemId, qty) {
  const item = state.cartItems.find((entry) => entry.id === itemId);
  if (!item) return;

  if (qty < 1) {
    removeItem(itemId);
    return;
  }

  item.qty = qty;
  item.lineSubtotal = item.unitBase * item.qty;
  renderCart();
}

function calculateTotals(currentState) {
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

function getPickupChargeAmount() {
  return Number(MENU_DATA.pricing?.pickupCharge?.amount || 0);
}

function resolveShipping(currentState) {
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

function getBusinessLocation() {
  const location = MENU_DATA.businessLocation;
  if (!location || typeof location !== 'object') return null;
  return {
    lat: Number(location.lat),
    lng: Number(location.lng),
    label: location.label || 'Sucursal',
  };
}

function hasValidCoordinates(point) {
  if (!point || typeof point !== 'object') return false;
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function calculateDistanceKm(from, to) {
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

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function roundDistanceKm(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  return Math.ceil(distanceKm);
}

function formatDistanceKm(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return 0;
  return Number(distanceKm.toFixed(1));
}

function calculateShippingFromDistance(distanceKm, ratePerKm) {
  if (!Number.isFinite(ratePerKm) || ratePerKm <= 0) return 0;
  const roundedDistanceKm = roundDistanceKm(distanceKm);
  return roundedDistanceKm * ratePerKm;
}

function isProductAvailableNow(product) {
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

function formatScheduleLabel(availability) {
  const dayMap = {
    0: 'Dom',
    1: 'Lun',
    2: 'Mar',
    3: 'Mié',
    4: 'Jue',
    5: 'Vie',
    6: 'Sáb',
  };

  const days = (availability.days || []).map((d) => dayMap[d]).join(', ');
  return `${days} ${availability.start}-${availability.end}`.trim();
}

function resolveAvailability(entityAvailability) {
  const fallback = { mode: 'always' };
  if (!entityAvailability || typeof entityAvailability !== 'object') return fallback;

  const allowedModes = ['always', 'schedule', 'manual'];
  if (!allowedModes.includes(entityAvailability.mode)) return fallback;
  return entityAvailability;
}

function isWithinSchedule(availability, now, timezone) {
  const localNow = getLocalDateParts(now, timezone || 'America/Mexico_City');
  const day = localNow.day;
  const minutes = localNow.hour * 60 + localNow.minute;

  const days = Array.isArray(availability.days) ? availability.days : [];
  const start = parseTimeToMinutes(availability.start, 0);
  const end = parseTimeToMinutes(availability.end, 23 * 60 + 59);

  const inDay = !days.length || days.includes(day);
  if (!inDay) return false;

  if (end >= start) {
    return minutes >= start && minutes <= end;
  }

  // Rango nocturno (ej. 22:00-03:00)
  return minutes >= start || minutes <= end;
}

function parseTimeToMinutes(value, fallback) {
  const [h, m] = String(value || '')
    .split(':')
    .map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return fallback;
  return h * 60 + m;
}

function getLocalDateParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value || 'Sun';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);

  const dayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return { day: dayMap[weekday] ?? 0, hour, minute };
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
    pendingMapSelection ||
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
      if (!pendingMapSelection) refreshMapSelectionUI();
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

  if (pendingMapSelection) {
    ensureCustomerMapMarker(pendingMapSelection.lat, pendingMapSelection.lng);
    locationMapInstance.setView([pendingMapSelection.lat, pendingMapSelection.lng], 16);
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
  pendingMapSelection = { lat: Number(latlng.lat), lng: Number(latlng.lng) };
  ensureCustomerMapMarker(pendingMapSelection.lat, pendingMapSelection.lng);
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

  const selected = pendingMapSelection;
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

function handleGeolocation() {
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

function buildMapsLink(lat, lng) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function validateCheckout(currentState) {
  const errors = [];

  currentState.customer.name = el.customerName?.value.trim() || '';
  currentState.customer.address = el.customerAddress?.value.trim() || '';
  currentState.customer.betweenStreets = el.customerBetweenStreets?.value.trim() || '';
  currentState.customer.references = el.customerReferences?.value.trim() || '';
  currentState.customer.notes = el.customerNotes?.value.trim() || '';

  if (!currentState.cartItems.length) errors.push('Agrega al menos un producto al pedido.');
  if (!currentState.customer.name) errors.push('Tu nombre es obligatorio.');

  if (
    currentState.orderMeta.orderType === 'delivery' &&
    !currentState.customer.address &&
    !currentState.customer.location?.mapsUrl
  ) {
    errors.push('Para envío a domicilio, ingresa dirección o comparte tu ubicación.');
  }

  persistState();
  return errors;
}

function handleSendOrder() {
  const errors = validateCheckout(state);

  if (errors.length) {
    setHelper(errors[0], true);
    if (state.ui.panel !== 'checkout') setActivePanel('checkout');
    return;
  }

  const totals = calculateTotals(state);
  const message = generateWhatsAppMessage(state, totals);
  const url = `https://wa.me/${ORDER_PHONE}?text=${encodeURIComponent(message)}`;

  window.open(url, '_blank', 'noopener,noreferrer');
  setHelper('Abriendo WhatsApp con tu pedido...', false);
}

function generateWhatsAppMessage(currentState, totals) {
  const lines = [];

  lines.push('Hola, buen día.');
  lines.push(`Mi nombre es ${currentState.customer.name}`);
  lines.push('');
  lines.push(`Tipo de pedido: ${formatOrderType(currentState.orderMeta.orderType)}`);
  lines.push('');
  lines.push('Dirección:');

  if (currentState.customer.address) {
    lines.push(currentState.customer.address);
  } else {
    lines.push('No proporcionada');
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

  return lines.join('\n');
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

function formatOrderType(orderType) {
  if (orderType === 'pickup') return 'Para llevar';
  if (orderType === 'delivery') return 'Envío a domicilio';
  return 'Consumo local';
}

function setHelper(message, isError) {
  if (!el.helper) return;
  el.helper.textContent = message;
  el.helper.classList.toggle('is-error', Boolean(isError));
}

function syncCustomerForm() {
  if (el.customerName) el.customerName.value = state.customer.name || '';
  if (el.customerAddress) el.customerAddress.value = state.customer.address || '';
  if (el.customerBetweenStreets) el.customerBetweenStreets.value = state.customer.betweenStreets || '';
  if (el.customerReferences) el.customerReferences.value = state.customer.references || '';
  if (el.customerNotes) el.customerNotes.value = state.customer.notes || '';

  if (state.customer.location?.mapsUrl && el.geoStatus) {
    el.geoStatus.textContent = 'Ubicación seleccionada ✔. Se enviará el link en tu pedido.';
  }
}

function syncOrderMetaControls() {
  el.orderTypeInputs.forEach((input) => {
    input.checked = input.value === state.orderMeta.orderType;
  });
}

function persistState() {
  const payload = {
    expiresAt: Date.now() + STORAGE_TTL_MS,
    data: {
      activeCategory: state.activeCategory,
      cartItems: state.cartItems,
      customer: state.customer,
      orderMeta: state.orderMeta,
    },
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function restoreState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!parsed?.expiresAt || parsed.expiresAt < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    if (parsed.data?.activeCategory) state.activeCategory = parsed.data.activeCategory;
    if (Array.isArray(parsed.data?.cartItems)) state.cartItems = parsed.data.cartItems;
    if (parsed.data?.customer) state.customer = { ...state.customer, ...parsed.data.customer };
    if (parsed.data?.orderMeta) {
      state.orderMeta = {
        ...DEFAULT_ORDER_META,
        ...parsed.data.orderMeta,
      };
    }

    normalizeCartItems();
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function normalizeCartItems() {
  state.cartItems = state.cartItems
    .map((item) => {
      const qty = Number(item.qty) || 1;
      const unitBase = Number(item.unitBase) || 0;

      return {
        ...item,
        id: item.id || createItemId(item.productId || 'item'),
        qty,
        unitBase,
        selectedModifiers: Array.isArray(item.selectedModifiers) ? item.selectedModifiers : [],
        lineSubtotal: unitBase * qty,
      };
    })
    .filter((item) => Number.isFinite(item.lineSubtotal));
}

function createItemId(productId) {
  if (window.crypto?.randomUUID) return `${productId}-${window.crypto.randomUUID()}`;
  return `${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function trapFocus(event, container) {
  const focusable = container.querySelectorAll(
    'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
  );

  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  }

  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount);
}
