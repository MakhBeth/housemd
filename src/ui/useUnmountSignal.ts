import { useEffect, useRef } from 'react';

/**
 * Signal interrotto allo smontaggio (e ricreato al rimontaggio di StrictMode): un dialog aperto da un
 * componente che sparisce si chiude con lui. Va chiamato negli handler, dopo il montaggio. Temporaneo:
 * nella fase 7 gli elementi usano il signal di HmdElement.
 */
export function useUnmountSignal(): () => AbortSignal {
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    return () => current.abort();
  }, []);
  return () => controller.current!.signal;
}
