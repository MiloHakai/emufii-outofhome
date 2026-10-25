import { esc } from '../html.js';
import { openModal } from '../dialogs.js';
import { toast, errorMessage } from '../toast.js';

export async function ensureEmulator(consoleType: string): Promise<boolean> {
  const emuApi = (window as any).emufii;
  if (!emuApi) return true;

  try {
    const all = await emuApi.emulators.detectAll();
    let emu = all[consoleType];

    // GBA titles live under the DS folder, so either emulator entry may apply
    if (!emu && (consoleType === 'DS' || consoleType === 'GBA')) {
      emu = all['DS'] || all['GBA'];
    }

    if (emu && emu.isInstalled) {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      const emuName = emu?.name || consoleType;
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        unsubscribe();
        resolve(ok);
      };

      const modal = openModal(
        `
        <div class="modal-hero-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </div>
        <h3 class="modal-title centered">Setting up ${esc(emuName)}</h3>
        <p class="modal-desc centered">Emufii is downloading and configuring ${esc(emuName)} for ${esc(consoleType)}. This only happens once.</p>
        <div class="progress">
          <div class="progress-track"><div class="progress-fill" id="emuDlBar" style="width: 5%;"></div></div>
          <div class="progress-meta"><span id="emuDlStatusText">Connecting…</span><span id="emuDlPercentText">5%</span></div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary plate-button" id="btnHideEmuDl">Continue in background</button>
        </div>
      `,
        { width: 440, label: `Setting up ${emuName}`, onClose: () => finish(false) }
      );

      const barEl = modal.window.querySelector('#emuDlBar') as HTMLElement;
      const statusEl = modal.window.querySelector('#emuDlStatusText') as HTMLElement;
      const percentEl = modal.window.querySelector('#emuDlPercentText') as HTMLElement;
      modal.window.querySelector('#btnHideEmuDl')?.addEventListener('click', () => modal.close());

      const unsubscribe = emuApi.emulators.onDownloadProgress((data: any) => {
        if (data.consoleType === consoleType || (consoleType === 'Wii' && data.consoleType === 'GameCube')) {
          barEl.style.width = `${data.percent}%`;
          percentEl.textContent = `${data.percent}%`;
          statusEl.textContent = data.status || 'Downloading…';
        }
      });

      emuApi.emulators
        .download(consoleType)
        .then((res: any) => {
          if (res && res.success) {
            barEl.style.width = '100%';
            percentEl.textContent = '100%';
            statusEl.textContent = 'Ready';
            if (settled) {
              toast(`${emuName} is installed`, 'success');
              return;
            }
            setTimeout(() => {
              finish(true);
              modal.close();
            }, 500);
          } else {
            finish(false);
            modal.close();
            toast(res?.message || `Could not download ${emuName}. Install it manually and set its path in Settings › Emulators.`, 'error');
          }
        })
        .catch((err: any) => {
          finish(false);
          modal.close();
          toast(`Could not download ${emuName}: ${errorMessage(err, 'network error')}`, 'error');
        });
    });
  } catch {
    return true;
  }
}
