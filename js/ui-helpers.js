import { el } from './dom.js';

let modalOpenDepth = 0;
let lockedScrollY = 0;
let touchGuardsInstalled = false;
let announcementTimer = null;

export function formatCurrency(amount) {
  const value = Number(amount) || 0;
  return `$${value.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
}

export function setHelper(message, isError) {
  if (!el?.helper) return;
  el.helper.textContent = message;
  el.helper.classList.toggle('is-error', Boolean(isError));
}

export function announceStatus(message) {
  if (!el?.announcement) return;
  clearTimeout(announcementTimer);
  el.announcement.textContent = '';
  requestAnimationFrame(() => {
    el.announcement.textContent = message;
    el.announcement.classList.add('is-visible');
    announcementTimer = setTimeout(() => {
      el.announcement.classList.remove('is-visible');
    }, 2600);
  });
}

export function lockBodyScroll() {
  if (typeof document === 'undefined') return;
  if (modalOpenDepth === 0) {
    lockedScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add('is-modal-open');
    document.body.style.top = `-${lockedScrollY}px`;
  }
  modalOpenDepth += 1;
  installTouchScrollGuards();
}

export function unlockBodyScroll() {
  if (typeof document === 'undefined') return;
  modalOpenDepth = Math.max(0, modalOpenDepth - 1);
  if (modalOpenDepth === 0) {
    document.body.classList.remove('is-modal-open');
    document.body.style.top = '';
    window.scrollTo(0, lockedScrollY);
  }
}

export function installTouchScrollGuards() {
  if (touchGuardsInstalled) return;
  touchGuardsInstalled = true;
  document.addEventListener('touchmove', (event) => {
    if (modalOpenDepth === 0) return;
    if (event.touches.length > 1) return;
    const target = event.target;
    if (target?.closest('.allow-scroll')) return;
    event.preventDefault();
  }, { passive: false });
}

export function trapFocus(event, container) {
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

export function restoreFocus(target) {
  if (target instanceof HTMLElement && target.isConnected && !target.disabled) {
    target.focus();
  }
}
