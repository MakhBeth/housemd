import type { Page, Route } from '@playwright/test';

/** Indirizzo del profilo Ollama che l'app crea da sola al primo avvio. */
export const OLLAMA = 'http://localhost:11434';

/**
 * Modello finto: ogni richiesta di chat riceve `comment` + la proposta `reply`, in un solo evento SSE.
 * Le spec cambiano `reply`/`comment` prima di inviare una richiesta.
 */
export class FakeModel {
  reply = '# Changed\n\nNew paragraph.';
  comment = 'Fixed';
  /** Richieste di chat ricevute (non conta l'elenco dei modelli). */
  requests = 0;
  /** Stato HTTP delle risposte di chat: diverso da 200 = errore del provider, con `errorBody` come corpo. */
  status = 200;
  errorBody = '';
  /** Motivo di fine della risposta: `length` = uscita troncata dal limite del modello (proposta «troncata»). */
  finishReason: 'stop' | 'length' = 'stop';
  /** Modelli dell'elenco (`/api/tags`), e quante volte l'app lo ha chiesto. */
  models = ['qwen3.6:35b-mlx'];
  modelLists = 0;
  /** true = il server dei modelli non risponde (connessione rifiutata): l'elenco è «non raggiungibile». */
  modelsDown = false;
  /** Risposte di chat trattenute finché `release()`: per vedere la generazione in corso. */
  #held: (() => void)[] | null = null;

  hold(): void {
    this.#held ??= [];
  }

  release(): void {
    const held = this.#held ?? [];
    this.#held = null;
    for (const go of held) go();
  }

  async install(page: Page): Promise<void> {
    // Un reload interrompe le richieste in volo (l'app chiede l'elenco dei modelli all'avvio): la route
    // allora non esiste più e fulfill lancia. Non è un errore del test, si ignora.
    await page.route(`${OLLAMA}/**`, (route) => this.#answer(route).catch(() => {}));
  }

  async #answer(route: Route): Promise<void> {
    const request = route.request();
    // L'app (localhost:4173) e il modello (localhost:11434) sono origini diverse: Chromium applica CORS
    // anche alle risposte di route.fulfill, e il POST JSON passa prima da un preflight OPTIONS.
    const origin = request.headers()['origin'] ?? '*';
    const cors = {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': request.headers()['access-control-request-headers'] ?? '*',
      vary: 'Origin',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (request.url().includes('/api/tags')) {
      this.modelLists++;
      if (this.modelsDown) {
        await route.abort('connectionrefused');
        return;
      }
      await route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ models: this.models.map((name) => ({ name })) }) });
      return;
    }
    this.requests++;
    const held = this.#held;
    if (held) await new Promise<void>((go) => held.push(go));
    if (this.status !== 200) {
      await route.fulfill({ status: this.status, headers: cors, contentType: 'text/plain', body: this.errorBody });
      return;
    }
    const content = `${this.comment}<housemd-proposal>${this.reply}</housemd-proposal>`;
    const event = JSON.stringify({ choices: [{ delta: { content }, finish_reason: this.finishReason }] });
    await route.fulfill({ headers: cors, contentType: 'text/event-stream', body: `data: ${event}\n\ndata: [DONE]\n\n` });
  }
}
