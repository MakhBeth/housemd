import { formatRoute, parseRoute, type Route } from '../lib/route';

/** Quello che serve della finestra: iniettato, così lo store si prova senza browser. */
export interface RouteWindow {
  hash(): string;
  pushState(url: string): void;
  replaceState(url: string): void;
  back(): void;
  setHash(hash: string): void;
  /** URL senza hash (per uscire dalle impostazioni senza voce di cronologia). */
  cleanUrl(): string;
  onHashChange(listener: () => void): () => void;
}

export interface RouteGuard {
  /** Falso se uscire dalle impostazioni perderebbe modifiche non salvate. */
  canLeave(): boolean;
  /** Uscita bloccata (es. Indietro del browser): chi la riceve chiede conferma. */
  onBlocked(): void;
}

/**
 * Vista indirizzata dall'hash. Entrare nelle impostazioni aggiunge una voce di cronologia (Indietro le
 * chiude); cambiare sezione la sostituisce; uscire torna indietro se ci si era entrati dall'app.
 * Con modifiche non salvate l'uscita via cronologia viene annullata e passa per la conferma.
 * Il listener di hashchange esiste solo con almeno un iscritto.
 */
export function createRouteStore(win: RouteWindow) {
  let route = parseRoute(win.hash());
  /** Le impostazioni sono state aperte dall'app con una voce di cronologia propria. */
  let pushed = false;
  let guard: RouteGuard = { canLeave: () => true, onBlocked: () => {} };
  const listeners = new Set<() => void>();
  let stopListening: (() => void) | null = null;

  const set = (next: Route) => {
    route = next;
    for (const listener of listeners) listener();
  };

  const onHash = () => {
    const next = parseRoute(win.hash());
    if (route.view === 'settings' && next.view === 'workspace' && !guard.canLeave()) {
      // Si rimette la voce delle impostazioni e si chiede conferma: la bozza resta montata.
      win.pushState(formatRoute(route));
      pushed = true;
      guard.onBlocked();
      return;
    }
    if (next.view === 'workspace') pushed = false;
    set(next);
  };

  return {
    getState: (): Route => route,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      if (listeners.size === 1) stopListening = win.onHashChange(onHash);
      return () => {
        if (!listeners.delete(listener) || listeners.size > 0) return;
        stopListening?.();
        stopListening = null;
      };
    },
    setGuard(next: RouteGuard): void {
      guard = next;
    },
    navigate(next: Route): void {
      const current = parseRoute(win.hash());
      if (next.view === 'workspace') {
        if (current.view === 'workspace') return;
        if (pushed) {
          pushed = false;
          win.back();
          return;
        }
        win.replaceState(win.cleanUrl());
        set(next);
        return;
      }
      const hash = formatRoute(next);
      if (current.view === 'settings') {
        win.replaceState(hash);
        set(next);
        return;
      }
      pushed = true;
      win.setHash(hash);
    },
  };
}

export type RouteStore = ReturnType<typeof createRouteStore>;

export function browserRouteWindow(): RouteWindow {
  return {
    hash: () => location.hash,
    pushState: (url) => history.pushState(history.state, '', url),
    replaceState: (url) => history.replaceState(history.state, '', url),
    back: () => history.back(),
    setHash: (hash) => {
      location.hash = hash;
    },
    cleanUrl: () => location.pathname + location.search,
    onHashChange: (listener) => {
      window.addEventListener('hashchange', listener);
      return () => window.removeEventListener('hashchange', listener);
    },
  };
}
