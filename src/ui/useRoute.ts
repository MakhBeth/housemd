import { useState, useSyncExternalStore } from 'react';

import { browserRouteWindow, createRouteStore, type RouteGuard } from '../state/routeStore';

/** Adattatore React di `state/routeStore.ts`: stessa API di prima. */
export function useRoute(guard: RouteGuard) {
  const [store] = useState(() => createRouteStore(browserRouteWindow()));
  // La guardia cambia a ogni render (chiude su stato nuovo): come prima con il ref aggiornato al render.
  store.setGuard(guard);
  const route = useSyncExternalStore(store.subscribe, store.getState);
  return { route, navigate: store.navigate };
}
