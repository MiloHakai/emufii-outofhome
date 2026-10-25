import { store } from '../state.js';
import { sfx } from '../sfx.js';
import { ensureEmulator } from '../components/EmulatorDownloadModal.js';
import {
  resolveFriendDisplayName,
  resolveFriendAvatar,
  resolveFriendActivity,
} from '../components/FriendActionModal.js';
import { toggleFloatingPanel } from '../components/FloatingPanel.js';
import { formatFriendCode } from '../../../main/profile/friendCode.js';
import { esc, initials } from '../html.js';
import { toast, errorMessage } from '../toast.js';
import { romTitle, getConsoleFriendlyName } from './LibraryScreen.js';
import { openModal } from '../dialogs.js';

const invitedInSession = new Set<string>();

function openInviteFriendsModal(sessionCode: string) {
  const emuApi = (window as any).emufii;
  const state = store.get();
  const friends = [...(state.settings.friends || [])].sort(
    (a, b) => Number(resolveFriendActivity(b).isOnline) - Number(resolveFriendActivity(a).isOnline)
  );

  const modal = openModal(
    `
      <h3 class="modal-title">Invite friends to ${esc(sessionCode)}</h3>
      <p class="modal-desc">They get a notification with a one-click Join button.</p>
      <div class="panel-list modal-list">
        ${
          friends.length === 0
            ? '<div class="panel-empty compact"><span>You have not added any friends yet.</span></div>'
            : friends
                .map((code) => {
                  const name = resolveFriendDisplayName(code);
                  const avatar = resolveFriendAvatar(code);
                  const activity = resolveFriendActivity(code);
                  const alreadySent = invitedInSession.has(`${sessionCode}:${code}`);
                  const presence = activity.isOnline ? 'online' : 'offline';
                  return `
            <div class="panel-row">
              <div class="panel-avatar-wrap">
                <div class="panel-avatar" style="width: 34px; height: 34px;">${avatar ? `<img src="${esc(avatar)}" alt="">` : `<span>${initials(name, 'F')}</span>`}</div>
                <span class="presence-dot ${presence}"></span>
              </div>
              <div class="panel-row-main">
                <div class="panel-row-title">${esc(name)}</div>
                <div class="panel-row-sub ${presence}">${esc(activity.statusText || formatFriendCode(code))}</div>
              </div>
              <button class="${alreadySent ? 'btn-secondary' : 'btn-primary'} plate-button btn-small btn-send-session-invite" data-code="${esc(code)}" ${alreadySent ? 'disabled' : ''}>
                ${alreadySent ? 'Sent' : 'Invite'}
              </button>
            </div>`;
                })
                .join('')
        }
      </div>
      <div class="modal-actions">
        ${friends.length === 0 ? '<button class="btn-primary plate-button" id="btnOpenFriendsFromInvite">Add friends</button>' : ''}
        <button class="btn-secondary plate-button" id="btnDoneInviteModal">Done</button>
      </div>
    `,
    { width: 460, label: `Invite friends to ${sessionCode}` }
  );
  const overlay = modal.window;

  overlay.querySelector('#btnDoneInviteModal')?.addEventListener('click', () => {
    sfx.play('click');
    modal.close();
  });
  overlay.querySelector('#btnOpenFriendsFromInvite')?.addEventListener('click', () => {
    sfx.play('click');
    modal.close();
    toggleFloatingPanel('friends');
  });

  overlay.querySelectorAll('.btn-send-session-invite').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const button = e.currentTarget as HTMLButtonElement;
      const toCode = button.dataset.code;
      if (!toCode) return;

      button.disabled = true;
      button.textContent = 'Sending...';
      sfx.play('confirm');

      const ok = await emuApi.coordinator?.sendSessionInvite?.(
        state.profile.id,
        toCode,
        sessionCode,
        state.profile.name || 'Joueur'
      );

      if (ok !== false) {
        invitedInSession.add(`${sessionCode}:${toCode}`);
        button.textContent = '✓ Sent';
        button.className = 'btn-secondary plate-button btn-send-session-invite';
      } else {
        button.disabled = false;
        button.textContent = 'Retry';
      }
    });
  });
}

function pingClass(ms: number | null): string {
  if (ms === null) return 'unknown';
  return ms < 60 ? 'good' : ms < 130 ? 'fair' : 'poor';
}

const COPY_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

