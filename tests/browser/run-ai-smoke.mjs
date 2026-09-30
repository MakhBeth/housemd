/** Collaudo Chromium isolato: provider e filesystem finti, nessun account né API a pagamento. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const profile=await mkdtemp(join(tmpdir(),'housemd-browser-'));
const port=Number(process.env.HOUSEMD_TEST_PORT||5189),debug=Number(process.env.HOUSEMD_DEBUG_PORT||9341),origin=`http://127.0.0.1:${port}`;
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
const chrome=spawn(process.env.CHROMIUM_BIN||'chromium',['--headless','--no-sandbox','--disable-gpu',`--remote-debugging-port=${debug}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket;
try{
 let pages;
 for(let i=0;i<80;i++){try{pages=await(await fetch(`http://127.0.0.1:${debug}/json`)).json();await fetch(origin);break;}catch{await sleep(100);}}
 assert.ok(pages?.length,'Chromium e Vite disponibili');
 socket=new WebSocket((pages.find(p=>p.type==='page')||pages[0]).webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});let sequence=0;const pending=new Map(),errors=[],network=[];
 socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.description||a.value).join(' '));else if(m.method==='Network.requestWillBeSent')network.push(m.params.request.url);};
 const send=(method,params={})=>new Promise(resolve=>{const id=++sequence;pending.set(id,resolve);socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.equal(r.result?.exceptionDetails,undefined,JSON.stringify(r.result?.exceptionDetails));return r.result?.result?.value;};
 const until=async(expression)=>{for(let i=0;i<80;i++){if(await evaluate(expression))return;await sleep(50);}throw Error('Condizione non raggiunta: '+expression);};
 const click=async(text)=>{assert.ok(await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(text)});if(!b||b.disabled)return false;b.click();return true;})()`),'Pulsante disponibile: '+text);await sleep(150);};
 const press=async(label)=>{assert.ok(await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(label)});if(!b||b.disabled)return false;b.click();return true;})()`),'Pulsante disponibile: '+label);await sleep(150);};
 const composer="document.querySelector('textarea[aria-label^=\"Ask about this document\"]')";
 const request=async()=>{await evaluate(`(()=>{const t=${composer};Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'fix');t.dispatchEvent(new Event('input',{bubbles:true}));t.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));})()`);await until("[...document.querySelectorAll('button')].some(b=>b.textContent==='Accept all'&&!b.disabled)");};
 await send('Runtime.enable');await send('Network.enable');await send('Page.navigate',{url:origin+'/tests/browser/ai-smoke.html'});
 await until("!!document.querySelector('.cm-editor')");await until("[...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-label')==='AI')");await press('AI');await until(`!!${composer}`);await request();
 await click('Accept all');assert.equal(await evaluate('smoke.ws.getState().doc.text'),'# Changed\n\nNew paragraph.');
 await until("!document.querySelector('.cm-mergeView')");assert.equal(await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent==='Accept all')"),false,'Senza differenze la barra di revisione sparisce');
 await press('Editor');assert.equal(await evaluate("smoke.undo(smoke.EditorView.findFromDOM(document.querySelector('.cm-editor')))"),true);assert.equal(await evaluate('smoke.ws.getState().doc.text'),'# Original\n\nParagraph.');
 assert.equal(await evaluate("smoke.history.list('smoke','a.md').then(rows=>rows.filter(r=>r.reason==='before-ai').length)"),1);
 await press('AI');await until("!!document.querySelector('.cm-merge-revert button[data-action=accept]')");await evaluate("document.querySelector('.cm-merge-revert button[data-action=accept]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}))");assert.equal(await evaluate('smoke.ws.getState().doc.text'),'# Changed\n\nNew paragraph.');

 // Rifiuto per blocco: → rimette l'originale nella proposta; rifiutare l'ultimo blocco scarta la proposta.
 const mouse=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}))`);
 await until("!document.querySelector('.cm-mergeView')");
 await evaluate("(()=>{const view=smoke.EditorView.findFromDOM(document.querySelector('.cm-editor'));view.dispatch({changes:{from:0,to:view.state.doc.length,insert:'A\\n\\nB\\n\\nC'},selection:{anchor:0}});smoke.reply='A2\\n\\nB\\n\\nC2';})()");
 await sleep(100);await request();
 await until("document.querySelectorAll('.cm-merge-revert button[data-action=reject]').length===2");
 assert.equal(await evaluate("(()=>{const [a,b]=document.querySelectorAll('.cm-mergeView .cm-scroller');return getComputedStyle(a).fontFamily===getComputedStyle(b).fontFamily&&getComputedStyle(a).lineHeight===getComputedStyle(b).lineHeight;})()"),true,'Stesso carattere e interlinea nei due lati del diff');
 await mouse('.cm-merge-revert button[data-action=reject]');await sleep(150);
 assert.equal(await evaluate('smoke.ws.getState().doc.text'),'A\n\nB\n\nC','Rifiutare un blocco non tocca il documento');
 assert.equal(await evaluate("smoke.EditorView.findFromDOM([...document.querySelectorAll('.cm-editor')].at(-1)).state.doc.toString()"),'A\n\nB\n\nC2','Il blocco rifiutato torna come l\'originale nella proposta');
 await mouse('.cm-merge-revert button[data-action=reject]');
 await until("!document.querySelector('.cm-mergeView')");
 assert.equal(await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent==='Discard')"),false,'Tutti i blocchi rifiutati: proposta scartata e barra chiusa');
 assert.equal(await evaluate('smoke.ws.getState().doc.text'),'A\n\nB\n\nC');

 // Ctrl+Z vero (tastiera) dopo ←, → e Accetta tutto: annulla l'ultima azione di revisione.
 const ctrlZ=async()=>{for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'z',code:'KeyZ',windowsVirtualKeyCode:90,modifiers:2});await sleep(200);};
 const proposalText=()=>evaluate("smoke.EditorView.findFromDOM([...document.querySelectorAll('.cm-mergeView .cm-editor')].at(-1)).state.doc.toString()");
 await evaluate("smoke.reply='A2\\n\\nB\\n\\nC2'");
 await request();
 await until("document.querySelectorAll('.cm-merge-revert button[data-action=accept]').length===2");
 await mouse('.cm-merge-revert button[data-action=accept]');await sleep(150);
 assert.equal(await evaluate('smoke.ws.getState().doc.text'),'A2\n\nB\n\nC');
 await ctrlZ();
 assert.equal(await evaluate('smoke.ws.getState().doc.text'),'A\n\nB\n\nC','Ctrl+Z annulla l\'accettazione di un blocco');
 await until("document.querySelectorAll('.cm-merge-revert button[data-action=reject]').length===2");
 await mouse('.cm-merge-revert button[data-action=reject]');await sleep(150);
 assert.equal(await proposalText(),'A\n\nB\n\nC2');
 await ctrlZ();
 assert.equal(await proposalText(),'A2\n\nB\n\nC2','Ctrl+Z annulla il rifiuto di un blocco senza toccare il testo arrivato dal modello');
 await click('Accept all');
 await until("!document.querySelector('.cm-mergeView')");
 await ctrlZ();
 assert.equal(await evaluate('smoke.ws.getState().doc.text'),'A\n\nB\n\nC','Ctrl+Z dopo Accetta tutto riporta il documento');
 await until("!!document.querySelector('.cm-mergeView')");

 // Selezione intra-riga: un'accettazione a righe non deve inglobare prefisso/suffisso.
 const scopedOriginal='prefisso BAD\none\ntwo\nthree\nfour\nfive\nBAD suffisso';
 const scopedReply=scopedOriginal.slice(9,-9).replaceAll('BAD','GOOD');
 const scopedTarget='prefisso '+scopedReply+' suffisso';
 const setSelectedDocument=async()=>{
  // Dopo un'accettazione completa non c'è più la barra: si scarta solo se c'è ancora una proposta aperta.
  if(await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent==='Discard'&&!b.disabled)"))await click('Discard');
  await until("!document.querySelector('.cm-mergeView')");
  await evaluate(`(()=>{const view=smoke.EditorView.findFromDOM(document.querySelector('.cm-editor'));const text=${JSON.stringify(scopedOriginal)};view.dispatch({changes:{from:0,to:view.state.doc.length,insert:text},selection:{anchor:9,head:text.length-9}});smoke.reply=${JSON.stringify(scopedReply)};})()`);
  await sleep(100);
 };
 const rightText=()=>evaluate("smoke.EditorView.findFromDOM([...document.querySelectorAll('.cm-editor')].at(-1)).state.doc.toString()");
 await setSelectedDocument();
 await until("[...document.querySelectorAll('span')].some(s=>s.textContent.startsWith('Selection · '))");
 await request();
 await click('Accept all');
 assert.equal(await evaluate('smoke.ws.getState().doc.text'),scopedTarget,'Accetta tutto conserva il contesto esterno alla selezione');
 await until("!document.querySelector('.cm-mergeView')");
 assert.equal(await rightText(),scopedTarget,'Dopo Accetta tutto resta l\'editor con il documento completo');
 await setSelectedDocument();await request();
 await until("document.querySelectorAll('.cm-merge-revert button[data-action=accept]').length===2");
 for(let i=0;i<2;i++){
  await evaluate("document.querySelector('.cm-merge-revert button[data-action=accept]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}))");
  await sleep(150);
  assert.equal(await rightText(),scopedTarget,'Accetta blocco intra-riga mantiene i confini originali della selezione');
 }
 assert.equal(await evaluate('smoke.ws.getState().doc.text'),scopedTarget,'Entrambi i blocchi selezionati applicati senza cancellare contesto');
 await press('Use the whole document');
 await evaluate(`smoke.reply='---\\nimage: http://127.0.0.1:59999/frontmatter\\n---\\n![x](http://127.0.0.1:59999/image)\\n\\n<img src="http://127.0.0.1:59999/raw" srcset="http://127.0.0.1:59999/srcset 2x"><iframe src="http://127.0.0.1:59999/frame"></iframe>'`);
 await evaluate(`smoke.comment='Nota ![x](http://127.0.0.1:59999/image) <img src="http://127.0.0.1:59999/raw"><iframe src="http://127.0.0.1:59999/frame"></iframe>'`);
 await request();await sleep(500);
 assert.equal(network.filter(url=>url.includes(':59999')).length,0,'Chat e diff non caricano immagini, frontmatter o HTML remoto');
 assert.equal(await evaluate("document.querySelectorAll('[role=log] img,[role=log] iframe').length"),0,'Nessun elemento remoto nella chat');
 assert.ok(await evaluate("[...document.querySelectorAll('[role=log] span')].some(s=>s.textContent.includes('127.0.0.1:59999'))"),'Immagine resa come etichetta con l\'host');
 await evaluate("smoke.comment=''");

 // Il ripristino aggiorna Workspace prima della transazione dell'editor: le lunghezze divergono.
 await press('Editor');
 const beforeRestore=await evaluate('smoke.ws.getState().doc.text');
 await evaluate("smoke.history.list('smoke','a.md').then(rows=>smoke.ws.restoreVersion(rows.find(r=>r.reason==='before-ai'&&r.text==='# Original\\n\\nParagraph.').id))");
 await sleep(150);
 assert.equal(await evaluate('smoke.ws.getState().doc.text'),'# Original\n\nParagraph.');
 assert.equal(await evaluate("smoke.EditorView.findFromDOM(document.querySelector('.cm-editor')).state.doc.toString()"),'# Original\n\nParagraph.');
 assert.equal(await evaluate("smoke.undo(smoke.EditorView.findFromDOM(document.querySelector('.cm-editor')))"),true);
 assert.equal(await evaluate('smoke.ws.getState().doc.text'),beforeRestore,'Ripristino dalla cronologia annullabile anche con AI attiva');
 // Selezione fatta in modalità Editor: passando ad AI il chip la riflette (senza chip la richiesta riscriverebbe tutto).
 await evaluate(`(()=>{const view=smoke.EditorView.findFromDOM(document.querySelector('.cm-editor'));view.dispatch({changes:{from:0,to:view.state.doc.length,insert:'uno\\ndue\\ntre\\nquattro'},selection:{anchor:0,head:11}});})()`);
 await sleep(100);await press('AI');
 await until("[...document.querySelectorAll('span')].some(s=>s.textContent==='Selection · 3 lines')");
 await press('Editor');await evaluate("(()=>{const view=smoke.EditorView.findFromDOM(document.querySelector('.cm-editor'));view.dispatch({selection:{anchor:4,head:11}});})()");
 await press('AI');await until("[...document.querySelectorAll('span')].some(s=>s.textContent==='Selection · 2 lines')");

 // Impostazioni: il focus entra sul titolo e torna dov'era; Indietro con una bozza aperta chiede conferma.
 const settings="document.querySelector('[role=region][aria-label=\"Settings\"]')";
 await evaluate(`${composer}.focus()`);await press('Settings');
 await until(`!!${settings}&&document.activeElement===${settings}.querySelector('h1')`);
 assert.ok(await evaluate(`(()=>{const a=[...${settings}.querySelectorAll('a')].find(a=>a.textContent==='AI · Profiles');if(!a)return false;a.click();return true;})()`),'Voce AI · Profiles');
 await until("location.hash==='#settings/ai-profiles'");
 assert.ok(await evaluate(`(()=>{const b=[...document.querySelectorAll('#settings-ai-profiles button')].find(b=>b.textContent==='+ Create');if(!b)return false;b.click();return true;})()`),'Crea profilo');
 await sleep(150);
 await evaluate(`(()=>{const input=[...document.querySelectorAll('#settings-ai-profiles label')].find(l=>l.querySelector('span')?.textContent==='Name').querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Bozza');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await sleep(150);
 await evaluate('history.back()');
 await until("!!document.querySelector('dialog[open]')&&document.querySelector('dialog[open] h2').textContent==='Discard unsaved changes?'");
 assert.ok(await evaluate("location.hash.startsWith('#settings')"),'Indietro bloccato: l\'hash resta sulle impostazioni');
 await click('Cancel');
 await until("!document.querySelector('dialog[open]')");
 assert.ok(await evaluate(`!!${settings}&&location.hash.startsWith('#settings')`),'Annulla lascia aperte le impostazioni');
 assert.ok(await evaluate(`(()=>{const b=${settings}.querySelector('button[aria-label="Close"]');if(!b)return false;b.click();return true;})()`),'Pulsante Chiudi');
 await until("!!document.querySelector('dialog[open]')");
 await click('Discard changes');
 await until(`!${settings}&&location.hash===''`);
 await until(`document.activeElement===${composer}`);
 assert.deepEqual(errors,[],'Nessuna eccezione runtime');
 console.log('Chromium AI smoke: modalità AI, composer con Invio, proposta, accept-all, blocco, AI→Editor undo, before-ai, chip selezione e accettazione ripetuta e per blocchi, rendering sicuro senza risorse remote, ripristino cronologia, chip dopo selezione in Editor, impostazioni con focus e conferma su Indietro/Chiudi: OK');
}finally{socket?.close();chrome.kill();vite.kill();await Promise.all([new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r)),new Promise(r=>vite.exitCode!==null?r():vite.once('exit',r))]);await rm(profile,{recursive:true,force:true,maxRetries:3});}
