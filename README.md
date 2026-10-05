<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/readme/house-dark.svg">
    <img src="docs/readme/house-light.svg" width="300" alt="">
  </picture>
  <br>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/readme/logo-dark.svg">
    <img src="docs/readme/logo-light.svg" width="190" alt="">
  </picture>
</p>

# HouseMD

Editor markdown nel browser per le tue cartelle locali, stile HackMD: editor e anteprima affiancati,
salvataggio automatico, ricerca, `[[wikilink]]`. Nessun server: i file restano sul tuo computer
(File System Access API, quindi **solo Chrome o Edge su desktop**).

## Sviluppo

```bash
npm install
npm run dev      # server di sviluppo
npm test         # test (tsx con gli hook degli asset, Node ≥ 22.15)
npm run test:e2e # test end-to-end (Playwright, Chromium); la prima volta: npx playwright install chromium
npm run test:e2e:audit # stili calcolati uguali a dist-baseline/ (prima: build copiata in dist-baseline/)
npm run test:e2e:dev   # e2e contro vite in sviluppo (StrictMode), console senza errori né avvisi
npm run lint     # typecheck
npm run build    # build di produzione in dist/
```

I test end-to-end usano una cartella finta nell'Origin Private File System al posto del selettore
di cartelle (`e2e/support/fsHarness.ts`) e un modello finto al posto di Ollama
(`e2e/support/aiHarness.ts`): nessun account né API a pagamento. Ogni test gira in un profilo
temporaneo su disco; i worker sono 2 di default (`E2E_WORKERS=n` per cambiarli). Gli snapshot in
`e2e/__screenshots__/` sono il riferimento visivo: si rigenerano (`--update-snapshots=all`) solo per
un cambiamento voluto e approvato.

## Configurazione per cartella

File opzionale `.housemd.json` nella radice della cartella aperta:

```json
{
  "images": {
    "saveTo": "static/images",
    "linkPrefix": "/images"
  }
}
```

- `saveTo`: dove salvare le immagini incollate o trascinate (default `assets`).
- `linkPrefix`: se presente, le immagini vengono linkate come `/images/nome.jpg` e nell'anteprima
  `/images/…` viene letto da `static/images/…` (utile per i generatori di siti statici).

## Scorciatoie

