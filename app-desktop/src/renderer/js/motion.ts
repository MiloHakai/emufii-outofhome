function motionReduced(): boolean {
  return (
    document.body.classList.contains('reduce-motion') ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

let running: ViewTransition | null = null;

// Cross-fades whatever `update` changes in the DOM instead of swapping it in one frame.
export function withTransition(update: () => void, kind = 'swap') {
  if (!document.startViewTransition || motionReduced() || document.hidden) {
    update();
    return;
  }
  running?.skipTransition();
  document.documentElement.dataset.vt = kind;
  const vt = document.startViewTransition(update);
  running = vt;
  vt.finished.finally(() => {
    if (running === vt) {
      running = null;
      delete document.documentElement.dataset.vt;
    }
  });
}

// Native <dialog>.close() removes it on the spot; play the exit animation first.
export function animateDialogClose(dialog: HTMLDialogElement) {
  const nativeClose = dialog.close.bind(dialog);
  dialog.close = (value?: string) => {
    if (!dialog.open || dialog.dataset.closing) return;
    if (motionReduced()) {
      nativeClose(value);
      return;
    }
    dialog.dataset.closing = '';
    setTimeout(() => {
      delete dialog.dataset.closing;
      nativeClose(value);
    }, 170);
  };
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    dialog.close();
  });
}
