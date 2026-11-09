# LAB-7 — Messaggi accessibili nel contesto

Proposta LAB-404, base `main` al commit `17425536a5fddd637815b8c99a0bbc20f4f502f9`. Solo design: nessuna modifica applicativa. I riferimenti di riga e i testi fotografano questa base.

## Decisione e alternative

1. **Raccomandata: note locali e banner nel flusso.** Esito accanto all'azione; problemi di documento sopra l'editor; problemi di cartella sotto la toolbar. La vicinanza rende chiaro cosa è successo, i banner restano disponibili anche quando un errore nasce in background.
2. Tutti i messaggi in un unico banner: semplice, ma separa gli errori dai campi e mescola documenti, sync e salvataggi. Scartata.
3. Centro notifiche con contatore: conserva uno storico, ma introduce navigazione e un nuovo componente per leggere informazioni necessarie all'azione corrente. Scartata perché fuori necessità.

Riutilizzare note `role="status"`, `announce`, indicatore di salvataggio, barra conflitto e righe di errore delle impostazioni. I banner sono righe nel layout, non popover, overlay, toast rinominati o finestre modali. I pulsanti sono fuori dalla regione live del testo. Nessun nuovo centro notifiche.

## Struttura, stati e comportamento comune

- **Locale:** paragrafo sotto il controllo o il gruppo di pulsanti che ha avviato l'operazione; nei dialog resta nel dialog. Errore effettivo `role="alert"`; impedimento preventivo o conferma `role="status"`. Collegare la nota al controllo con `aria-describedby` senza cambiare il nome del pulsante.
- **Documento:** riga sopra editor/anteprima/diff, dopo la toolbar e prima della barra conflitto; associata al percorso originario. È presente anche in modalità focus. Se il documento non è più quello attivo, l'esito resta nel banner di workspace con il percorso e non viene attribuito al nuovo documento.
- **Workspace:** righe sotto la toolbar, prima dell'area centrale, visibili in tutte le modalità. Nessun posizionamento fisso. Avvisi globali di avvio/aggiornamento nella stessa posizione logica dell'app anche senza cartella aperta.
- **Vuoto:** le regioni live locali vengono montate vuote; nessun testo «Nessuna notifica». I contenitori di banner vuoti non occupano spazio. **Caricamento:** mantenere i progressi esistenti (`folder.opening`, `save.saving`, `update.applying`, stato sync), nessuna percentuale inventata. **Successo:** nota locale persistente fino alla prossima azione nello stesso contesto. **Errore:** testo e azione disponibili fino alla risoluzione o chiusura esplicita, mai timer.
- Il nuovo tentativo elimina l'esito del tentativo precedente nello stesso contesto; il successo elimina il relativo errore. Un altro documento, comando o errore non cancella problemi ancora aperti. Configurazione/lettura si rivalutano al caricamento riuscito della cartella; cronologia alla successiva operazione riuscita; sync alla successiva sync riuscita. All'abbandono esplicito della cartella si eliminano gli esiti relativi a quella cartella, non gli avvisi globali dell'app.
- Conferme e avvisi informativi possono avere **Chiudi** (`toast.close`, testo visibile). Errori di rischio dati (`saveFailed`, `bufferFailed`, `draftNotPersisted`, documento eliminato) non si nascondono manualmente: restano fino al salvataggio/recupero o abbandono esplicito già protetto dal flusso esistente. Non introdurre nuove azioni distruttive. Chiudere gli altri messaggi non risolve il problema e un nuovo tentativo fallito li ripresenta.
- Nessun focus automatico all'arrivo di un messaggio, né apertura automatica di pannelli. Tab segue l'ordine DOM; Invio/Spazio attivano i pulsanti; Esc conserva il comportamento del dialog/popover esistente, non svuota tutti gli errori. Se Chiudi rimuove il controllo che possiede il focus, restituirlo al controllo origine se presente, altrimenti alla toolbar persistente (o Apri cartella all'avvio). Non spostare focus quando è altrove.
- Quando l'origine è nascosta (sidebar chiusa, modalità focus, impostazioni chiuse), mostrare il messaggio nel banner di workspace. Per un dialog modale aperto, gli esiti delle sue azioni devono essere al suo interno; gli eventi esterni restano registrati e saranno annunciati dopo la chiusura. Alla riapertura del contesto il messaggio torna locale senza un secondo annuncio automatico. Un solo canale live per evento, mai banner e nota entrambi parlanti.
- `announce` aggiorna una regione già montata, con `aria-atomic="true"`; un nuovo tentativo esplicito con lo stesso esito forza il riannuncio. Render, lingua, cambio vista e polling invariato non ripetono l'allarme. Eventi distinti non si sovrascrivono: restano righe leggibili; eventi automatici identici per codice e contesto si aggiornano una sola volta. Riassumere in un solo aggiornamento quelli dello stesso caricamento, mantenendo i dettagli visibili.
- Mai `disabled` o `aria-disabled`: se il comando non può partire, nota `status` accanto e focus sul pulsante. Se parte e fallisce, `alert`. Nessun tooltip come unico canale. Il motivo resta visibile oltre hover/focus.

## Inventario Workspace e aggiornamenti

Nella tabella i file abbreviati sono `W = src/workspace/workspace.ts`, `U = src/elements/update-notice/update-notice.element.ts`, `A = src/elements/app/app.element.ts`. I testi esatti per tutte le lingue sono nell'appendice; la chiave è anche l'identificatore verificabile. Conservare le chiavi attuali salvo le due pluralizzazioni indicate sotto.

| Chiave `toast.*` | Origine | Trigger e tipo | Destinazione / ruolo / motivo |
| --- | --- | --- | --- |
| saveFailed | W:776 | Scrittura documento fallita; errore | Estendere indicatore salvataggio con dettaglio visibile, `alert`; in focus banner documento. Unificare l'annuncio con `save.error`, non pronunciarli entrambi. |
| configInvalidJson | W:318 | Parsing configurazione all'apertura; avviso | Banner workspace `status`, file e dettaglio: riguarda tutta la cartella. |
| configInvalidSaveTo | W:319 | Config immagini con percorso non valido; avviso | Banner workspace `status`; conserva il problema fino alla rivalutazione. |
| configInvalidLinkPrefix | W:319 | Prefisso immagini non valido; avviso | Banner workspace `status`, stesso comportamento della configurazione. |
| restoredDraft | W:438 | Apertura file con modifiche recuperate; conferma | Banner documento `status`, chiudibile; recupero non equivale a salvataggio su disco. |
| restoredDraftDeleted | W:401 | Recupero bozza senza file; avviso | Banner documento `status`, persistente fino al recupero/abbandono. Riusa le azioni della bozza orfana. |
| deletedOutside | W:906 | Controllo esterno rileva eliminazione; avviso | Banner documento `status`, unifica con `save.deleted`; nessun doppio annuncio. Non chiudibile finché il file manca. |
| unreadableFiles | W:335 | Indicizzazione con file illeggibili; avviso | Banner workspace `status`, elenco completo che va a capo: segnala ricerca incompleta senza interrompere l'editor. |
| alreadyExists | W:228 | FsExistsError in operazione file; errore | `alert` sotto campo nome se dialog ancora aperto, altrimenti nota sotto azioni albero; banner workspace se albero nascosto. |
| notFound | W:229 | FsNotFoundError in operazione file; errore | Stessa origine dell'azione file, `alert`; il percorso distingue il file interessato. |
| operationFailed | W:230 | Altra eccezione in run (creazione, rinomina, eliminazione, lettura, immagini…); errore | `alert` nel controllo origine. Immagine incollata/caricata: banner documento; caricamento cartella: banner workspace. Conservare contesto operazione/percorso, non dedurlo dal documento attuale. |
| openFolderFailed | W:203 | Scelta/apertura di un'altra cartella fallita; errore | Nota `alert` accanto ad Apri cartella; se sidebar nascosta, banner workspace. Resta la cartella attuale. All'avvio conservare l'errore locale della schermata iniziale, senza duplicarlo. |
| saveAllSkipped | W:655 | Salva tutto lascia bozze non scritte; avviso | Nota `status` sotto Salva tutto (toolbar oppure impostazioni secondo origine), persistente fino a nuovo tentativo o chiusura. Non confonderla con singolo save.error. |
| saveAllDone | W:656 | Salva tutto completato; conferma | Nota `status` presso Salva tutto; conservata fino al nuovo tentativo o nuove modifiche. Non eliminata: conferma il lotto, non solo il documento corrente. |
| draftNotPersisted | W:745,752 | Settle fallisce: impossibile mettere al sicuro il testo; errore | Banner documento `alert`, persistente. Nel cambio cartella/file fallito il documento rimane; nell'aggiornamento la stessa spiegazione è accanto ad Aggiorna, senza doppio annuncio. |
| bufferFailed | W:564,630 | Copia emergenza o lettura bozze durante Salva tutto fallita; errore | Banner documento `alert` nel primo caso; nota Salva tutto `alert` nel secondo. Non promettere sicurezza su disco. |
| historyFailed | W:1080 | Lettura/snapshot cronologia fallito; errore (oggi info) | Nota `alert` presso Cronologia; se pannello aperto, errore nel pannello. Non blocca salvataggi. Un annuncio per episodio, persiste finché un'operazione cronologia riesce o Chiudi. |
| restoreCancelled | W:1030 | Documento/versione/generazione non più coerente al ripristino; avviso | Nota `status` sotto Ripristina nel pannello cronologia. Se il contesto è sparito, banner workspace; nessun ripristino o cambio focus automatico. |
| newVersion | U:54 | Service worker disponibile; avviso | Banner app `status` con Aggiorna e Più tardi già esistenti; nel flusso, non hmd-notice flottante. Persiste fino ad aggiornamento o Più tardi. |
| reloadOtherTabs | A:235 | DB bloccato da altra scheda; avviso | Banner app `status`, persistente fino allo sblocco o Chiudi. Non promettere che Chiudi sblocchi il DB. |
| update.applying | U:54 | Aggiornamento in corso; progresso | Stessa nota `status` accanto ad Aggiorna. Clic ripetuto riannuncia, non avvia operazioni concorrenti. |

`newVersion` e `reloadOtherTabs` appartengono al catalogo ToastCode ma oggi passano da `hmd-notice`, non dall'array workspace. Sono inclusi per rimuovere anche i messaggi flottanti. `toast.close` è un'etichetta, non un messaggio. Non esistono altri progressi nel flusso hmd-toasts.

## Inventario AI: canale parallelo da non perdere

`src/elements/workspace/workspaceView.ts:19–23` aggiunge `AiState.error` come toast `ai-error`. `src/ai/aiController.ts:45` accetta i codici `AiErrorCode` di `src/ai/types.ts:8`; tutti i 27 codici sono coperti dalla tabella dei testi nell'appendice. Non basta cercare `toast(`.

La destinazione dipende dall'operazione origine, non soltanto dal codice (`server` può arrivare da più azioni):

| Origine attuale | Trigger | Destinazione e ruolo |
| --- | --- | --- |
| src/elements/ai/model-select.element.ts:134 | provider/listModels fallisce | `alert` sotto selettore modello e Aggiorna, anche nel popover o dettaglio profilo; sostituisce l'errore generico duplicato con lo specifico. |
| src/elements/ai/model-chip.element.ts:147 | Salvataggio parametri/override fallisce | `alert` sotto azioni del chip; se chiuso, banner workspace. |
| src/elements/ai/composer.element.ts:227 | scopeLost prima dell'invio | `status` sotto Invia: azione impedita, testo digitato conservato. |
| src/elements/ai/composer.element.ts:230 | send rigetta prima/oltre gestione messaggio | `alert` sotto Invia; se la chat ha già lo stesso errore del tentativo, solo il messaggio in chat annuncia. |
| src/elements/settings/profiles.element.ts:141 | Creazione/salvataggio/eliminazione profilo o chiave | `alert` sotto azioni del profilo interessato; conservare campi e focus. |
| src/elements/settings/presets.element.ts:115 | Operazione preset | `alert` sotto azioni preset interessato. |
| src/elements/settings/sync.element.ts:93,159,199 | Scelta/disattivazione/riattivazione cartella, elenco backup, conferma/ripristino backup | `alert` nella sezione Sync accanto all'azione; se dialog attivo, dentro dialog. Non duplicare l'alert del servizio sync già presente. |
| src/ai/syncBinding.ts:66,126 | Lettura metadati o reload profili/preset in background | Banner workspace `alert`; se Sync visibile, sua riga errore. |
| src/elements/workspace/aiSession.ts:53 | Inizializzazione AI fallita (server) | Banner workspace `alert`, visibile anche in modalità senza sidebar AI. |
| src/ai/aiController.ts:53 | aiPendingUpdate durante prepare | `status` accanto ad Aggiorna: comando impedito, conserva proposte. |

Tutti gli altri codici arrivati da `report` sono errori effettivi `alert` nel contesto della tabella, inclusi `scopeLost`/`aiPendingUpdate` se non sono il caso preventivo qui indicato. `aborted` è una conferma `status` quando è un annullamento volontario. `syncLocked` è avviso `status` se il comando non parte, `alert` se l'operazione fallisce. Queste eccezioni dipendono dal trigger, non dalla traduzione.

Gli errori durante lo streaming in `aiController.ts:150` vengono già salvati in `ChatMessage.error`, non in `AiState.error`: mantenere registro e riprova esistenti, senza aggiungere notifiche. Anche `AiSyncState.error` ha già una riga `alert` nelle impostazioni: non trasformarlo in un secondo banner contemporaneo. Nessun messaggio tecnico o segreto del provider viene aggiunto: usare i soli testi tradotti del catalogo.

## Coerenza visiva e accessibilità

Font/palette esistenti in `src/styles/global.css`: `--font-ui`, `--c-text`, `--c-surface`, `--c-border`, `--c-danger`, `--c-warning-bg`. Densità come `conflict-bar.css`: padding 8px 12px, gap 8px, controlli 4px 10px e raggio 6px. Note locali con stile delle note toolbar/impostazioni esistenti. Testo completo, nessuna ellissi sui dettagli; percorsi lunghi a capo. Azioni vanno a capo sotto il testo, senza ridurre font o coprire editor a zoom elevato.

Testo normale almeno 4.5:1, contorni funzionali/focus almeno 3:1 rispetto ai colori adiacenti; verificare entrambi i temi prima dell'implementazione finale. Gli errori si riconoscono dalle parole, non dal rosso. In forced-colors usare Canvas/CanvasText, ButtonText e bordo di sistema; icone decorative aria-hidden, nessuna informazione affidata alla maschera. Conservare outline di focus e rimuovere box-shadow sui controlli in forced-colors. Nessun nuovo gradiente, ombra decorativa o animazione.

Skill design-taste-frontend applicata alla critica del pattern, non alla produzione di mockup: documento comportamentale, nessun mockup da sottoporre a lint/inspect. Non estraggo direzioni né cambio palette/font già approvati. Ignorate intenzionalmente le indicazioni che introdurrebbero nuovi font, marchio o testo inglese: prevalgono UI esistente e italiano. L'ombra funzionale di focus esistente si conserva perché è una garanzia del progetto, non un ornamento. Nessun asset da internet.

## Verifica richiesta al Builder e ai revisori

1. Ripetere ricerca sui produttori e sul collegamento UI, non solo sulle stringhe. Comandi: `git grep -n -E 'toast|Toast' -- src`; `git grep -n -E '\.report\(|error:' -- src/ai src/elements`. L'appendice fotografa tutte le chiavi `toast.*`, `ai.error.*` e `update.applying`; includere nei futuri diff eventuali nuovi produttori.
2. Ogni riga ha un contesto che sopravvive alla chiamata asincrona; verificare errore tardivo dopo cambio file, chiusura pannello e cambio modalità focus. Nessun risultato del vecchio documento appare come errore del nuovo.
3. Tastiera: doppio clic identico annunciato; nessun focus rubato; Chiudi non manda sul body; dialog con messaggio al suo interno; pulsanti disponibili durante busy e motivo in status.
4. Screen reader: una sola emissione per evento, persistenza leggibile, errori salvati e non cancellati da un render. Verificare due problemi distinti contemporanei, identico errore automatico ripetuto e successo che risolve solo il proprio errore.
5. Chiaro/scuro, forced-colors, zoom 200% e viewport stretta: messaggi lunghi e azioni leggibili; nessun overlay. Riutilizzare gli scenari esistenti salvataggio, file esterni, AI, sync e PWA; test pertinenti al cambiamento secondo il gate del progetto.
6. Questo commit modifica soltanto documentazione: nessun test applicativo o screenshot rigenerato. La review di design non certifica ancora contrasto renderizzato o comportamento reale con screen reader.

## Testi e locali

Conservare i testi correnti (appendice) senza rinominare in massa le chiavi solo perché contengono `toast`. `{detail}` resta il dettaglio originale di browser/parser, non HTML; percorsi e parametri restano testo. Etichette esistenti `toast.close`, `update.apply`, `update.dismiss`, `update.applying` coprono le azioni: non servono altre etichette.

Le due chiavi con conteggio `toast.unreadableFiles` e `toast.saveAllSkipped` vanno sostituite da `.one`/`.other` in tutti i nove locali, scelte con `pluralKey`. La forma `.other` conserva il testo corrente; le forme `.one` sono riportate sotto. I valori giapponesi sono identici nelle due forme, conformemente alla selezione delle categorie del locale. Nessun conteggio hardcoded nell'interfaccia.

### Forme singolari proposte

| Locale | `toast.unreadableFiles.one` | `toast.saveAllSkipped.one` |
| --- | --- | --- |
| de | {count} Datei konnte nicht gelesen werden: {paths} | {count} Änderung nicht gespeichert: Die Datei wurde auf dem Datenträger geändert oder gelöscht oder konnte nicht geschrieben werden. Öffne sie, um das Problem zu beheben. |
| en | Could not read {count} file: {paths} | {count} change not saved: its file changed or was deleted on disk, or could not be written. Open it to resolve. |
| es | No se pudo leer {count} archivo: {paths} | {count} cambio sin guardar: su archivo cambió o se eliminó en el disco, o no se pudo escribir. Ábrelo para resolverlo. |
| fr | Impossible de lire {count} fichier : {paths} | {count} modification non enregistrée : son fichier a changé ou a été supprimé sur le disque, ou n’a pas pu être écrit. Ouvre-le pour résoudre le problème. |
| it | Impossibile leggere {count} file: {paths} | {count} modifica non salvata: il suo file è cambiato o è stato eliminato su disco, oppure non si è potuto scrivere. Aprila per risolvere. |
| ja | {count} 個のファイルを読み込めませんでした：{paths} | {count} 件の変更を保存できませんでした。ディスク上でファイルが変更・削除されたか、書き込めませんでした。開いて解決してください。 |
| nl | Kan {count} bestand niet lezen: {paths} | {count} wijziging niet opgeslagen: het bestand is op schijf gewijzigd of verwijderd, of kon niet worden geschreven. Open het om dit op te lossen. |
| pl | Nie można odczytać pliku ({count}): {paths} | Niezapisana zmiana ({count}): jej plik zmienił się lub został usunięty na dysku albo nie dało się go zapisać. Otwórz go, aby to rozwiązać. |
| pt | Não foi possível ler {count} ficheiro: {paths} | {count} alteração não guardada: o respetivo ficheiro foi alterado ou eliminado no disco, ou não foi possível escrevê-lo. Abra-o para resolver. |

### Catalogo completo dei testi da conservare

Per ogni locale: chiave e testo esatto, incluso il numero di riga del catalogo corrente. Le due chiavi numeriche qui riportate diventano `.other`. I 27 codici AI sono elencati integralmente anche quando normalmente compaiono nel registro chat: il ponte `AiState.error` non filtra per codice.

#### de

| Chiave | Riga in `src/i18n/locales/de.json` | Testo |
| --- | --- | --- |
| `toast.close` | 65 | Schließen |
| `update.apply` | 116 | Aktualisieren |
| `update.dismiss` | 117 | Später |
| `update.applying` | 118 | HouseMD wird aktualisiert: Dein Dokument wird gespeichert, dann lädt die Seite neu |
| `toast.saveFailed` | 119 | Speichern fehlgeschlagen: {detail} |
| `toast.configInvalidJson` | 120 | {file} ist ungültig: {detail} |
| `toast.configInvalidSaveTo` | 121 | {file}: images.saveTo muss ein Pfad sein |
| `toast.configInvalidLinkPrefix` | 122 | {file}: images.linkPrefix muss mit "/" beginnen |
| `toast.restoredDraft` | 123 | Nicht gespeicherte Änderungen von {path} wiederhergestellt |
| `toast.restoredDraftDeleted` | 124 | Nicht gespeicherte Änderungen von {path} wiederhergestellt (die Datei existiert nicht mehr auf dem Datenträger) |
| `toast.deletedOutside` | 125 | {path} wurde außerhalb von HouseMD gelöscht |
| `toast.unreadableFiles` | 126 | {count} Dateien konnten nicht gelesen werden: {paths} |
| `toast.alreadyExists` | 127 | Existiert bereits: {path} |
| `toast.notFound` | 128 | Nicht gefunden: {path} |
| `toast.operationFailed` | 129 | Vorgang fehlgeschlagen: {detail} |
| `toast.saveAllSkipped` | 130 | {count} Änderungen nicht gespeichert: Die zugehörige Datei wurde auf dem Datenträger geändert oder gelöscht oder konnte nicht geschrieben werden. Öffne sie, um das zu klären. |
| `toast.saveAllDone` | 131 | Alle Änderungen gespeichert |
| `toast.draftNotPersisted` | 132 | Deine Änderungen konnten nicht gesichert werden: Speichere die Datei oder kopiere den Text |
| `toast.bufferFailed` | 133 | Die Notfallkopie konnte nicht geschrieben werden: {detail} |
| `toast.historyFailed` | 134 | Der lokale Verlauf ist nicht verfügbar: {detail} |
| `toast.restoreCancelled` | 135 | Wiederherstellung abgebrochen: Das Dokument wurde inzwischen geändert |
| `toast.newVersion` | 136 | Eine neue Version von HouseMD ist verfügbar |
| `toast.reloadOtherTabs` | 137 | HouseMD ist in einem anderen Tab mit einer älteren Version geöffnet: Speichere und schließe diesen Tab, um fortzufahren |
| `toast.openFolderFailed` | 138 | Der Ordner konnte nicht geöffnet werden: {detail} |
| `ai.error.unreachable` | 255 | Server nicht erreichbar. Prüfe CORS, die Verfügbarkeit des Servers und die Berechtigung für lokale Netzwerke in Chrome. |
| `ai.error.bridgeDown` | 256 | Bridge nicht verfügbar. Starte npm run bridge. |
| `ai.error.bridgeIncompatible` | 257 | Dies ist keine kompatible, geschützte HouseMD-Bridge. Es wurde kein Dokument gesendet. |
| `ai.error.secretBinding` | 258 | Der Schlüssel gehört zu einem anderen Anbieter oder Endpunkt. Gib ihn erneut ein, um diesen Endpunkt zu bestätigen. |
| `ai.error.scopeLost` | 259 | Die Auswahl hat sich geändert. Wähle den Text erneut aus und versuche es noch einmal. |
| `ai.error.bridgeCli` | 260 | Claude CLI ist fehlgeschlagen. Prüfe die Installation und die Anmeldung für dein Abonnement. |
| `ai.error.originRejected` | 261 | Diese Herkunft von HouseMD ist von der Bridge nicht zugelassen. |
| `ai.error.unauthorized` | 262 | API-Schlüssel fehlt oder ist ungültig. |
| `ai.error.forbidden` | 263 | Zugriff verweigert. |
| `ai.error.notFound` | 264 | Modell oder Endpunkt nicht gefunden. |
| `ai.error.noModel` | 265 | Wähle zuerst ein Modell. |
| `ai.error.rateLimited` | 266 | Anfragelimit erreicht. Warte, bevor du es erneut versuchst. |
| `ai.error.paramRejected` | 267 | Ein Parameter wurde abgelehnt. Entferne ihn unter Parameter und versuche es erneut. |
| `ai.error.tooLong` | 268 | Die Anfrage überschreitet das Kontextfenster. Verwende eine kleinere Auswahl oder kleinere Teile. |
| `ai.error.refused` | 269 | Das Modell hat die Anfrage abgelehnt. |
| `ai.error.truncated` | 270 | Ausgabelimit erreicht. |
| `ai.error.timeout` | 271 | Zeitlimit der Anfrage überschritten. |
| `ai.error.server` | 272 | Vorgang fehlgeschlagen. Versuche es erneut oder prüfe die Konfiguration. |
| `ai.error.badStream` | 273 | Der Server hat einen ungültigen Datenstrom zurückgegeben. |
| `ai.error.aborted` | 274 | Unterbrochen. |
| `ai.error.syncInvalid` | 275 | Ungültige Synchronisationsdatei: unverändert belassen. |
| `ai.error.syncPermission` | 276 | Zugriffsberechtigung für den Synchronisationsordner erforderlich. |
| `ai.error.syncBackupFailed` | 277 | Sicherung fehlgeschlagen; die Synchronisationsdatei wurde nicht geändert. |
| `ai.error.syncWriteFailed` | 278 | Schreiben oder Überprüfen der Synchronisation fehlgeschlagen. |
| `ai.error.syncLocked` | 279 | Synchronisationsdatei ist belegt. Versuche es später erneut. |
| `ai.error.syncStale` | 280 | Gleichzeitige Änderungen erkannt. Wiederhole die Synchronisation. |
| `ai.error.aiPendingUpdate` | 281 | Übernimm oder verwirf die KI-Vorschläge oder stoppe die Anfrage vor dem Aktualisieren. |

#### en

| Chiave | Riga in `src/i18n/locales/en.json` | Testo |
| --- | --- | --- |
| `toast.close` | 65 | Close |
| `update.apply` | 116 | Update |
| `update.dismiss` | 117 | Later |
| `update.applying` | 118 | Updating HouseMD: saving your document, then the page reloads |
| `toast.saveFailed` | 119 | Save failed: {detail} |
| `toast.configInvalidJson` | 120 | {file} is not valid: {detail} |
| `toast.configInvalidSaveTo` | 121 | {file}: images.saveTo must be a path |
| `toast.configInvalidLinkPrefix` | 122 | {file}: images.linkPrefix must start with "/" |
| `toast.restoredDraft` | 123 | Restored the unsaved changes of {path} |
| `toast.restoredDraftDeleted` | 124 | Restored the unsaved changes of {path} (the file no longer exists on disk) |
| `toast.deletedOutside` | 125 | {path} was deleted outside HouseMD |
| `toast.unreadableFiles` | 126 | Could not read {count} files: {paths} |
| `toast.alreadyExists` | 127 | Already exists: {path} |
| `toast.notFound` | 128 | Not found: {path} |
| `toast.operationFailed` | 129 | Operation failed: {detail} |
| `toast.saveAllSkipped` | 130 | {count} changes not saved: their file changed or was deleted on disk, or could not be written. Open them to resolve. |
| `toast.saveAllDone` | 131 | All changes saved |
| `toast.draftNotPersisted` | 132 | Could not secure your changes: save the file or copy the text |
| `toast.bufferFailed` | 133 | Could not write the emergency copy: {detail} |
| `toast.historyFailed` | 134 | Local history is unavailable: {detail} |
| `toast.restoreCancelled` | 135 | Restore cancelled: the document changed in the meantime |
| `toast.newVersion` | 136 | A new version of HouseMD is available |
| `toast.reloadOtherTabs` | 137 | HouseMD is open in another tab with an older version: save and close that tab to continue |
| `toast.openFolderFailed` | 138 | Could not open the folder: {detail} |
| `ai.error.unreachable` | 255 | Cannot reach the server. Check CORS, server availability and Chrome local-network permission. |
| `ai.error.bridgeDown` | 256 | Bridge unavailable. Start npm run bridge. |
| `ai.error.bridgeIncompatible` | 257 | This is not a compatible, protected HouseMD bridge. No document was sent. |
| `ai.error.secretBinding` | 258 | The key belongs to a different provider or endpoint. Enter it again to confirm this endpoint. |
| `ai.error.scopeLost` | 259 | The selection changed. Select it again and retry. |
| `ai.error.bridgeCli` | 260 | Claude CLI failed. Check installation and subscription login. |
| `ai.error.originRejected` | 261 | This HouseMD origin is not allowed by the bridge. |
| `ai.error.unauthorized` | 262 | Missing or invalid API key. |
| `ai.error.forbidden` | 263 | Access denied. |
| `ai.error.notFound` | 264 | Model or endpoint not found. |
| `ai.error.noModel` | 265 | Select a model first. |
| `ai.error.rateLimited` | 266 | Rate limited. Wait before retrying. |
| `ai.error.paramRejected` | 267 | A parameter was rejected. Remove it in Parameters and retry. |
| `ai.error.tooLong` | 268 | The request exceeds the context window. Use a smaller selection or smaller parts. |
| `ai.error.refused` | 269 | The model refused the request. |
| `ai.error.truncated` | 270 | Output limit reached. |
| `ai.error.timeout` | 271 | The request timed out. |
| `ai.error.server` | 272 | The operation failed. Retry or check configuration. |
| `ai.error.badStream` | 273 | The server returned an invalid stream. |
| `ai.error.aborted` | 274 | Interrupted. |
| `ai.error.syncInvalid` | 275 | Invalid sync file: left unchanged. |
| `ai.error.syncPermission` | 276 | Sync folder permission is required. |
| `ai.error.syncBackupFailed` | 277 | Backup failed; the sync file was not changed. |
| `ai.error.syncWriteFailed` | 278 | Sync write or verification failed. |
| `ai.error.syncLocked` | 279 | Sync file is busy. Retry later. |
| `ai.error.syncStale` | 280 | Concurrent changes detected. Retry sync. |
| `ai.error.aiPendingUpdate` | 281 | Accept or discard AI proposals, or stop the request, before updating. |

#### es

| Chiave | Riga in `src/i18n/locales/es.json` | Testo |
| --- | --- | --- |
| `toast.close` | 65 | Cerrar |
| `update.apply` | 116 | Actualizar |
| `update.dismiss` | 117 | Más tarde |
| `update.applying` | 118 | Actualizando HouseMD: se guarda tu documento y luego la página se recarga |
| `toast.saveFailed` | 119 | No se pudo guardar: {detail} |
| `toast.configInvalidJson` | 120 | {file} no es válido: {detail} |
| `toast.configInvalidSaveTo` | 121 | {file}: images.saveTo debe ser una ruta |
| `toast.configInvalidLinkPrefix` | 122 | {file}: images.linkPrefix debe empezar por "/" |
| `toast.restoredDraft` | 123 | Se restauraron los cambios sin guardar de {path} |
| `toast.restoredDraftDeleted` | 124 | Se restauraron los cambios sin guardar de {path} (el archivo ya no existe en el disco) |
| `toast.deletedOutside` | 125 | {path} se eliminó fuera de HouseMD |
| `toast.unreadableFiles` | 126 | No se pudieron leer {count} archivos: {paths} |
| `toast.alreadyExists` | 127 | Ya existe: {path} |
| `toast.notFound` | 128 | No encontrado: {path} |
| `toast.operationFailed` | 129 | La operación falló: {detail} |
| `toast.saveAllSkipped` | 130 | {count} cambios sin guardar: su archivo cambió o se eliminó en el disco, o no se pudo escribir. Ábrelos para resolverlo. |
| `toast.saveAllDone` | 131 | Todos los cambios guardados |
| `toast.draftNotPersisted` | 132 | No se pudieron poner a salvo tus cambios: guarda el archivo o copia el texto |
| `toast.bufferFailed` | 133 | No se pudo escribir la copia de emergencia: {detail} |
| `toast.historyFailed` | 134 | El historial local no está disponible: {detail} |
| `toast.restoreCancelled` | 135 | Restauración cancelada: el documento cambió mientras tanto |
| `toast.newVersion` | 136 | Hay una nueva versión de HouseMD disponible |
| `toast.reloadOtherTabs` | 137 | HouseMD está abierto en otra pestaña con una versión anterior: guarda y cierra esa pestaña para continuar |
| `toast.openFolderFailed` | 138 | No se pudo abrir la carpeta: {detail} |
| `ai.error.unreachable` | 255 | No se puede contactar con el servidor. Comprueba CORS, la disponibilidad del servidor y el permiso de red local de Chrome. |
| `ai.error.bridgeDown` | 256 | El puente no está disponible. Ejecuta npm run bridge. |
| `ai.error.bridgeIncompatible` | 257 | Este no es un puente de HouseMD compatible y protegido. No se ha enviado ningún documento. |
| `ai.error.secretBinding` | 258 | La clave pertenece a otro proveedor o endpoint. Introdúcela de nuevo para confirmar este endpoint. |
| `ai.error.scopeLost` | 259 | La selección ha cambiado. Selecciona de nuevo el texto y reinténtalo. |
| `ai.error.bridgeCli` | 260 | La CLI de Claude ha fallado. Comprueba la instalación y el inicio de sesión de la suscripción. |
| `ai.error.originRejected` | 261 | El puente no permite este origen de HouseMD. |
| `ai.error.unauthorized` | 262 | Falta la clave API o no es válida. |
| `ai.error.forbidden` | 263 | Acceso denegado. |
| `ai.error.notFound` | 264 | No se ha encontrado el modelo o endpoint. |
| `ai.error.noModel` | 265 | Selecciona primero un modelo. |
| `ai.error.rateLimited` | 266 | Se ha alcanzado el límite de solicitudes. Espera antes de reintentarlo. |
| `ai.error.paramRejected` | 267 | Se ha rechazado un parámetro. Elimínalo en Parámetros y reinténtalo. |
| `ai.error.tooLong` | 268 | La petición supera la ventana de contexto. Usa una selección o partes más pequeñas. |
| `ai.error.refused` | 269 | El modelo ha rechazado la petición. |
| `ai.error.truncated` | 270 | Se ha alcanzado el límite de salida. |
| `ai.error.timeout` | 271 | Se ha agotado el tiempo de la petición. |
| `ai.error.server` | 272 | La operación ha fallado. Reinténtalo o comprueba la configuración. |
| `ai.error.badStream` | 273 | El servidor ha devuelto un flujo no válido. |
| `ai.error.aborted` | 274 | Interrumpida. |
| `ai.error.syncInvalid` | 275 | Archivo de sincronización no válido: se ha dejado intacto. |
| `ai.error.syncPermission` | 276 | Se necesita permiso de acceso a la carpeta de sincronización. |
| `ai.error.syncBackupFailed` | 277 | La copia de seguridad ha fallado; el archivo de sincronización no se ha modificado. |
| `ai.error.syncWriteFailed` | 278 | Ha fallado la escritura o verificación de la sincronización. |
| `ai.error.syncLocked` | 279 | El archivo de sincronización está ocupado. Reinténtalo más tarde. |
| `ai.error.syncStale` | 280 | Se han detectado cambios simultáneos. Reintenta la sincronización. |
| `ai.error.aiPendingUpdate` | 281 | Acepta o descarta las propuestas de la IA, o detén la petición, antes de actualizar. |

#### fr

| Chiave | Riga in `src/i18n/locales/fr.json` | Testo |
| --- | --- | --- |
| `toast.close` | 65 | Fermer |
| `update.apply` | 116 | Mettre à jour |
| `update.dismiss` | 117 | Plus tard |
| `update.applying` | 118 | Mise à jour de HouseMD : votre document est enregistré, puis la page se recharge |
| `toast.saveFailed` | 119 | Échec de l’enregistrement : {detail} |
| `toast.configInvalidJson` | 120 | {file} n’est pas valide : {detail} |
| `toast.configInvalidSaveTo` | 121 | {file} : images.saveTo doit être un chemin |
| `toast.configInvalidLinkPrefix` | 122 | {file} : images.linkPrefix doit commencer par "/" |
| `toast.restoredDraft` | 123 | Modifications non enregistrées de {path} restaurées |
| `toast.restoredDraftDeleted` | 124 | Modifications non enregistrées de {path} restaurées (le fichier n’existe plus sur le disque) |
| `toast.deletedOutside` | 125 | {path} a été supprimé en dehors de HouseMD |
| `toast.unreadableFiles` | 126 | Impossible de lire {count} fichiers : {paths} |
| `toast.alreadyExists` | 127 | Existe déjà : {path} |
| `toast.notFound` | 128 | Introuvable : {path} |
| `toast.operationFailed` | 129 | Échec de l’opération : {detail} |
| `toast.saveAllSkipped` | 130 | {count} modifications non enregistrées : leur fichier a changé ou a été supprimé sur le disque, ou n’a pas pu être écrit. Ouvrez-les pour résoudre le problème. |
| `toast.saveAllDone` | 131 | Toutes les modifications sont enregistrées |
| `toast.draftNotPersisted` | 132 | Impossible de mettre vos modifications en sécurité : enregistrez le fichier ou copiez le texte |
| `toast.bufferFailed` | 133 | Impossible d’écrire la copie de secours : {detail} |
| `toast.historyFailed` | 134 | L’historique local n’est pas disponible : {detail} |
| `toast.restoreCancelled` | 135 | Restauration annulée : le document a changé entre-temps |
| `toast.newVersion` | 136 | Une nouvelle version de HouseMD est disponible |
| `toast.reloadOtherTabs` | 137 | HouseMD est ouvert dans un autre onglet avec une version plus ancienne : enregistrez et fermez cet onglet pour continuer |
| `toast.openFolderFailed` | 138 | Impossible d’ouvrir le dossier : {detail} |
| `ai.error.unreachable` | 255 | Impossible de joindre le serveur. Vérifiez CORS, la disponibilité du serveur et l'autorisation d'accès au réseau local de Chrome. |
| `ai.error.bridgeDown` | 256 | Passerelle indisponible. Lancez npm run bridge. |
| `ai.error.bridgeIncompatible` | 257 | Cette passerelle HouseMD n'est pas compatible et protégée. Aucun document n'a été envoyé. |
| `ai.error.secretBinding` | 258 | La clé appartient à un autre fournisseur ou point d'accès. Saisissez-la à nouveau pour confirmer ce point d'accès. |
| `ai.error.scopeLost` | 259 | La sélection a changé. Sélectionnez à nouveau le texte et réessayez. |
| `ai.error.bridgeCli` | 260 | La CLI Claude a échoué. Vérifiez l'installation et la connexion à l'abonnement. |
| `ai.error.originRejected` | 261 | Cette origine de HouseMD n'est pas autorisée par la passerelle. |
| `ai.error.unauthorized` | 262 | Clé API absente ou non valide. |
| `ai.error.forbidden` | 263 | Accès refusé. |
| `ai.error.notFound` | 264 | Modèle ou point d'accès introuvable. |
| `ai.error.noModel` | 265 | Choisissez d'abord un modèle. |
| `ai.error.rateLimited` | 266 | Limite de requêtes atteinte. Patientez avant de réessayer. |
| `ai.error.paramRejected` | 267 | Un paramètre a été refusé. Supprimez-le dans Paramètres et réessayez. |
| `ai.error.tooLong` | 268 | La demande dépasse la fenêtre de contexte. Utilisez une sélection ou des parties plus petites. |
| `ai.error.refused` | 269 | Le modèle a refusé la demande. |
| `ai.error.truncated` | 270 | Limite de sortie atteinte. |
| `ai.error.timeout` | 271 | Le délai de la demande a expiré. |
| `ai.error.server` | 272 | L'opération a échoué. Réessayez ou vérifiez la configuration. |
| `ai.error.badStream` | 273 | Le serveur a renvoyé un flux non valide. |
| `ai.error.aborted` | 274 | Interrompue. |
| `ai.error.syncInvalid` | 275 | Fichier de synchronisation non valide : laissé inchangé. |
| `ai.error.syncPermission` | 276 | L'autorisation d'accès au dossier de synchronisation est requise. |
| `ai.error.syncBackupFailed` | 277 | La sauvegarde a échoué ; le fichier de synchronisation n'a pas été modifié. |
| `ai.error.syncWriteFailed` | 278 | L'écriture ou la vérification de la synchronisation a échoué. |
| `ai.error.syncLocked` | 279 | Le fichier de synchronisation est occupé. Réessayez plus tard. |
| `ai.error.syncStale` | 280 | Modifications simultanées détectées. Relancez la synchronisation. |
| `ai.error.aiPendingUpdate` | 281 | Acceptez ou rejetez les propositions de l'IA, ou arrêtez la demande, avant de mettre à jour. |

#### it

| Chiave | Riga in `src/i18n/locales/it.json` | Testo |
| --- | --- | --- |
| `toast.close` | 65 | Chiudi |
| `update.apply` | 116 | Aggiorna |
| `update.dismiss` | 117 | Più tardi |
| `update.applying` | 118 | Aggiornamento di HouseMD in corso: si salva il documento, poi la pagina si ricarica |
| `toast.saveFailed` | 119 | Salvataggio non riuscito: {detail} |
| `toast.configInvalidJson` | 120 | {file} non valido: {detail} |
| `toast.configInvalidSaveTo` | 121 | {file}: images.saveTo deve essere un percorso |
| `toast.configInvalidLinkPrefix` | 122 | {file}: images.linkPrefix deve iniziare con "/" |
| `toast.restoredDraft` | 123 | Ripristinate le modifiche non salvate di {path} |
| `toast.restoredDraftDeleted` | 124 | Ripristinate le modifiche non salvate di {path} (il file non esiste più su disco) |
| `toast.deletedOutside` | 125 | {path} è stato eliminato fuori da HouseMD |
| `toast.unreadableFiles` | 126 | Impossibile leggere {count} file: {paths} |
| `toast.alreadyExists` | 127 | Esiste già: {path} |
| `toast.notFound` | 128 | Non trovato: {path} |
| `toast.operationFailed` | 129 | Operazione non riuscita: {detail} |
| `toast.saveAllSkipped` | 130 | {count} modifiche non salvate: il loro file è cambiato o è stato eliminato su disco, oppure non si è potuto scrivere. Aprile per risolvere. |
| `toast.saveAllDone` | 131 | Tutte le modifiche sono salvate |
| `toast.draftNotPersisted` | 132 | Impossibile mettere al sicuro le modifiche: salva il file o copia il testo |
| `toast.bufferFailed` | 133 | Impossibile scrivere la copia di emergenza: {detail} |
| `toast.historyFailed` | 134 | Cronologia locale non disponibile: {detail} |
| `toast.restoreCancelled` | 135 | Ripristino annullato: il documento è cambiato nel frattempo |
| `toast.newVersion` | 136 | È disponibile una nuova versione di HouseMD |
| `toast.reloadOtherTabs` | 137 | HouseMD è aperto in un'altra scheda con una versione precedente: salva e chiudi quella scheda per continuare |
| `toast.openFolderFailed` | 138 | Impossibile aprire la cartella: {detail} |
| `ai.error.unreachable` | 255 | Impossibile raggiungere il server. Controlla CORS, disponibilità del server e permesso di accesso alla rete locale in Chrome. |
| `ai.error.bridgeDown` | 256 | Bridge non disponibile. Avvia npm run bridge. |
| `ai.error.bridgeIncompatible` | 257 | Questo non è un bridge HouseMD compatibile e protetto. Nessun documento è stato inviato. |
| `ai.error.secretBinding` | 258 | La chiave appartiene a un altro provider o endpoint. Inseriscila di nuovo per confermare questo endpoint. |
| `ai.error.scopeLost` | 259 | La selezione è cambiata. Seleziona di nuovo il testo e riprova. |
| `ai.error.bridgeCli` | 260 | La CLI di Claude ha restituito un errore. Controlla l'installazione e l'accesso con l'abbonamento. |
| `ai.error.originRejected` | 261 | Questa origine di HouseMD non è consentita dal bridge. |
| `ai.error.unauthorized` | 262 | Chiave API mancante o non valida. |
| `ai.error.forbidden` | 263 | Accesso negato. |
| `ai.error.notFound` | 264 | Modello o endpoint non trovato. |
| `ai.error.noModel` | 265 | Scegli prima un modello. |
| `ai.error.rateLimited` | 266 | Limite di richieste raggiunto. Attendi prima di riprovare. |
| `ai.error.paramRejected` | 267 | Un parametro è stato rifiutato. Rimuovilo in Parametri e riprova. |
| `ai.error.tooLong` | 268 | La richiesta supera la finestra di contesto. Usa una selezione o parti più piccole. |
| `ai.error.refused` | 269 | Il modello ha rifiutato la richiesta. |
| `ai.error.truncated` | 270 | Limite di uscita raggiunto. |
| `ai.error.timeout` | 271 | Tempo della richiesta scaduto. |
| `ai.error.server` | 272 | Operazione non riuscita. Riprova o controlla la configurazione. |
| `ai.error.badStream` | 273 | Il server ha restituito un flusso non valido. |
| `ai.error.aborted` | 274 | Interrotta. |
| `ai.error.syncInvalid` | 275 | File di sincronizzazione non valido: lasciato invariato. |
| `ai.error.syncPermission` | 276 | È necessario il permesso di accesso alla cartella di sincronizzazione. |
| `ai.error.syncBackupFailed` | 277 | Backup non riuscito: il file di sincronizzazione non è stato modificato. |
| `ai.error.syncWriteFailed` | 278 | Scrittura o verifica della sincronizzazione non riuscita. |
| `ai.error.syncLocked` | 279 | Il file di sincronizzazione è occupato. Riprova più tardi. |
| `ai.error.syncStale` | 280 | Rilevate modifiche concorrenti. Riprova la sincronizzazione. |
| `ai.error.aiPendingUpdate` | 281 | Accetta o scarta le proposte AI, oppure ferma la richiesta, prima di aggiornare. |

#### ja

| Chiave | Riga in `src/i18n/locales/ja.json` | Testo |
| --- | --- | --- |
| `toast.close` | 65 | 閉じる |
| `update.apply` | 116 | 更新 |
| `update.dismiss` | 117 | 後で |
| `update.applying` | 118 | HouseMD を更新しています。ドキュメントを保存してからページを再読み込みします |
| `toast.saveFailed` | 119 | 保存に失敗しました：{detail} |
| `toast.configInvalidJson` | 120 | {file} が正しくありません：{detail} |
| `toast.configInvalidSaveTo` | 121 | {file}：images.saveTo にはパスを指定してください |
| `toast.configInvalidLinkPrefix` | 122 | {file}：images.linkPrefix は "/" で始めてください |
| `toast.restoredDraft` | 123 | {path} の未保存の変更を復元しました |
| `toast.restoredDraftDeleted` | 124 | {path} の未保存の変更を復元しました（ファイルはディスク上にもうありません） |
| `toast.deletedOutside` | 125 | {path} は HouseMD の外で削除されました |
| `toast.unreadableFiles` | 126 | {count} 個のファイルを読み込めませんでした：{paths} |
| `toast.alreadyExists` | 127 | すでに存在します：{path} |
| `toast.notFound` | 128 | 見つかりません：{path} |
| `toast.operationFailed` | 129 | 操作に失敗しました：{detail} |
| `toast.saveAllSkipped` | 130 | {count} 件の変更を保存できませんでした。ディスク上でファイルが変更・削除されたか、書き込めませんでした。開いて解決してください。 |
| `toast.saveAllDone` | 131 | すべての変更を保存しました |
| `toast.draftNotPersisted` | 132 | 変更を安全に保管できませんでした。ファイルを保存するか、テキストをコピーしてください |
| `toast.bufferFailed` | 133 | 緊急用のコピーを書き込めませんでした：{detail} |
| `toast.historyFailed` | 134 | ローカル履歴を利用できません：{detail} |
| `toast.restoreCancelled` | 135 | ドキュメントが変更されたため、復元を中止しました |
| `toast.newVersion` | 136 | HouseMD の新しいバージョンがあります |
| `toast.reloadOtherTabs` | 137 | HouseMD が別のタブで古いバージョンのまま開かれています。続行するには、そのタブで保存してから閉じてください |
| `toast.openFolderFailed` | 138 | フォルダーを開けませんでした：{detail} |
| `ai.error.unreachable` | 255 | サーバーに接続できません。CORS、サーバーの稼働状況、Chrome のローカルネットワークのアクセス許可を確認してください。 |
| `ai.error.bridgeDown` | 256 | ブリッジを利用できません。npm run bridge を実行してください。 |
| `ai.error.bridgeIncompatible` | 257 | 互換性と保護機能を備えた HouseMD ブリッジではありません。ドキュメントは送信されていません。 |
| `ai.error.secretBinding` | 258 | このキーは別のプロバイダーまたはエンドポイント用です。このエンドポイントを確認するため、キーを再入力してください。 |
| `ai.error.scopeLost` | 259 | 選択範囲が変更されました。もう一度選択して再試行してください。 |
| `ai.error.bridgeCli` | 260 | Claude CLI でエラーが発生しました。インストール状況とサブスクリプションへのログインを確認してください。 |
| `ai.error.originRejected` | 261 | この HouseMD のオリジンはブリッジで許可されていません。 |
| `ai.error.unauthorized` | 262 | API キーがないか、無効です。 |
| `ai.error.forbidden` | 263 | アクセスが拒否されました。 |
| `ai.error.notFound` | 264 | モデルまたはエンドポイントが見つかりません。 |
| `ai.error.noModel` | 265 | 先にモデルを選択してください。 |
| `ai.error.rateLimited` | 266 | リクエストの上限に達しました。しばらく待ってから再試行してください。 |
| `ai.error.paramRejected` | 267 | パラメーターが拒否されました。「パラメーター」で削除して再試行してください。 |
| `ai.error.tooLong` | 268 | リクエストがコンテキストウィンドウを超えています。選択範囲または分割サイズを小さくしてください。 |
| `ai.error.refused` | 269 | モデルがリクエストを拒否しました。 |
| `ai.error.truncated` | 270 | 出力上限に達しました。 |
| `ai.error.timeout` | 271 | リクエストがタイムアウトしました。 |
| `ai.error.server` | 272 | 操作に失敗しました。再試行するか、設定を確認してください。 |
| `ai.error.badStream` | 273 | サーバーから無効なストリームが返されました。 |
| `ai.error.aborted` | 274 | 中断しました。 |
| `ai.error.syncInvalid` | 275 | 同期ファイルが無効です。変更せずに残しました。 |
| `ai.error.syncPermission` | 276 | 同期フォルダーへのアクセス許可が必要です。 |
| `ai.error.syncBackupFailed` | 277 | バックアップに失敗しました。同期ファイルは変更されていません。 |
| `ai.error.syncWriteFailed` | 278 | 同期の書き込みまたは検証に失敗しました。 |
| `ai.error.syncLocked` | 279 | 同期ファイルは使用中です。後でもう一度試してください。 |
| `ai.error.syncStale` | 280 | 同時変更が検出されました。同期を再試行してください。 |
| `ai.error.aiPendingUpdate` | 281 | 更新する前に、AI の提案を採用または破棄するか、リクエストを停止してください。 |

#### nl

| Chiave | Riga in `src/i18n/locales/nl.json` | Testo |
| --- | --- | --- |
| `toast.close` | 65 | Sluiten |
| `update.apply` | 116 | Bijwerken |
| `update.dismiss` | 117 | Later |
| `update.applying` | 118 | HouseMD wordt bijgewerkt: je document wordt opgeslagen, daarna wordt de pagina herladen |
| `toast.saveFailed` | 119 | Opslaan mislukt: {detail} |
| `toast.configInvalidJson` | 120 | {file} is ongeldig: {detail} |
| `toast.configInvalidSaveTo` | 121 | {file}: images.saveTo moet een pad zijn |
| `toast.configInvalidLinkPrefix` | 122 | {file}: images.linkPrefix moet met "/" beginnen |
| `toast.restoredDraft` | 123 | Niet-opgeslagen wijzigingen van {path} hersteld |
| `toast.restoredDraftDeleted` | 124 | Niet-opgeslagen wijzigingen van {path} hersteld (het bestand bestaat niet meer op schijf) |
| `toast.deletedOutside` | 125 | {path} is buiten HouseMD verwijderd |
| `toast.unreadableFiles` | 126 | Kan {count} bestanden niet lezen: {paths} |
| `toast.alreadyExists` | 127 | Bestaat al: {path} |
| `toast.notFound` | 128 | Niet gevonden: {path} |
| `toast.operationFailed` | 129 | Bewerking mislukt: {detail} |
| `toast.saveAllSkipped` | 130 | {count} wijzigingen niet opgeslagen: hun bestand is op schijf gewijzigd of verwijderd, of kon niet worden geschreven. Open ze om dit op te lossen. |
| `toast.saveAllDone` | 131 | Alle wijzigingen opgeslagen |
| `toast.draftNotPersisted` | 132 | Kan je wijzigingen niet veiligstellen: sla het bestand op of kopieer de tekst |
| `toast.bufferFailed` | 133 | Kan de noodkopie niet schrijven: {detail} |
| `toast.historyFailed` | 134 | Lokale geschiedenis is niet beschikbaar: {detail} |
| `toast.restoreCancelled` | 135 | Herstel geannuleerd: het document is intussen gewijzigd |
| `toast.newVersion` | 136 | Er is een nieuwe versie van HouseMD beschikbaar |
| `toast.reloadOtherTabs` | 137 | HouseMD is geopend in een ander tabblad met een oudere versie: sla op en sluit dat tabblad om door te gaan |
| `toast.openFolderFailed` | 138 | Kan de map niet openen: {detail} |
| `ai.error.unreachable` | 255 | De server is niet bereikbaar. Controleer CORS, de beschikbaarheid van de server en de toestemming voor het lokale netwerk in Chrome. |
| `ai.error.bridgeDown` | 256 | Bridge niet beschikbaar. Start npm run bridge. |
| `ai.error.bridgeIncompatible` | 257 | Dit is geen compatibele, beveiligde HouseMD-bridge. Er is geen document verzonden. |
| `ai.error.secretBinding` | 258 | De sleutel hoort bij een andere aanbieder of een ander endpoint. Voer deze opnieuw in om dit endpoint te bevestigen. |
| `ai.error.scopeLost` | 259 | De selectie is gewijzigd. Selecteer de tekst opnieuw en probeer het nogmaals. |
| `ai.error.bridgeCli` | 260 | Claude CLI is mislukt. Controleer de installatie en de aanmelding voor het abonnement. |
| `ai.error.originRejected` | 261 | Deze oorsprong van HouseMD is niet toegestaan door de bridge. |
| `ai.error.unauthorized` | 262 | API-sleutel ontbreekt of is ongeldig. |
| `ai.error.forbidden` | 263 | Toegang geweigerd. |
| `ai.error.notFound` | 264 | Model of endpoint niet gevonden. |
| `ai.error.noModel` | 265 | Selecteer eerst een model. |
| `ai.error.rateLimited` | 266 | Verzoeklimiet bereikt. Wacht voordat je het opnieuw probeert. |
| `ai.error.paramRejected` | 267 | Een parameter is geweigerd. Verwijder deze bij Parameters en probeer het opnieuw. |
| `ai.error.tooLong` | 268 | Het verzoek overschrijdt het contextvenster. Gebruik een kleinere selectie of kleinere delen. |
| `ai.error.refused` | 269 | Het model heeft het verzoek geweigerd. |
| `ai.error.truncated` | 270 | Uitvoerlimiet bereikt. |
| `ai.error.timeout` | 271 | Het verzoek heeft de tijdslimiet overschreden. |
| `ai.error.server` | 272 | De bewerking is mislukt. Probeer het opnieuw of controleer de configuratie. |
| `ai.error.badStream` | 273 | De server heeft een ongeldige gegevensstroom teruggegeven. |
| `ai.error.aborted` | 274 | Onderbroken. |
| `ai.error.syncInvalid` | 275 | Ongeldig synchronisatiebestand: ongewijzigd gelaten. |
| `ai.error.syncPermission` | 276 | Toestemming voor de synchronisatiemap is vereist. |
| `ai.error.syncBackupFailed` | 277 | Back-up mislukt; het synchronisatiebestand is niet gewijzigd. |
| `ai.error.syncWriteFailed` | 278 | Schrijven of controleren van de synchronisatie mislukt. |
| `ai.error.syncLocked` | 279 | Het synchronisatiebestand is in gebruik. Probeer het later opnieuw. |
| `ai.error.syncStale` | 280 | Gelijktijdige wijzigingen gevonden. Probeer opnieuw te synchroniseren. |
| `ai.error.aiPendingUpdate` | 281 | Accepteer of verwerp de AI-voorstellen of stop het verzoek voordat je bijwerkt. |

#### pl

| Chiave | Riga in `src/i18n/locales/pl.json` | Testo |
| --- | --- | --- |
| `toast.close` | 65 | Zamknij |
| `update.apply` | 116 | Aktualizuj |
| `update.dismiss` | 117 | Później |
| `update.applying` | 118 | Aktualizacja HouseMD: dokument jest zapisywany, a potem strona się przeładuje |
| `toast.saveFailed` | 119 | Zapisywanie nie powiodło się: {detail} |
| `toast.configInvalidJson` | 120 | Plik {file} jest nieprawidłowy: {detail} |
| `toast.configInvalidSaveTo` | 121 | {file}: images.saveTo musi być ścieżką |
| `toast.configInvalidLinkPrefix` | 122 | {file}: images.linkPrefix musi zaczynać się od "/" |
| `toast.restoredDraft` | 123 | Przywrócono niezapisane zmiany pliku {path} |
| `toast.restoredDraftDeleted` | 124 | Przywrócono niezapisane zmiany pliku {path} (plik nie istnieje już na dysku) |
| `toast.deletedOutside` | 125 | Plik {path} został usunięty poza HouseMD |
| `toast.unreadableFiles` | 126 | Nie można odczytać plików ({count}): {paths} |
| `toast.alreadyExists` | 127 | Już istnieje: {path} |
| `toast.notFound` | 128 | Nie znaleziono: {path} |
| `toast.operationFailed` | 129 | Operacja nie powiodła się: {detail} |
| `toast.saveAllSkipped` | 130 | Niezapisane zmiany ({count}): ich plik zmienił się lub został usunięty na dysku albo nie dało się go zapisać. Otwórz je, aby to rozwiązać. |
| `toast.saveAllDone` | 131 | Wszystkie zmiany zapisane |
| `toast.draftNotPersisted` | 132 | Nie udało się zabezpieczyć zmian: zapisz plik lub skopiuj tekst |
| `toast.bufferFailed` | 133 | Nie można zapisać kopii awaryjnej: {detail} |
| `toast.historyFailed` | 134 | Lokalna historia jest niedostępna: {detail} |
| `toast.restoreCancelled` | 135 | Przywracanie anulowane: dokument zmienił się w międzyczasie |
| `toast.newVersion` | 136 | Dostępna jest nowa wersja HouseMD |
| `toast.reloadOtherTabs` | 137 | HouseMD jest otwarty w innej karcie ze starszą wersją: zapisz i zamknij tamtą kartę, aby kontynuować |
| `toast.openFolderFailed` | 138 | Nie można otworzyć folderu: {detail} |
| `ai.error.unreachable` | 255 | Nie można połączyć się z serwerem. Sprawdź CORS, dostępność serwera i uprawnienia Chrome do sieci lokalnej. |
| `ai.error.bridgeDown` | 256 | Most jest niedostępny. Uruchom npm run bridge. |
| `ai.error.bridgeIncompatible` | 257 | To nie jest zgodny, zabezpieczony most HouseMD. Nie wysłano żadnego dokumentu. |
| `ai.error.secretBinding` | 258 | Klucz należy do innego dostawcy lub punktu końcowego. Wprowadź go ponownie, aby potwierdzić ten punkt końcowy. |
| `ai.error.scopeLost` | 259 | Zaznaczenie się zmieniło. Zaznacz tekst ponownie i spróbuj jeszcze raz. |
| `ai.error.bridgeCli` | 260 | Wystąpił błąd CLI Claude. Sprawdź instalację i logowanie do subskrypcji. |
| `ai.error.originRejected` | 261 | Most nie zezwala na to źródło HouseMD. |
| `ai.error.unauthorized` | 262 | Brak klucza API lub klucz jest nieprawidłowy. |
| `ai.error.forbidden` | 263 | Odmowa dostępu. |
| `ai.error.notFound` | 264 | Nie znaleziono modelu lub punktu końcowego. |
| `ai.error.noModel` | 265 | Najpierw wybierz model. |
| `ai.error.rateLimited` | 266 | Osiągnięto limit żądań. Poczekaj przed ponowną próbą. |
| `ai.error.paramRejected` | 267 | Odrzucono parametr. Usuń go w sekcji Parametry i spróbuj ponownie. |
| `ai.error.tooLong` | 268 | Żądanie przekracza okno kontekstu. Użyj mniejszego zaznaczenia lub mniejszych części. |
| `ai.error.refused` | 269 | Model odrzucił żądanie. |
| `ai.error.truncated` | 270 | Osiągnięto limit wyjścia. |
| `ai.error.timeout` | 271 | Przekroczono limit czasu żądania. |
| `ai.error.server` | 272 | Operacja nie powiodła się. Spróbuj ponownie lub sprawdź konfigurację. |
| `ai.error.badStream` | 273 | Serwer zwrócił nieprawidłowy strumień danych. |
| `ai.error.aborted` | 274 | Przerwano. |
| `ai.error.syncInvalid` | 275 | Nieprawidłowy plik synchronizacji: pozostawiono bez zmian. |
| `ai.error.syncPermission` | 276 | Wymagane są uprawnienia dostępu do folderu synchronizacji. |
| `ai.error.syncBackupFailed` | 277 | Tworzenie kopii zapasowej nie powiodło się; plik synchronizacji nie został zmieniony. |
| `ai.error.syncWriteFailed` | 278 | Zapis lub weryfikacja synchronizacji nie powiodły się. |
| `ai.error.syncLocked` | 279 | Plik synchronizacji jest zajęty. Spróbuj ponownie później. |
| `ai.error.syncStale` | 280 | Wykryto równoczesne zmiany. Ponów synchronizację. |
| `ai.error.aiPendingUpdate` | 281 | Przed aktualizacją zaakceptuj lub odrzuć propozycje AI albo zatrzymaj żądanie. |

#### pt

| Chiave | Riga in `src/i18n/locales/pt.json` | Testo |
| --- | --- | --- |
| `toast.close` | 65 | Fechar |
| `update.apply` | 116 | Atualizar |
| `update.dismiss` | 117 | Mais tarde |
| `update.applying` | 118 | A atualizar o HouseMD: o seu documento é guardado e depois a página recarrega |
| `toast.saveFailed` | 119 | Falha ao guardar: {detail} |
| `toast.configInvalidJson` | 120 | {file} não é válido: {detail} |
| `toast.configInvalidSaveTo` | 121 | {file}: images.saveTo tem de ser um caminho |
| `toast.configInvalidLinkPrefix` | 122 | {file}: images.linkPrefix tem de começar por "/" |
| `toast.restoredDraft` | 123 | Alterações não guardadas de {path} restauradas |
| `toast.restoredDraftDeleted` | 124 | Alterações não guardadas de {path} restauradas (o ficheiro já não existe no disco) |
| `toast.deletedOutside` | 125 | {path} foi eliminado fora do HouseMD |
| `toast.unreadableFiles` | 126 | Não foi possível ler {count} ficheiros: {paths} |
| `toast.alreadyExists` | 127 | Já existe: {path} |
| `toast.notFound` | 128 | Não encontrado: {path} |
| `toast.operationFailed` | 129 | A operação falhou: {detail} |
| `toast.saveAllSkipped` | 130 | {count} alterações não guardadas: o respetivo ficheiro foi alterado ou eliminado no disco, ou não foi possível escrevê-lo. Abra-as para resolver. |
| `toast.saveAllDone` | 131 | Todas as alterações foram guardadas |
| `toast.draftNotPersisted` | 132 | Não foi possível proteger as suas alterações: guarde o ficheiro ou copie o texto |
| `toast.bufferFailed` | 133 | Não foi possível escrever a cópia de emergência: {detail} |
| `toast.historyFailed` | 134 | O histórico local não está disponível: {detail} |
| `toast.restoreCancelled` | 135 | Restauro cancelado: o documento foi alterado entretanto |
| `toast.newVersion` | 136 | Está disponível uma nova versão do HouseMD |
| `toast.reloadOtherTabs` | 137 | O HouseMD está aberto noutro separador com uma versão anterior: guarde e feche esse separador para continuar |
| `toast.openFolderFailed` | 138 | Não foi possível abrir a pasta: {detail} |
| `ai.error.unreachable` | 255 | Não é possível contactar o servidor. Verifique CORS, a disponibilidade do servidor e a permissão de rede local do Chrome. |
| `ai.error.bridgeDown` | 256 | Ponte indisponível. Execute npm run bridge. |
| `ai.error.bridgeIncompatible` | 257 | Esta não é uma ponte HouseMD compatível e protegida. Nenhum documento foi enviado. |
| `ai.error.secretBinding` | 258 | A chave pertence a outro fornecedor ou endpoint. Introduza-a novamente para confirmar este endpoint. |
| `ai.error.scopeLost` | 259 | A seleção foi alterada. Selecione novamente o texto e volte a tentar. |
| `ai.error.bridgeCli` | 260 | A CLI do Claude falhou. Verifique a instalação e o início de sessão da subscrição. |
| `ai.error.originRejected` | 261 | Esta origem do HouseMD não é permitida pela ponte. |
| `ai.error.unauthorized` | 262 | Chave API em falta ou inválida. |
| `ai.error.forbidden` | 263 | Acesso negado. |
| `ai.error.notFound` | 264 | Modelo ou endpoint não encontrado. |
| `ai.error.noModel` | 265 | Selecione primeiro um modelo. |
| `ai.error.rateLimited` | 266 | Limite de pedidos atingido. Aguarde antes de voltar a tentar. |
| `ai.error.paramRejected` | 267 | Um parâmetro foi rejeitado. Remova-o em Parâmetros e volte a tentar. |
| `ai.error.tooLong` | 268 | O pedido excede a janela de contexto. Use uma seleção ou partes mais pequenas. |
| `ai.error.refused` | 269 | O modelo recusou o pedido. |
| `ai.error.truncated` | 270 | Limite de saída atingido. |
| `ai.error.timeout` | 271 | O pedido excedeu o tempo limite. |
| `ai.error.server` | 272 | A operação falhou. Volte a tentar ou verifique a configuração. |
| `ai.error.badStream` | 273 | O servidor devolveu um fluxo inválido. |
| `ai.error.aborted` | 274 | Interrompida. |
| `ai.error.syncInvalid` | 275 | Ficheiro de sincronização inválido: deixado inalterado. |
| `ai.error.syncPermission` | 276 | É necessária permissão de acesso à pasta de sincronização. |
| `ai.error.syncBackupFailed` | 277 | A cópia de segurança falhou; o ficheiro de sincronização não foi alterado. |
| `ai.error.syncWriteFailed` | 278 | Falha na escrita ou verificação da sincronização. |
| `ai.error.syncLocked` | 279 | O ficheiro de sincronização está ocupado. Tente novamente mais tarde. |
| `ai.error.syncStale` | 280 | Foram detetadas alterações simultâneas. Repita a sincronização. |
| `ai.error.aiPendingUpdate` | 281 | Aceite ou descarte as propostas da IA, ou pare o pedido, antes de atualizar. |
