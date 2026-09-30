// src/ui/useRoute.ts
import { useCallback, useEffect, useRef, useState } from 'react';

import { formatRoute, parseRoute, type Route } from '../lib/route';

interface Guard {
  /** Falso se uscire dalle impostazioni perderebbe modifiche non salvate. */
  canLeave: () => boolean;
  /** Uscita bloccata (es. Indietro del browser): chi la riceve chiede conferma. */
  onBlocked: () => void;
}

/**
 * Vista indirizzata dall'hash. Entrare nelle impostazioni aggiunge una voce di cronologia (Indietro le
 * chiude); cambiare sezione la sostituisce; uscire torna indietro se ci si era entrati dall'app.
 * Con modifiche non salvate l'uscita via cronologia viene annullata e passa per la conferma.
 */
export function useRoute(guard: Guard) {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  const pushed = useRef(false);
  const current = useRef(route);
  current.current = route;
  const guardRef = useRef(guard);
  guardRef.current = guard;

  useEffect(() => {
    const onHash = () => {
      const next = parseRoute(location.hash);
      const previous = current.current;
      if (previous.view === 'settings' && next.view === 'workspace' && !guardRef.current.canLeave()) {
        // Si rimette la voce delle impostazioni e si chiede conferma: la bozza resta montata.
        history.pushState(history.state, '', formatRoute(previous));
        pushed.current = true;
        guardRef.current.onBlocked();
        return;
      }
      if (next.view === 'workspace') pushed.current = false;
      setRoute(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((next: Route) => {
    const current = parseRoute(location.hash);
    if (next.view === 'workspace') {
      if (current.view === 'workspace') return;
      if (pushed.current) {
        pushed.current = false;
        history.back();
        return;
      }
      history.replaceState(history.state, '', location.pathname + location.search);
      setRoute(next);
      return;
    }
    const hash = formatRoute(next);
    if (current.view === 'settings') {
      history.replaceState(history.state, '', hash);
      setRoute(next);
      return;
    }
    pushed.current = true;
    location.hash = hash;
  }, []);

  return { route, navigate };
}
