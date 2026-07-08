import { MENU_DATA } from '../menu-data.js';

export const STORAGE_KEY = 'cla_order_state_v3';
export const STORAGE_VERSION = 3;
export const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_ORDER_META = {
  orderType: 'local',
};

export const state = {
  activeCategory: null,
  cartItems: [],
  customer: {
    name: '',
    address: '',
    betweenStreets: '',
    references: '',
    pickupTime: '',
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

export function createItemId(productId) {
  if (window.crypto?.randomUUID) return `${productId}-${window.crypto.randomUUID()}`;
  return `${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeCartItems() {
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

export function persistState() {
  try {
    const payload = {
      version: STORAGE_VERSION,
      expiresAt: Date.now() + STORAGE_TTL_MS,
      data: {
        activeCategory: state.activeCategory,
        cartItems: state.cartItems,
        customer: state.customer,
        orderMeta: state.orderMeta,
      },
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage may be full or unavailable; silently drop persistence
  }
}

export function restoreState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!parsed?.expiresAt || parsed.expiresAt < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    if (parsed.version !== STORAGE_VERSION) {
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
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
