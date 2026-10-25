import { esc } from './html.js';
import { sfx } from './sfx.js';

type ToastKind = 'info' | 'success' | 'error';

const ICONS: Record<ToastKind, string> = {
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  success: '<path d="M20 6 9 17l-5-5"/>',
  error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
};

function getStack(): HTMLElement {
  let stack = document.getElementById('toastStack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toastStack';
    stack.className = 'toast-stack';
    stack.setAttribute('role', 'status');
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }
  return stack;
}

export function toast(message: string, kind: ToastKind = 'info', timeoutMs = kind === 'error' ? 7000 : 4000) {
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.innerHTML = `
    <svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICONS[kind]}</svg>
    <span class="toast-message">${esc(message)}</span>
    <button class="toast-close" title="Dismiss" aria-label="Dismiss">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;

  let timer: ReturnType<typeof setTimeout> | null = null;
  const dismiss = () => {
    if (timer) clearTimeout(timer);
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 180);
  };
  const arm = () => {
    timer = setTimeout(dismiss, timeoutMs);
  };

  el.querySelector('.toast-close')?.addEventListener('click', dismiss);
  el.addEventListener('mouseenter', () => timer && clearTimeout(timer));
  el.addEventListener('mouseleave', arm);

  getStack().appendChild(el);
  if (kind === 'error') sfx.play('notify');
  arm();
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && (err as any).message) {
    return String((err as any).message).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  }
  return fallback;
}
