import { sfx } from './sfx.js';

export interface NavDelegate {
  onBack?: () => void;
}

type Modality = 'mouse' | 'keyboard' | 'gamepad';
type Direction = 'up' | 'down' | 'left' | 'right';

const FOCUSABLE =
  'button:not([disabled]), [role="button"], [role="tab"], [tabindex]:not([tabindex="-1"]), input:not([disabled]):not([type="hidden"]), select, textarea, a[href]';

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'password', 'number', 'url', 'tel', '']);

export function isEditable(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(el.type);
  return (el as HTMLElement).isContentEditable === true;
}

function isNativelyActivatable(el: Element): boolean {
  return el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement || el instanceof HTMLInputElement;
}

// The topmost interactive layer: custom overlays, then open dialogs, then the floating panel.
function activeLayer(): ParentNode {
  const overlays = document.querySelectorAll<HTMLElement>('.modal-backdrop, .context-menu');
  if (overlays.length) return overlays[overlays.length - 1];
  const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
  if (dialog) return dialog;
  const panel = document.querySelector<HTMLElement>('#floatingCloudPanel.open');
  if (panel && panel.contains(document.activeElement)) return panel;
  return document;
}

class NavigationManager {
  private delegate: NavDelegate | null = null;
  private modality: Modality = 'mouse';
  private padFrame = 0;
  private prevButtons: boolean[] = [];
  private lastPadMove = 0;

  init(delegate?: NavDelegate) {
    this.delegate = delegate || null;
    this.setModality('mouse');

    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('pointerdown', () => this.setModality('mouse'), true);
    window.addEventListener('mouseup', (e) => {
      // Mouse "back" side button
      if (e.button === 3) {
        e.preventDefault();
        this.delegate?.onBack?.();
      }
    });
    window.addEventListener('gamepadconnected', () => this.startGamepad());
    if (navigator.getGamepads?.().some((p) => p?.connected)) this.startGamepad();
  }

  getModality(): Modality {
    return this.modality;
  }

  focus(el: HTMLElement | null, playSound = false) {
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (playSound) sfx.play('hover');
  }

  focusFirst(root: ParentNode) {
    const first =
      root.querySelector<HTMLElement>('[data-autofocus], .rom-cell, .folder-tile, .list-row, .carousel-card.active, .settings-nav-item.active') ||
      this.candidates(root)[0];
    if (first && this.modality !== 'mouse') this.focus(first);
  }

  private setModality(m: Modality) {
    if (this.modality === m && document.body.dataset.input === m) return;
    this.modality = m;
    document.body.dataset.input = m;
  }

  private candidates(root: ParentNode): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.checkVisibility() && !el.closest('[inert], dialog:not([open])')
    );
  }

  navigate(direction: Direction): boolean {
    const layer = activeLayer();
    const items = this.candidates(layer);
    if (items.length === 0) return false;

    const current = document.activeElement as HTMLElement | null;
    if (!current || current === document.body || !items.includes(current)) {
      const preferred = layer.querySelector<HTMLElement>('.rom-cell, .folder-tile, .list-row, .carousel-card.active');
      this.focus(preferred && items.includes(preferred) ? preferred : items[0], true);
      return true;
    }

    const from = current.getBoundingClientRect();
    let best: HTMLElement | null = null;
    let bestScore = Infinity;

    for (const cand of items) {
      if (cand === current) continue;
      const r = cand.getBoundingClientRect();
      let gap: number;
      let offset: number;
      switch (direction) {
        case 'right':
          if (r.left < from.right - 4) continue;
          gap = r.left - from.right;
          offset = Math.abs(r.top + r.height / 2 - (from.top + from.height / 2));
          break;
        case 'left':
          if (r.right > from.left + 4) continue;
          gap = from.left - r.right;
          offset = Math.abs(r.top + r.height / 2 - (from.top + from.height / 2));
          break;
        case 'down':
          if (r.top < from.bottom - 4) continue;
          gap = r.top - from.bottom;
          offset = Math.abs(r.left + r.width / 2 - (from.left + from.width / 2));
          break;
        case 'up':
          if (r.bottom > from.top + 4) continue;
          gap = from.top - r.bottom;
          offset = Math.abs(r.left + r.width / 2 - (from.left + from.width / 2));
          break;
      }
      const score = gap + 2.5 * offset;
      if (score < bestScore) {
        bestScore = score;
        best = cand;
      }
    }

    if (!best) return false;
    this.focus(best, true);
    return true;
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Tab' || e.key.startsWith('Arrow')) this.setModality('keyboard');
    if (e.defaultPrevented) return;

    const target = e.target as HTMLElement | null;

    if (e.key === 'Escape') {
      if (isEditable(target)) {
        target!.blur();
        e.preventDefault();
        return;
      }
      e.preventDefault();
      this.delegate?.onBack?.();
      return;
    }

    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      this.delegate?.onBack?.();
      return;
    }

    if (e.key.startsWith('Arrow') && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (isEditable(target)) return;
      const dir = e.key.slice(5).toLowerCase() as Direction;
      const owner = target?.closest<HTMLElement>('[data-own-arrows], [role="tablist"], [role="radiogroup"], [role="slider"]');
      if (owner && !(owner.dataset.ownArrows === 'x' && (dir === 'up' || dir === 'down'))) return;
      if (this.navigate(dir)) e.preventDefault();
      return;
    }

    if ((e.key === 'Enter' || e.key === ' ') && target && !isEditable(target) && !isNativelyActivatable(target)) {
      if (target.matches('[role="button"], [tabindex]')) {
        e.preventDefault();
        target.click();
      }
    }
  }

  private startGamepad() {
    if (this.padFrame) return;
    const poll = () => {
      const pad = navigator.getGamepads?.().find((p) => p?.connected) || null;
      if (!pad) {
        this.padFrame = 0;
        this.prevButtons = [];
        return;
      }
      this.readGamepad(pad);
      this.padFrame = requestAnimationFrame(poll);
    };
    this.padFrame = requestAnimationFrame(poll);
  }

  private readGamepad(pad: Gamepad) {
    const pressed = pad.buttons.map((b) => b.pressed);
    const edge = (i: number) => pressed[i] && !this.prevButtons[i];
    const now = performance.now();

    const dir: Direction | null =
      pressed[12] || pad.axes[1] < -0.5
        ? 'up'
        : pressed[13] || pad.axes[1] > 0.5
        ? 'down'
        : pressed[14] || pad.axes[0] < -0.5
        ? 'left'
        : pressed[15] || pad.axes[0] > 0.5
        ? 'right'
        : null;

    if (dir && now - this.lastPadMove > 180) {
      this.setModality('gamepad');
      this.navigate(dir);
      this.lastPadMove = now;
    }

    if (edge(0)) {
      this.setModality('gamepad');
      const el = document.activeElement as HTMLElement | null;
      if (el && el !== document.body) el.click();
    }
    if (edge(1)) {
      this.setModality('gamepad');
      this.delegate?.onBack?.();
    }

    this.prevButtons = pressed;
  }
}

export const nav = new NavigationManager();
