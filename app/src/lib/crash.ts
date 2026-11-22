// Turns crashes into something visible: a calm error screen instead of the app closing,
// and a saved report the owner can copy and send to the developer.
import SuperAlarm from '../../modules/super-alarm';

type Listener = (e: Error) => void;
const listeners = new Set<Listener>();

export function describe(e: unknown): string {
  const err = e instanceof Error ? e : new Error(String(e));
  return `${err.name}: ${err.message}\n${err.stack ?? ''}`.slice(0, 8000);
}

export function recordCrash(e: unknown, where = 'js') {
  try { SuperAlarm?.saveCrash?.(`JS error (${where})\n${describe(e)}`); } catch {}
}

/** Last saved crash report, or ''. Reading it clears it. */
export function takeLastCrash(): string {
  try { return SuperAlarm?.takeCrash?.() ?? ''; } catch { return ''; }
}

export function onFatal(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

type EU = { getGlobalHandler: () => (e: Error, fatal?: boolean) => void; setGlobalHandler: (h: (e: Error, fatal?: boolean) => void) => void };

let installed = false;
export function installCrashHandler() {
  if (installed) return;
  installed = true;
  const eu = (globalThis as unknown as { ErrorUtils?: EU }).ErrorUtils;
  if (!eu) return;
  const previous = eu.getGlobalHandler();
  eu.setGlobalHandler((e, fatal) => {
    recordCrash(e, fatal ? 'fatal' : 'error');
    if (fatal && listeners.size > 0) {
      // Show the error screen instead of letting the app close.
      listeners.forEach((fn) => { try { fn(e); } catch {} });
      return;
    }
    if (!fatal) return;
    previous(e, fatal);
  });
}