| Tasti | Azione |
|---|---|
| `Ctrl+S` | Salva subito |
| `Ctrl+Alt+S` | Salva tutto (anche le bozze degli altri file) |
| `Ctrl+K` | Cerca |
| `Ctrl+B` | Mostra / nascondi la barra laterale (fuori dall'editor) |
| `Ctrl+\` | Editor / Affiancati / Anteprima |

Nell'editor, selezionando del testo compare una barra di formattazione (grassetto, corsivo, barrato,
codice, link, titolo, citazione, elenchi). Le stesse azioni in linea hanno una scorciatoia; ripetuta,
toglie la formattazione:

| Tasti | Azione |
|---|---|
| `Ctrl+B` | Grassetto |
| `Ctrl+I` | Corsivo |
| `Ctrl+Shift+X` | Barrato |
| `Ctrl+E` | Codice in linea |
| `Ctrl+Shift+K` | Link |

L'albero dei file è un solo passo di `Tab`: dentro si naviga con `↑`/`↓`, `Home`/`End`, `→` apre una
cartella (e poi entra), `←` la chiude (o risale alla cartella madre); `Invio` apre, `Shift+F10` mostra il
menu della riga.

## Impostazioni

Dall'ingranaggio nella toolbar: lingua (9 lingue), tema (automatico, chiaro, scuro) e salvataggio
automatico, come in VS Code:

- **Dopo una pausa** (default, 1 s, regolabile da 0,5 a 10 s): salva da solo mentre scrivi;
- **Quando cambi file o finestra**: salva solo al cambio di file e quando la finestra perde il focus;
- **Disattivato**: salva solo con `Ctrl+S` o "Salva tutto".

Nelle ultime due modalità le modifiche finiscono comunque, entro pochi secondi, in una copia di
emergenza nel browser: i file con modifiche non salvate hanno un pallino nell'albero.

**Larghezza massima del testo**, separata per editor e anteprima, in caratteri (da 30 a 300; vuoto
per nessun limite). Di default l'editor non ha limite e l'anteprima si ferma a 72 caratteri; il testo
resta centrato nel pannello.

## Cronologia locale

Ogni salvataggio (al più uno ogni 5 minuti per file) e ogni ricarica, sovrascrittura o ripristino
lasciano una versione nel browser (fino a 50 per file, per 30 giorni). "Cronologia" nella toolbar o
nel menu ⋯ del file mostra le versioni con le differenze; "Ripristina" si annulla con `Ctrl+Z`.

## Bridge locale Claude Code (AI)

Il bridge usa la CLI `claude` già installata e autenticata: il testo viene inoltrato ad Anthropic
tramite l'abbonamento, anche se il bridge è locale. Avvio con `npm run bridge` (Node recente),
oppure `node bridge/claude-bridge.mjs`. Profilo HouseMD: `http://localhost:11436`.
Non usare il bridge di tg-digest sulla porta 11435: manca delle protezioni richieste.

Il server ascolta **solo su 127.0.0.1**, controlla `Origin`, disabilita strumenti e MCP e non salva
sessioni Claude. Ogni richiesta usa una directory temporanea eliminata al termine. Stop chiude
la connessione e termina la CLI. Le richieste sono serializzate, corpo massimo 5 MiB e timeout
5 minuti. `/health` dichiara identità, protocollo e protezioni; l'app lo verifica prima di inviare
un documento. Non sono previste chiamate o retry automatici a servizi a pagamento.

Variabili opzionali: `CLAUDE_BIN` (percorso eseguibile), `PORT` (default 11436), `ALLOWED_ORIGINS`
(origini esatte separate da virgole, **mai `*`**). Per sicurezza il default ammette soltanto
`http://localhost:5173`: l'origine pubblicata non è configurata nel repository. Aggiungerla
esplicitamente, ad esempio:

```bash
ALLOWED_ORIGINS='http://localhost:5173,https://housemd.example' npm run bridge
```

Chrome può richiedere il permesso di accesso alla rete locale. Un 403 indica un'origine non
ammessa; `bridgeIncompatible` indica un programma/bridge diverso sulla porta; `bridgeCli`
richiede di controllare installazione e login della CLI. Se la porta è occupata il bridge riusa
solo un bridge HouseMD compatibile, altrimenti fallisce esplicitamente.

Test automatici: `node --test bridge/claude-bridge.test.mjs` (CLI finta, nessuna API reale).
Restano da collaudare sulla macchina dell'utente l'autenticazione della CLI reale, l'assenza di
sessioni persistite, CORS e permessi Chrome dall'origine pubblicata.

### Modalità AI

L'icona **AI** accanto a Editor, Split e Preview (anche `Ctrl/Cmd+Shift+E`) apre la revisione del documento
corrente con la chat nella sidebar. **Invio** invia, **Shift+Invio** va a capo, **Stop**/`Esc` interrompe.
Selezionando del testo nell'editor compare il chip "Selezione": la richiesta riguarda solo quel tratto
(✕ per usare tutto il documento). I preset compaiono come suggerimenti finché la chat è vuota. Il testo parte
solo su invio o clic su un suggerimento; elenchi modelli e prove di connessione non inviano documenti. Il chip del
modello apre profili, modello e parametri; l'effort ha un suo chip quando il profilo lo supporta.
`Ctrl/Cmd+K` torna ai file con il focus sulla ricerca. File e AI ricordano larghezze separate.

Le impostazioni sono una pagina: ingranaggio o `#settings` (`#settings/ai-profiles`, `#settings/ai-presets`,
`#settings/ai-sync` per le sezioni AI). Indietro del browser o `Esc` le chiudono.

In **Impostazioni → AI** si gestiscono più profili, chiavi, preset e sync. Ollama usa per default
`http://localhost:11434`, LM Studio `http://localhost:1234`. Configurare `OLLAMA_ORIGINS` con l'origine di HouseMD,
oppure abilitare **Enable CORS** in LM Studio; consentire l'accesso alla rete locale se Chrome lo chiede.
Gli endpoint OpenAI-compatible devono consentire CORS o essere raggiunti tramite un proxy configurato dall'utente.
Anthropic usa l'API Messages e la chiave dedicata; la prova connessione legge l'elenco modelli, senza generazioni.

Le chiavi ricordate sono nello store IndexedDB separato `aiSecrets`; quelle non ricordate solo in memoria.
Non vengono esportate o sincronizzate. Sono legate al provider e all'origine: cambiando endpoint occorre inserirle
nuovamente. **Estensioni e chi usa il profilo del browser possono leggere una chiave salvata**: preferire una
chiave dedicata con limite di spesa. Il bridge Claude è locale, ma la CLI inoltra il testo ad Anthropic.

La barra di revisione ha le frecce per le modifiche precedente/successiva, gli avvisi quando ci sono,
**Scarta** e **Accetta tutto**. Ogni blocco del diff ha **←** (accetta) e **→** (rifiuta: torna il testo originale).
Quando non restano differenze la barra si chiude: accettando si torna all'editor (Ctrl+Z fa ricomparire il diff),
rifiutando tutti i blocchi la proposta viene scartata.

L'accettazione è una transazione dell'editor, annullabile anche dopo aver cambiato vista, e crea uno snapshot
`before-ai`. Durante lo streaming non si accetta; una risposta troncata si accetta solo per blocchi.
I preset conservano di default il frontmatter e lavorano in parti; **Continua** riprende le parti non completate.
L'ambito **Selezione** conserva le modifiche esterne all'intervallo e si invalida quando il tratto selezionato cambia.
La chat e le proposte non sono persistite: aggiornamento PWA e chiusura proteggono il lavoro ancora pendente.

Le risposte e le anteprime AI non interpretano HTML grezzo e non caricano immagini remote: nella chat
compaiono come etichetta con l'host, nella revisione come testo. Gli avvisi su codice, link e lunghezza
sono indicazioni da rivedere, non una certificazione della correttezza del modello.

### Sync delle impostazioni AI

Scegliere la stessa cartella in **Impostazioni → AI → Sincronizzazione** sui browser interessati.
`housemd-sync.json` contiene preset, profili e tombstone, mai chiavi o riferimenti ai segreti. Dopo il riavvio
può servire **Riattiva sincronizzazione**. Il ciclo parte all'avvio, al focus e dopo modifiche alle impostazioni,
senza polling. Ogni pubblicazione verifica un backup e un temporaneo univoco; gli ultimi 20 backup ordinari
sono conservati, quelli di ripristino restano.

È una sync **best effort**, non un lock atomico: cartelle replicate possono collidere. La convergenza richiede
che le modifiche si fermino, le repliche si propaghino e ciascun browser completi un giro senza collisioni con
il proprio database intatto. Cancellare un database può perdere le modifiche presenti solo lì.
Usare **Ripristina questo backup** per un rimpiazzo totale con nuova epoca e anteprima dei conteggi: copiare
manualmente un backup sopra il file non equivale a un ripristino.

### Verifiche AI

`npm test`, `npm run lint`, `npm run build`, `npm run test:e2e`. Le spec AI (`e2e/ai-review.spec.ts`)
usano un profilo temporaneo, una cartella finta e risposte simulate: verificano revisione,
accettazione anche ripetuta e per blocchi sulla selezione, undo attraverso le viste, snapshot e
assenza di richieste per immagini ostili prima del consenso. Non usano account o API a pagamento.
Restano da verificare con servizi reali CORS dall'origine pubblicata, autenticazione CLI/API,
permessi FSA su due profili Chrome e PWA offline con il server locale.
