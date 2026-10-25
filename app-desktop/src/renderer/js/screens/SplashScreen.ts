import { store } from '../state.js';
import { sfx } from '../sfx.js';

export function renderSplashScreen(container: HTMLElement) {
  container.innerHTML = `
    <div class="splash-view">
      <img src="./assets/logo.png" alt="Emufii" class="splash-logo" draggable="false">
      <div class="signal-pips" role="progressbar" aria-label="Loading">
        <span class="signal-pip"></span>
        <span class="signal-pip"></span>
        <span class="signal-pip"></span>
        <span class="signal-pip"></span>
        <span class="signal-pip"></span>
      </div>
    </div>
  `;

  let hasAdvanced = false;
  const advance = () => {
    if (hasAdvanced) return;
    hasAdvanced = true;
    sfx.play('confirm');
    // The splash is not a place to come back to.
    store.set({ currentScreen: 'library', screenHistory: [] });
  };

  const autoTimer = setTimeout(advance, 1500);
  container.querySelector('.splash-view')?.addEventListener('click', advance);
  const onKey = () => advance();
  window.addEventListener('keydown', onKey);

  return () => {
    clearTimeout(autoTimer);
    window.removeEventListener('keydown', onKey);
  };
}
