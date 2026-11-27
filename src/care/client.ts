const STORAGE_KEY = 'eshkere.care.v0';

type InventoryStatus = 'owned' | 'planned';
interface Preferences {
  completed: Record<string, true>;
  inventory: Record<string, InventoryStatus>;
}

const emptyPreferences = (): Preferences => ({ completed: {}, inventory: {} });
const isStatus = (value: unknown): value is InventoryStatus => value === 'owned' || value === 'planned';

export function initCare(root: HTMLElement) {
  const all = <T extends HTMLElement>(selector: string) => Array.from(root.querySelectorAll<T>(selector));
  const panels = all<HTMLElement>('[data-module-panel]');
  const links = all<HTMLAnchorElement>('[data-module-link]');
  const checks = all<HTMLInputElement>('[data-step-id]');
  const inventory = all<HTMLSelectElement>('[data-supply-id]');
  const routines = all<HTMLElement>('[data-routine]').map((routine) => ({
    checks: Array.from(routine.querySelectorAll<HTMLInputElement>('[data-step-id]')),
    count: routine.querySelector<HTMLElement>('[data-routine-count]'),
    reset: routine.querySelector<HTMLButtonElement>('[data-reset-routine]'),
  }));
  const reset = root.querySelector<HTMLButtonElement>('[data-reset-all]');
  const status = root.querySelector<HTMLElement>('[data-reset-status]');
  const warning = root.querySelector<HTMLElement>('[data-storage-warning]');
  let preferences = emptyPreferences();
  let storageAvailable = true;

  function selectModule(requested?: string) {
    const current = panels.find((panel) => panel.id === requested) ?? panels[0];
    for (const panel of panels) panel.hidden = panel !== current;
    for (const link of links) {
      if (link.dataset.moduleLink === current?.id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  }

  const selectFromUrl = () => {
    const hash = location.hash.slice(1);
    if (!hash || panels.some((panel) => panel.id === hash)) selectModule(hash);
  };

  function storageFailed() {
    storageAvailable = false;
    if (warning) warning.hidden = false;
  }

  function readPreferences(): Preferences {
    if (!storageAvailable) return preferences;
    let raw: string | null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      storageFailed();
      return preferences;
    }

    const next = emptyPreferences();
    try {
      const saved: Partial<Preferences> | null = JSON.parse(raw ?? 'null');
      for (const { dataset: { stepId } } of checks) {
        if (stepId && saved?.completed?.[stepId] === true) next.completed[stepId] = true;
      }
      for (const { dataset: { supplyId } } of inventory) {
        if (!supplyId) continue;
        const value = saved?.inventory?.[supplyId];
        if (isStatus(value)) next.inventory[supplyId] = value;
      }
    } catch {
      // A malformed snapshot can be replaced by the next valid change.
    }
    return next;
  }

  function renderPreferences() {
    for (const check of checks) check.checked = !!preferences.completed[check.dataset.stepId ?? ''];
    for (const select of inventory) {
      select.value = preferences.inventory[select.dataset.supplyId ?? ''] ?? '';
      select.dataset.status = select.value;
    }
    for (const routine of routines) {
      const completed = routine.checks.filter((check) => check.checked).length;
      if (routine.count) {
        routine.count.textContent = `${completed} checked`;
        routine.count.hidden = false;
      }
      if (routine.reset) routine.reset.hidden = completed === 0;
    }
  }

  function updatePreferences(update: (next: Preferences) => void) {
    preferences = readPreferences();
    update(preferences);
    if (status) status.textContent = '';
    if (storageAvailable) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      } catch {
        storageFailed();
      }
    }
    renderPreferences();
  }

  for (const link of links) {
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      if (location.hash !== link.hash) history.pushState(null, '', link.hash);
      selectModule(link.dataset.moduleLink);
    });
  }
  window.addEventListener('hashchange', selectFromUrl);

  for (const check of checks) {
    const id = check.dataset.stepId;
    if (!id) continue;
    check.addEventListener('change', () => updatePreferences(({ completed }) => {
      if (check.checked) completed[id] = true;
      else delete completed[id];
    }));
  }
  for (const select of inventory) {
    const id = select.dataset.supplyId;
    if (!id) continue;
    select.addEventListener('change', () => updatePreferences(({ inventory }) => {
      if (isStatus(select.value)) inventory[id] = select.value;
      else delete inventory[id];
    }));
  }
  for (const routine of routines) {
    routine.reset?.addEventListener('click', () => {
      updatePreferences(({ completed }) => {
        for (const { dataset: { stepId } } of routine.checks) if (stepId) delete completed[stepId];
      });
      routine.checks[0]?.focus();
    });
  }

  reset?.addEventListener('click', () => {
    if (!window.confirm('Clear completion and inventory status for all Care modules?')) return;
    preferences = emptyPreferences();
    try {
      localStorage.removeItem(STORAGE_KEY);
      if (status) status.textContent = 'Care data reset.';
    } catch {
      storageFailed();
      if (status) status.textContent = 'This page was reset. Saved data could not be cleared.';
    }
    renderPreferences();
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    preferences = readPreferences();
    if (status) status.textContent = '';
    renderPreferences();
  });

  selectModule(location.hash.slice(1));
  preferences = readPreferences();
  renderPreferences();
  for (const control of all<HTMLElement>('[data-state-control], [data-reset-all]')) control.hidden = false;
  root.dataset.enhanced = '';
}
