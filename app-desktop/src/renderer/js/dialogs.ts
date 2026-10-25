import { esc } from './html.js';
import { sfx } from './sfx.js';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalHandle {
  overlay: HTMLElement;
  window: HTMLElement;
  close: () => void;
}

// Shared shell for custom overlays: backdrop click, Escape, focus trap and focus restore.
export function openModal(innerHtml: string, opts: { width?: number; label?: string; onClose?: () => void } = {}): ModalHandle {
  const restoreFocus = document.activeElement as HTMLElement | null;
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';
  overlay.innerHTML = `<div class="modal-window plate" role="dialog" aria-modal="true" ${opts.label ? `aria-label="${esc(opts.label)}"` : ''} style="width: ${opts.width || 420}px;">${innerHtml}</div>`;
  document.body.appendChild(overlay);
  const win = overlay.firstElementChild as HTMLElement;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKeyDown, true);
    overlay.classList.add('leaving');
    setTimeout(() => overlay.remove(), 160);
    restoreFocus?.focus?.({ preventScroll: true });
    opts.onClose?.();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      sfx.play('click');
      close();
    } else if (e.key === 'Tab') {
      const items = Array.from(win.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.checkVisibility());
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!win.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  window.addEventListener('keydown', onKeyDown, true);

  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) {
      sfx.play('click');
      close();
    }
  });

  requestAnimationFrame(() => {
    const target = win.querySelector<HTMLElement>('[data-autofocus]') || win.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
    if (target instanceof HTMLInputElement) target.select();
  });

  return { overlay, window: win, close };
}

export function promptText(opts: {
  title: string;
  description?: string;
  value?: string;
  placeholder?: string;
  confirmLabel?: string;
  maxLength?: number;
}): Promise<string | null> {
  return new Promise((resolve) => {
    let result: string | null = null;
    const modal = openModal(
      `
      <h3 class="modal-title">${esc(opts.title)}</h3>
      ${opts.description ? `<p class="modal-desc">${esc(opts.description)}</p>` : ''}
      <input type="text" class="cloud-input modal-input" data-autofocus maxlength="${opts.maxLength || 80}"
        value="${esc(opts.value || '')}" placeholder="${esc(opts.placeholder || '')}" spellcheck="false">
      <div class="modal-actions">
        <button class="btn-secondary plate-button" data-action="cancel">Cancel</button>
        <button class="btn-primary plate-button" data-action="ok">${esc(opts.confirmLabel || 'Save')}</button>
      </div>
    `,
      { label: opts.title, onClose: () => resolve(result) }
    );
    const input = modal.window.querySelector('input') as HTMLInputElement;
    const submit = () => {
      result = input.value.trim();
      sfx.play('confirm');
      modal.close();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
    modal.window.querySelector('[data-action="ok"]')?.addEventListener('click', submit);
    modal.window.querySelector('[data-action="cancel"]')?.addEventListener('click', () => modal.close());
  });
}