function copyButton(id: string, label: string): string {
  return `<button class="session-copy-btn" id="${id}" title="Copy ${label}" aria-label="Copy ${label}">${COPY_ICON}</button>`;
}

export function renderSessionScreen(container: HTMLElement) {
  const emuApi = (window as any).emufii;
  let pollTimer: any = null;
  let currentPingMs: number | null = null;
  let lastKey = '';

  const copy = (text: string, what: string) => {
    navigator.clipboard.writeText(text);
    sfx.play('click');
    toast(`${what} copied`, 'success', 1500);
  };

  const update = () => {
    const session = store.get().activeSession;
    if (!session) {
      container.innerHTML = '<div class="session-empty">No active session.</div>';
      lastKey = '';
      return;
    }

    const key = JSON.stringify([session, store.get().profile.name]);
    if (key === lastKey) return;
    lastKey = key;

    const hadFocusId = container.contains(document.activeElement) ? (document.activeElement as HTMLElement).id : '';

    const isHost = session.isHost;
    const isOnline = session.code === 'ONLINE';
    const remote = session.remote;
    const wg = session.wireguard;
    const consoleType = session.rom?.console;
    const isPsp = consoleType === 'PSP';
    const isDolphin = consoleType === 'GameCube' || consoleType === 'Wii';
    const isPs2 = consoleType === 'PS2';

    // PPSSPP's ad hoc server uses the fixed sentinel address 10.66.1.1 (Session.kt shownAddress)
    const displayIp = isPsp ? '10.66.1.1' : isHost ? wg?.address || '10.67.0.2' : remote?.hostIp || '10.67.0.2';
    // Console.kt backend.defaultNetplayPort: Dolphin 2626, PS2 19072, melonDS 7000, 3DS/Switch 24872
    const defaultPort = isDolphin ? 2626 : isPs2 ? 19072 : consoleType === 'DS' ? 7000 : 24872;
    const displayPort = remote?.port || defaultPort;

    const members: any[] = remote?.members?.length
      ? remote.members
      : [{ id: store.get().profile.id, name: store.get().profile.name, forSeconds: 0 }];

    const step2Desc = isOnline
      ? session.step2Done
        ? 'Emulator running'
        : 'Ready to start the game'
      : isHost
      ? 'Launch the game, then open your room in the emulator'
      : remote?.hostReady
      ? 'The host is ready. Launch to connect.'
      : 'Waiting for the host to open the room…';

    const wgConf = session.wireguardConfigPath || 'emufii0.conf';
    const isWindows = navigator.userAgent.includes('Windows');
    const wgCmd = isWindows ? `wireguard /installtunnelservice "${wgConf}"` : `sudo wg-quick up "${wgConf}"`;

    container.innerHTML = `
      <div class="session-screen">
        <section class="session-left">
          <div class="code-display-card plate">
            <div class="session-card-label">${isOnline ? 'Online play' : 'Session code'}</div>
            <div class="code-value ${isOnline ? 'small' : ''}">${esc(session.code)}</div>
            ${
              isOnline
                ? '<div class="session-card-hint">Direct connection to the game’s online servers</div>'
                : `<div class="session-code-actions">
                    <button class="btn-secondary plate-button btn-small" id="btnCopyCode">${COPY_ICON} Copy code</button>
                    <button class="btn-primary plate-button btn-small" id="btnInviteFriendsSession">Invite friends</button>
                  </div>`
            }
          </div>

          <div class="plate session-card">
            <div class="session-card-label">${isOnline ? 'Network' : 'Connection'}</div>
            <div class="session-info-rows">
              ${
                isOnline
                  ? '<div class="session-info-row"><span>Service</span><strong>Public online</strong><span class="lamp active"></span></div>'
                  : `
                <div class="session-info-row"><span>Address</span><strong>${esc(displayIp)}</strong>${copyButton('btnCopyIp', 'address')}</div>
                ${isPsp ? '' : `<div class="session-info-row"><span>Port</span><strong>${esc(displayPort)}</strong>${copyButton('btnCopyPort', 'port')}</div>`}
                <div class="session-info-row"><span>Ping</span><strong id="sessionLivePingValue">${currentPingMs !== null ? `${currentPingMs} ms` : 'Measuring…'}</strong><span class="ping-dot ${pingClass(currentPingMs)}" id="sessionLivePingDot"></span></div>`
              }
            </div>
          </div>

          <div class="plate session-card session-players">
            <div class="session-card-label">${isOnline ? 'Player' : `Players · ${members.length}`}</div>
            <div class="member-list" id="sessionMemberList">
              ${members
                .map(
                  (m: any) => `
                <div class="member-row">
                  <div class="chip-avatar">${initials(m.name, '?')}</div>
                  <div class="member-info">
                    <div class="member-name">${esc(m.name || 'Player')}${m.id === store.get().profile.id ? ' <span class="member-you">you</span>' : ''}</div>
                    <div class="member-sub">${m.forSeconds ? `${Math.floor(m.forSeconds / 60)} min in room` : 'Connected'}${typeof m.rttMs === 'number' ? ` · ${m.rttMs} ms` : ''}</div>
                  </div>
                </div>`
                )
                .join('')}
            </div>
          </div>
        </section>

        <section class="session-right">
          <div class="session-title-block">
            <h1 class="session-title">${esc(session.rom ? romTitle(session.rom) : 'Multiplayer session')}</h1>
            <div class="session-subtitle">
              ${consoleType ? `${esc(getConsoleFriendlyName(consoleType))} · ` : ''}${isOnline ? 'Online play' : isHost ? 'You are hosting' : 'You joined as a guest'}
            </div>
          </div>

          <div class="step-card plate">
            <div class="step-num ${session.step1Done ? 'done' : ''}">${session.step1Done ? '✓' : '1'}</div>
            <div class="step-info">
              <div class="step-title">Network</div>
              <div class="step-desc">${
                isOnline
                  ? 'Online connection ready'
                  : session.step1Done
                  ? session.wireguardNative === false
                    ? 'Tunnel prepared — it needs to be started manually (see below)'
                    : 'Secure tunnel active'
                  : 'Connecting to the session relay…'
              }</div>
            </div>
            ${!session.step1Done && session.netplayBusy ? '<div class="spinner"></div>' : ''}
          </div>

          ${
            !isOnline && session.wireguardNative === false
              ? `
            <div class="plate session-warning">
              <strong>Start the tunnel manually</strong>
              <p>${
                isWindows
                  ? 'WireGuard needs administrator rights. Install <a href="https://www.wireguard.com/install/" target="_blank" rel="noreferrer">WireGuard for Windows</a>, then run this in an administrator terminal (or import the file in the WireGuard app):'
                  : 'WireGuard needs root rights on this system. Run this in a terminal:'
              }</p>
              <div class="session-cmd">
                <code id="wgCmdText">${esc(wgCmd)}</code>
                ${copyButton('btnCopyWgCmd', 'command')}
              </div>
            </div>`
              : ''
          }

          <div class="step-card plate">
            <div class="step-num ${session.step2Done ? 'done' : ''}">${session.step2Done ? '✓' : '2'}</div>
            <div class="step-info">
              <div class="step-title">Play</div>
              <div class="step-desc">${step2Desc}</div>
            </div>
            <button class="plate-button ${session.step2Done ? 'btn-success' : 'btn-primary'} btn-launch" id="btnLaunchEmu" ${session.launching || !session.rom ? 'disabled' : ''} title="${session.rom ? '' : 'This game is not in your library'}">
              ${session.launching ? '<span class="spinner small"></span><span>Launching…</span>' : session.step2Done ? 'Running' : 'Launch'}
            </button>
          </div>
          ${
            !session.rom && !isHost
              ? '<div class="session-note">You don’t have this game in your library. Add it, then rejoin the session.</div>'
              : ''
          }

          <div class="session-footer">
            <button class="btn-danger plate-button" id="btnLeaveSession">${isOnline ? 'Exit game' : isHost ? 'End session' : 'Leave session'}</button>
          </div>
        </section>
      </div>
    `;

    if (hadFocusId) container.querySelector<HTMLElement>(`#${CSS.escape(hadFocusId)}`)?.focus({ preventScroll: true });

    container.querySelector('#btnCopyCode')?.addEventListener('click', () => copy(session.code, 'Session code'));
    container.querySelector('#btnInviteFriendsSession')?.addEventListener('click', () => {
      sfx.play('click');
      openInviteFriendsModal(session.code);
    });
    container.querySelector('#btnCopyIp')?.addEventListener('click', () => copy(displayIp, 'Address'));
    container.querySelector('#btnCopyPort')?.addEventListener('click', () => copy(String(displayPort), 'Port'));
    container.querySelector('#btnCopyWgCmd')?.addEventListener('click', () => copy(wgCmd, 'Command'));

    container.querySelector('#btnLaunchEmu')?.addEventListener('click', async () => {
      sfx.play('click');
      const current = store.get().activeSession;
      if (!current || !current.rom || current.launching) return;

      store.set({ activeSession: { ...current, launching: true } });

      const ok = await ensureEmulator(current.rom.console);
      if (!ok) {
        const reset = store.get().activeSession;
        if (reset) store.set({ activeSession: { ...reset, launching: false } });
        return;
      }

      try {
        if (store.get().settings.shareLastGame !== false) {
          emuApi.coordinator
            .announceLastGame(store.get().profile.id, current.rom.displayName, current.rom.titleId || current.rom.productCode)
            .catch(() => {});
        }

        const res = await emuApi.emulators.launchGame(current.rom.console, {
          romPath: current.rom.filePath,
          isHost,
          code: current.code,
          hostIp: displayIp,
          port: displayPort,
          onlineMode: current.code === 'ONLINE',
          discId: current.rom.discId || current.rom.titleId,
          ps2ElfCrc: current.rom.ps2ElfCrc,
        });

        const updated = store.get().activeSession;
        if (updated) store.set({ activeSession: { ...updated, step2Done: res?.success === true, launching: false } });
        if (res && !res.success) {
          toast(res.message || `Could not launch the ${current.rom.console} emulator. Set its path in Settings › Emulators.`, 'error');
        }
      } catch (err) {
        const updated = store.get().activeSession;
        if (updated) store.set({ activeSession: { ...updated, launching: false } });
        toast(`Could not launch the emulator: ${errorMessage(err, 'unknown error')}`, 'error');
      }
    });

    container.querySelector('#btnLeaveSession')?.addEventListener('click', async (e) => {
      sfx.play('click');
      (e.currentTarget as HTMLButtonElement).disabled = true;
      clearInterval(pollTimer);
      try {
        await emuApi.emulators.killActiveGame?.();
      } catch {}
      if (session.code !== 'ONLINE') {
        try {
          if (isHost && session.token) {
            await emuApi.coordinator.deleteSession(session.code, session.token);
          } else {
            await emuApi.coordinator.leaveSession(session.code, store.get().profile.id);
          }
        } catch {}
        try {
          await emuApi.wireguard.down();
        } catch {}
      }
      store.set({ activeSession: null, selectedRom: null });
      store.navigate('library');
    });
  };

  update();

  const unsubscribe = store.subscribe((state) => {
    if (state.currentScreen === 'session') update();
  });

  const unsubscribeGameClosed = emuApi?.emulators?.onGameClosed?.(() => {
    const current = store.get().activeSession;
    if (current && current.step2Done) store.set({ activeSession: { ...current, step2Done: false } });
  });

  // Heartbeat, live RTT and member list, every 4 s like the Android client
  const poll = async () => {
    const session = store.get().activeSession;
    if (!session || session.code === 'ONLINE') return;
    try {
      const endpointHost = (session.wireguard?.relayEndpoint || '').split(':')[0] || 'coord.emufii.xyz';
      if (emuApi.coordinator.pingHost) {
        const measured = await emuApi.coordinator.pingHost(endpointHost);
        if (typeof measured === 'number') {
          currentPingMs = Math.round(measured);
          const pingEl = container.querySelector('#sessionLivePingValue');
          const dotEl = container.querySelector('#sessionLivePingDot');
          if (pingEl) pingEl.textContent = `${currentPingMs} ms`;
          if (dotEl) dotEl.className = `ping-dot ${pingClass(currentPingMs)}`;
        }
      }

      await emuApi.coordinator.heartbeat(session.code, store.get().profile.id, store.get().profile.name, currentPingMs ?? undefined);
      const remote = await emuApi.coordinator.getSession(session.code);
      const current = store.get().activeSession;
      if (current && current.code === session.code) store.set({ activeSession: { ...current, remote } });
    } catch {}
  };

  poll();
  pollTimer = setInterval(poll, 4000);
  return () => {
    clearInterval(pollTimer);
    unsubscribe();
    unsubscribeGameClosed?.();
  };
}
