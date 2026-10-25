import { sfx } from '../sfx.js';
import { esc } from '../html.js';
import { openModal } from '../dialogs.js';
import { toast } from '../toast.js';

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl?: string;
  downloadUrl?: string;
  assetName?: string | null;
  notes?: string;
}

export function openUpdateModal(info: UpdateInfo): Promise<'update' | 'skip'> {
  return new Promise((resolve) => {
    const emuApi = (window as any).emufii;
    const targetVersion = info.latestVersion || info.currentVersion || '2.0.4';
    const currentVersion = info.currentVersion || '2.0.4';
    const notes = (info.notes || 'Includes the latest Emufii Desktop improvements.').replace(/[#*`]/g, '').trim().slice(0, 600);

    document.querySelector('.modal-backdrop.update-modal')?.remove();

    let choice: 'update' | 'skip' = 'skip';
    let isUpdating = false;
    let unsubscribeProgress: (() => void) | null = null;

    const modal = openModal(
      `
      <div class="modal-hero-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </div>
      <h3 class="modal-title centered">${info.updateAvailable ? `Emufii ${esc(targetVersion)} is available` : 'Emufii is up to date'}</h3>
      <div class="version-pills">
        <span class="version-pill">v${esc(currentVersion)}</span>
        ${info.updateAvailable ? `<span aria-hidden="true">→</span><span class="version-pill new">v${esc(targetVersion)}</span>` : ''}
      </div>
      <div class="release-notes">${esc(notes)}</div>
      <div class="progress" id="updateProgressSection" hidden>
        <div class="progress-track"><div class="progress-fill" id="updateProgressBar" style="width: 5%;"></div></div>
        <div class="progress-meta"><span id="updateProgressStatus">Preparing download…</span><span id="updateProgressPercent">5%</span></div>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary plate-button" id="btnSkipUpdate">${info.updateAvailable ? 'Later' : 'Close'}</button>
        ${info.updateAvailable ? '<button class="btn-primary plate-button" id="btnConfirmUpdate" data-autofocus>Update now</button>' : ''}
      </div>
    `,
      {
        width: 480,
        label: 'Update Emufii',
        onClose: () => {
          unsubscribeProgress?.();
          resolve(choice);
        },
      }
    );
    modal.overlay.classList.add('update-modal');
    const root = modal.window;

    root.querySelector('#btnSkipUpdate')?.addEventListener('click', () => {
      if (isUpdating) return;
      sfx.play('click');
      modal.close();
    });

    root.querySelector('#btnConfirmUpdate')?.addEventListener('click', async () => {
      if (isUpdating) return;
      isUpdating = true;
      choice = 'update';
      sfx.play('confirm');

      const barEl = root.querySelector('#updateProgressBar') as HTMLElement;
      const statusEl = root.querySelector('#updateProgressStatus') as HTMLElement;
      const pctEl = root.querySelector('#updateProgressPercent') as HTMLElement;
      (root.querySelector('#updateProgressSection') as HTMLElement).hidden = false;
      root.querySelectorAll<HTMLButtonElement>('.modal-actions button').forEach((b) => (b.disabled = true));
      (root.querySelector('#btnConfirmUpdate') as HTMLButtonElement).textContent = 'Downloading…';

      unsubscribeProgress = emuApi?.updates?.onProgress?.((data: { percent: number; status: string }) => {
        barEl.style.width = `${data.percent}%`;
        pctEl.textContent = `${data.percent}%`;
        statusEl.textContent = data.status;
      });

      try {
        const res = await emuApi.updates.perform();
        barEl.style.width = '100%';
        pctEl.textContent = '100%';
        statusEl.textContent = res?.openedBrowser ? 'Opened the download page in your browser' : 'Update downloaded';
      } catch {
        toast('The update could not be downloaded. Try again from Settings › About.', 'error');
      }
      setTimeout(() => modal.close(), 900);
    });
  });
}
