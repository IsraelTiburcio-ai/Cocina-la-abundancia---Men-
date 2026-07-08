import { MENU_DATA } from '../menu-data.js';
import { state, restoreState, persistState } from './state.js';
import { el } from './dom.js';
import { trapFocus } from './ui-helpers.js';
import { initLandingEffects } from './navigation.js';
import {
  renderCategoryChips,
  renderProducts,
  renderLandingMenus,
  renderCart,
  openOrderSheet,
  closeOrderSheet,
  setActivePanel,
  handleNextStep,
  openConfigSheet,
  closeConfigSheet,
  updateConfigQty,
  handleProductAdd,
  handleAddConfiguredProduct,
  restoreInitialAnchor,
  initMenuRender,
} from './menu-render.js';
import { openMapModal, closeMapModal, confirmMapSelection, handleGeolocation } from './map-picker.js';
import { syncCustomerForm, syncOrderMetaControls, syncOrderTypeFields } from './checkout.js';
import { handleSendOrder } from './whatsapp.js';
import { updateQty, removeItem } from './cart.js';

function initOrderModule() {
  if (!MENU_DATA || !el.orderSheet) return;

  restoreState();

  const orderedCategories = [...MENU_DATA.categories].sort((a, b) => a.order - b.order);
  state.activeCategory = state.activeCategory || orderedCategories[0]?.id || null;

  renderCategoryChips();
  renderProducts();
  renderLandingMenus();
  renderCart();
  syncCustomerForm();
  syncOrderMetaControls();
  syncOrderTypeFields();
  restoreInitialAnchor();

  el.openOrderBtns.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      openOrderSheet(state.cartItems.length ? 'cart' : 'menu', trigger);
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
      syncOrderTypeFields();
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

  el.productGrid?.addEventListener('click', handleProductAdd);
  el.landingProductGrids.forEach((grid) => grid.addEventListener('click', handleProductAdd));

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
    el.pickupTime,
    el.customerNotes,
  ].forEach((field) => {
    field?.addEventListener('input', () => {
      state.customer.name = el.customerName?.value.trim() || '';
      state.customer.address = el.customerAddress?.value.trim() || '';
      state.customer.betweenStreets = el.customerBetweenStreets?.value.trim() || '';
      state.customer.references = el.customerReferences?.value.trim() || '';
      state.customer.pickupTime = el.pickupTime?.value || '';
      state.customer.notes = el.customerNotes?.value.trim() || '';
      persistState();
    });
  });

  el.geoBtn?.addEventListener('click', handleGeolocation);
  el.mapPickerBtn?.addEventListener('click', () => openMapModal(el.mapPickerBtn));
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

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!el.configSheet?.hidden) closeConfigSheet();
      else if (!el.mapPickerModal?.hidden) closeMapModal();
      else if (!el.orderSheet?.hidden) closeOrderSheet();
    }

    if (event.key === 'Tab') {
      if (!el.configSheet?.hidden) {
        trapFocus(event, el.configSheet);
      } else if (!el.mapPickerModal?.hidden) {
        trapFocus(event, el.mapPickerModal);
      } else if (!el.orderSheet?.hidden) {
        trapFocus(event, el.orderSheet);
      }
    }
  });
}

document.body.classList.add('js-enabled');
initLandingEffects();
initMenuRender();
initOrderModule();

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
