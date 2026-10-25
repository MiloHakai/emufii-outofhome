import { store } from '../state.js';
import { sfx } from '../sfx.js';
import { paletteFor, shortLabel, romTitle, getConsoleFriendlyName } from '../screens/LibraryScreen.js';
import { openFloatingPanel, getSelectedRegion } from './FloatingPanel.js';
import { esc } from '../html.js';
import { toast, errorMessage } from '../toast.js';
import { ensureEmulator } from './EmulatorDownloadModal.js';
import { generateSessionCode } from '../../../main/network/sessionCodes.js';
import type { RomItem } from '../../../main/library/scanner.js';

export function openFactSheet(rom: RomItem) {
  const dialog = document.getElementById('factSheetDialog') as HTMLDialogElement;
  if (!dialog) return;

  const compat = store.get().compatDb[rom.titleId || ''] || store.get().compatDb[rom.productCode || ''];
  const rating = compat?.rating || 'perfect';

  const [c1, c2] = paletteFor(rom.displayName);
  const title = romTitle(rom);
  const initials = shortLabel(title);
  const consoleLabel = esc(getConsoleFriendlyName(rom.console));

  let currentMode: 'wireless' | 'online' = 'wireless';
  let isPrivate = false;
  const hasModes = rom.console === 'PSP' || rom.console === 'DS' || rom.console === 'PS2';

  const dialogContent = dialog.querySelector('.dialog-content') as HTMLElement;
  dialogContent.innerHTML = `
    <div class="game-launch-modal" tabindex="-1">
      <button id="btnCloseLaunchDialog" class="icon-btn plate-button launch-close-btn" title="Close (Esc)" aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <!-- Left Column: Artwork + Compat Badge -->
      <div class="launch-left-col">
        <div class="launch-artwork">
          ${
            rom.artworkUrl
              ? `<img src="${esc(rom.artworkUrl)}" data-fallback="${esc(rom.fallbackArtworkUrl || '')}" class="launch-art-img" alt="" draggable="false">`
              : ''
          }
          <div class="launch-art-placeholder" data-img-fallback style="background: linear-gradient(135deg, ${c1}, ${c2});" ${rom.artworkUrl ? 'hidden' : ''}>
            <span>${esc(initials)}</span>
          </div>
        </div>

        <div class="launch-compat-pill ${rating === 'broken' ? 'broken' : rating === 'partial' ? 'partial' : 'perfect'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            ${rating === 'broken' ? '<line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' : rating === 'partial' ? '<line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' : '<path d="M7.5 12l3 3 6-6"/>'}
          </svg>
          <span>${rating === 'broken' ? 'Incompatible' : rating === 'partial' ? 'Partially working' : 'Compatible'}</span>
        </div>
      </div>

      <!-- Right Column: Mode Switch, Privacy Toggle, Launch Buttons -->
      <div class="launch-right-col">
        <div class="launch-title-block">
          <div class="launch-game-title">${esc(title)}</div>
          <div class="launch-game-subtitle" id="launchGameSubtitle">${consoleLabel} &bull; multiplayer session</div>
        </div>

        ${
          hasModes
            ? `
        <!-- Mode Switch (Wireless play / Online) -->
        <div class="launch-mode-switch" id="launchModeSwitch" role="tablist" aria-label="Play mode">
          <div class="launch-mode-glider" id="launchModeGlider"></div>
          <button class="launch-mode-tab active" id="btnModeWireless" type="button" role="tab" aria-selected="true">Wireless play</button>
          <button class="launch-mode-tab" id="btnModeOnline" type="button" role="tab" aria-selected="false">Online</button>
        </div>
        `
            : ''
        }

        <!-- Mode View Container -->
        <div class="launch-mode-body" id="launchModeBody">
          <!-- Privacy Toggle (Collapsible with smooth grid height) -->
          <div class="launch-collapsible" id="launchPrivacyCollapsible">
            <div>
              <div class="launch-privacy-row" id="launchPrivacyRow" role="switch" aria-checked="false" aria-labelledby="launchPrivacyTitle" tabindex="0">
                <div>
                  <div class="launch-privacy-title" id="launchPrivacyTitle">Open session</div>
                  <div class="launch-privacy-desc" id="launchPrivacyDesc">Shows in the session list. Anyone can join.</div>
                </div>
                <button class="launch-switch" id="launchPrivacySwitch" tabindex="-1" aria-hidden="true">
                  <span class="launch-switch-thumb"></span>
                </button>
              </div>
            </div>
          </div>

          <!-- Actions Stack -->
          <div class="launch-actions-stack">
            <button class="launch-btn-primary plate-button" id="btnLaunchPrimary" data-autofocus>
              Create a session
            </button>
            <div class="launch-collapsible" id="launchSecondaryCollapsible">
              <div>
                <button class="launch-btn-secondary plate-button" id="btnLaunchSecondary">
                  Join with a code
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const subtitleEl = dialogContent.querySelector('#launchGameSubtitle') as HTMLElement;
  const modeSwitchEl = dialogContent.querySelector('#launchModeSwitch') as HTMLElement | null;
  const btnWireless = dialogContent.querySelector('#btnModeWireless') as HTMLElement | null;
  const btnOnline = dialogContent.querySelector('#btnModeOnline') as HTMLElement | null;
  const privacyCollapsible = dialogContent.querySelector('#launchPrivacyCollapsible') as HTMLElement;
  const secondaryCollapsible = dialogContent.querySelector('#launchSecondaryCollapsible') as HTMLElement;
  const privacyRow = dialogContent.querySelector('#launchPrivacyRow') as HTMLElement;
  const privacyTitle = dialogContent.querySelector('#launchPrivacyTitle') as HTMLElement;
  const privacyDesc = dialogContent.querySelector('#launchPrivacyDesc') as HTMLElement;
  const privacySwitch = dialogContent.querySelector('#launchPrivacySwitch') as HTMLElement;
  const btnPrimary = dialogContent.querySelector('#btnLaunchPrimary') as HTMLElement;
  const btnSecondary = dialogContent.querySelector('#btnLaunchSecondary') as HTMLElement;

  const updateView = (skipAnim: boolean = false) => {
    btnWireless?.setAttribute('aria-selected', String(currentMode === 'wireless'));
    btnOnline?.setAttribute('aria-selected', String(currentMode === 'online'));
    if (currentMode === 'wireless') {
      modeSwitchEl?.classList.remove('mode-online');
      btnWireless?.classList.add('active');
      btnOnline?.classList.remove('active');
      if (skipAnim) {
        subtitleEl.innerHTML = `${consoleLabel} &bull; multiplayer session`;
      } else {
        subtitleEl.style.opacity = '0';
        setTimeout(() => {
          subtitleEl.innerHTML = `${consoleLabel} &bull; multiplayer session`;
          subtitleEl.style.opacity = '1';
        }, 120);
      }
      privacyCollapsible.classList.remove('collapsed');
      secondaryCollapsible.classList.remove('collapsed');
      btnPrimary.textContent = 'Create a session';

      privacyRow.setAttribute('aria-checked', String(isPrivate));
      if (isPrivate) {
        privacyTitle.textContent = 'Private session';
        privacyDesc.textContent = 'Hidden from the session list. Your code lets people in.';
        privacySwitch.classList.add('checked');
      } else {
        privacyTitle.textContent = 'Open session';
        privacyDesc.textContent = 'Shows in the session list. Anyone can join.';
        privacySwitch.classList.remove('checked');
      }
    } else {
      modeSwitchEl?.classList.add('mode-online');
      btnWireless?.classList.remove('active');
      btnOnline?.classList.add('active');
      if (skipAnim) {
        subtitleEl.innerHTML = `${consoleLabel} &bull; online play`;
      } else {
        subtitleEl.style.opacity = '0';
        setTimeout(() => {
          subtitleEl.innerHTML = `${consoleLabel} &bull; online play`;
          subtitleEl.style.opacity = '1';
        }, 120);
      }
      privacyCollapsible.classList.add('collapsed');
      secondaryCollapsible.classList.add('collapsed');
      btnPrimary.textContent = 'Play online';
    }
  };

  btnWireless?.addEventListener('click', () => {
    if (currentMode !== 'wireless') {
      sfx.play('toggle');
      currentMode = 'wireless';
      updateView();
    }
  });

  btnOnline?.addEventListener('click', () => {
    if (currentMode !== 'online') {
      sfx.play('toggle');
      currentMode = 'online';
      updateView();
    }
  });

  privacyRow.addEventListener('click', () => {
    sfx.play('toggle');
    isPrivate = !isPrivate;
    updateView();
  });

  btnPrimary.addEventListener('click', async () => {
    sfx.play('confirm');
    dialog.close();
    if (currentMode === 'wireless') {
      await startHostSession(rom, isPrivate);
    } else {
      await launchOnline(rom);
    }
  });

  btnSecondary.addEventListener('click', () => {
    sfx.play('click');
    dialog.close();
    store.set({ selectedRom: rom });
    openFloatingPanel('join');
  });

  dialogContent.querySelector('#btnCloseLaunchDialog')?.addEventListener('click', () => {
    sfx.play('click');
    dialog.close();
  });

  dialogContent.querySelector('#launchModeSwitch')?.addEventListener('keydown', (e) => {
    const key = (e as KeyboardEvent).key;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight') return;
    e.preventDefault();
    const next = key === 'ArrowLeft' ? btnWireless : btnOnline;
    next?.click();
    next?.focus();
  });

  dialog.onmousedown = (e) => {
    if (e.target === dialog) {
      sfx.play('click');
      dialog.close();
    }
  };

  dialog.showModal();
  if (document.body.dataset.input === 'mouse') {
    dialogContent.querySelector<HTMLElement>('.game-launch-modal')?.focus({ preventScroll: true });
  } else {
    btnPrimary.focus({ preventScroll: true });
  }
}

async function launchOnline(rom: RomItem) {
  const emuApi = (window as any).emufii;

  // Ensure emulator is ready (auto-downloading if missing)
  const isReady = await ensureEmulator(rom.console);
  if (!isReady) return;

  store.set({
    activeSession: {
      code: 'ONLINE',
      isHost: true,
      rom,
      token: null,
      remote: null,
      wireguard: null,
      wireguardConfigPath: null,
      wireguardNative: true,
      step1Done: true,
      step2Done: false,
      launching: true,
      netplayBusy: false,
    },
  });

  store.navigate('session');

  try {
    const res = await emuApi.emulators.launchGame(rom.console, {
      romPath: rom.filePath,
      isHost: true,
      code: 'ONLINE',
      onlineMode: true,
      discId: rom.discId || rom.titleId,
      ps2ElfCrc: rom.ps2ElfCrc,
    });

    const active = store.get().activeSession;
    if (active && active.code === 'ONLINE') {
      store.set({
        activeSession: {
          ...active,
          step2Done: res?.success === true,
          launching: false,
          netplayBusy: false,
        },
      });
    }

    if (res && !res.success) {
      toast(res.message || 'Emulator not found. Set its path in Settings › Emulators.', 'error');
    }
  } catch (err: any) {
    console.error('Failed to launch online:', err);
    toast(`Could not start online play: ${errorMessage(err, 'unknown error')}`, 'error');
    const active = store.get().activeSession;
    if (active && active.code === 'ONLINE') {
      store.set({
        activeSession: {
          ...active,
          netplayBusy: false,
        },
      });
    }
  }
}

async function startHostSession(rom: RomItem, isPrivate: boolean = false) {
  // Ensure emulator is ready (auto-downloading if missing)
  const isReady = await ensureEmulator(rom.console);
  if (!isReady) return;

  const code = generateSessionCode();
  const profile = store.get().profile;
  const emuApi = (window as any).emufii;

  // Default netplay port matching Console.kt backend.defaultNetplayPort:
  // Dolphin: 2626, PS2: 19072, MelonDS: 7000, 3DS/Switch: 24872
  const defaultPort =
    rom.console === 'GameCube' || rom.console === 'Wii'
      ? 2626
      : rom.console === 'PS2'
      ? 19072
      : rom.console === 'DS'
      ? 7000
      : 24872;

  store.set({
    activeSession: {
      code,
      isHost: true,
      rom,
      token: null,
      remote: null,
      wireguard: null,
      wireguardConfigPath: null,
      wireguardNative: true,
      step1Done: false,
      step2Done: false,
      netplayBusy: true,
    },
  });

  store.navigate('session');

  try {
    // 1. Create session on coordinator
    const created = await emuApi.coordinator.createSession({
      code,
      romTitleId: rom.titleId || rom.productCode,
      romTitle: rom.displayName,
      hostName: profile.name,
      hostId: profile.id,
      console: rom.console.toLowerCase(),
      isPrivate,
      region: getSelectedRegion(),
    });

    const active = store.get().activeSession;
    if (active && active.code === code) {
      store.set({
        activeSession: {
          ...active,
          token: created.token,
        },
      });
    }

    // 2. Claim WireGuard address
    const config = await emuApi.config.get();
    const wgInfo = await emuApi.coordinator.claimAddress(
      code,
      config.wgKeys.publicKey,
      profile.name,
      profile.id
    );

    // 3. Bring up WireGuard tunnel (PS2 uses relay DNS for local hostname resolution)
    const dns = rom.console === 'PS2' ? '10.67.0.1' : null;
    const wgRes = await emuApi.wireguard.up(wgInfo, dns);

    // 4. Update session with host IP and proper backend netplay port
    await emuApi.coordinator.patchSession(code, wgInfo.address, defaultPort, created.token);
    await emuApi.coordinator.setHostReady(code, true, created.token);

    // Step 1 done
    sfx.play('confirm');
    const updated = store.get().activeSession;
    if (updated && updated.code === code) {
      store.set({
        activeSession: {
          ...updated,
          wireguard: wgInfo,
          wireguardConfigPath: wgRes?.configPath || null,
          wireguardNative: wgRes?.isNativeActive !== false,
          step1Done: true,
          netplayBusy: false,
        },
      });
    }

    // 5. Auto launch emulator for host
    const preLaunch = store.get().activeSession;
    if (preLaunch && preLaunch.code === code) {
      store.set({ activeSession: { ...preLaunch, launching: true } });
    }

    if (store.get().settings.shareLastGame !== false) {
      emuApi.coordinator.announceLastGame(profile.id, rom.displayName, rom.titleId || rom.productCode).catch(() => {});
    }

    const res = await emuApi.emulators.launchGame(rom.console, {
      romPath: rom.filePath,
      isHost: true,
      code,
      hostIp: wgInfo.address,
      port: defaultPort,
      discId: rom.discId || rom.titleId,
      ps2ElfCrc: rom.ps2ElfCrc,
    });

    const step2 = store.get().activeSession;
    if (step2 && step2.code === code) {
      store.set({
        activeSession: {
          ...step2,
          step2Done: res?.success === true,
          launching: false,
        },
      });
    }

    if (res && !res.success) {
      toast(res.message || 'Emulator not found. Set its path in Settings › Emulators, then click Launch.', 'error');
    }
  } catch (err: any) {
    console.error('Failed to host session:', err);
    toast(`Could not host the session: ${errorMessage(err, 'unknown error')}`, 'error');
    const active = store.get().activeSession;
    if (active && active.code === code) {
      store.set({
        activeSession: {
          ...active,
          netplayBusy: false,
        },
      });
    }
  }
}
