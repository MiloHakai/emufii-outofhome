import { esc } from './html.js';
import { sfx } from './sfx.js';

export type MenuEntry =
  | { label: string; icon?: string; hint?: string; danger?: boolean; disabled?: boolean; action: () => void }
  | 'separator';

let openMenu: { el: HTMLElement; restoreFocus: HTMLElement | null; cleanup: () => void } | null = null;

export function closeContextMenu(): boolean {
  if (!openMenu) return false;
  const { el, restoreFocus, cleanup } = openMenu;
  openMenu = null;
  cleanup();
  el.classList.add('leaving');
  setTimeout(() => el.remove(), 120);
  restoreFocus?.focus({ preventScroll: true });
  return true;
}

export function openContextMenuAt(anchor: HTMLElement, entries: MenuEntry[]) {
  const r = anchor.getBoundingClientRect();
  openContextMenu(r.left + Math.min(24, r.width / 2), r.top + Math.min(24, r.height / 2), entries, true);
}

export function openContextMenu(x: number, y: number, entries: MenuEntry[], focusFirst = false) {
  closeContextMenu();

  const el = document.createElement('div');
  el.className = 'context-menu';
  el.setAttribute('role', 'menu');
  el.dataset.ownArrows = '';
  el.tabIndex = -1;
  el.innerHTML = entries
    .map((entry, i) =>
      entry === 'separator'
        ? '<div class="context-menu-separator" role="separator"></div>'
        : `<button class="context-menu-item${entry.danger ? ' danger' : ''}" role="menuitem" data-index="${i}" ${entry.disabled ? 'disabled' : ''}>
            <span class="context-menu-icon">${entry.icon ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${entry.icon}</svg>` : ''}</span>
            <span class="context-menu-label">${esc(entry.label)}</span>
            ${entry.hint ? `<span class="context-menu-hint">${esc(entry.hint)}</span>` : ''}
          </button>`
    )
    .join('');
  document.body.appendChild(el);

  const pad = 8;
  const { width, height } = el.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - width - pad);
  const top = y + height > window.innerHeight - pad ? Math.max(pad, y - height) : y;
  el.style.left = `${Math.max(pad, left)}px`;
  el.style.top = `${top}px`;

  const items = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.context-menu-item:not([disabled])'));

  el.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.context-menu-item');
    if (!btn || btn.disabled) return;
    const entry = entries[Number(btn.dataset.index)];
    closeContextMenu();
    if (entry && entry !== 'separator') {
      sfx.play('click');
      entry.action();
    }
  });

  el.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const list = items();
    if (list.length === 0) return;
    const idx = list.indexOf(document.activeElement as HTMLButtonElement);
    let next = 0;
    if (e.key === 'ArrowDown') next = (idx + 1) % list.length;
    else if (e.key === 'ArrowUp') next = (idx - 1 + list.length) % list.length;
    else if (e.key === 'End') next = list.length - 1;
    list[next].focus();
  });

  const onOutside = (e: Event) => {
    if (!el.contains(e.target as Node)) closeContextMenu();
  };
  const onBlurWindow = () => closeContextMenu();
  setTimeout(() => {
    window.addEventListener('pointerdown', onOutside, true);
    window.addEventListener('wheel', onOutside, { capture: true, passive: true });
    window.addEventListener('blur', onBlurWindow);
    window.addEventListener('resize', onBlurWindow);
  });

  openMenu = {
    el,
    restoreFocus: document.activeElement as HTMLElement | null,
    cleanup: () => {
      window.removeEventListener('pointerdown', onOutside, true);
      window.removeEventListener('wheel', onOutside, true);
      window.removeEventListener('blur', onBlurWindow);
      window.removeEventListener('resize', onBlurWindow);
    },
  };

  if (focusFirst) items()[0]?.focus();
  else el.focus();
}
