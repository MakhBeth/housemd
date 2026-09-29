import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AiController } from '../../ai/aiController';
import type { SelectionScope } from '../../ai/types';
import type { MessageKey } from '../../i18n/messages';
import { useT } from '../../i18n/I18nProvider';
import { ModelChip } from './ModelChip';
import { ChatLog } from './ChatLog';
export function AiSidebar({controller,onSettings,getSelection,syncNeedsPermission}:{controller:AiController;onSettings:()=>void;getSelection:()=>SelectionScope|undefined;syncNeedsPermission?:boolean}){
 const t=useT(),state=useSyncExternalStore(controller.subscribe,controller.getState),[request,setRequest]=useState(''),[selection,setSelection]=useState(false),[elapsed,setElapsed]=useState(0);
 useEffect(()=>{if(!state.running)return;const timer=setInterval(()=>setElapsed(Math.floor((Date.now()-state.running!.startedAt)/1000)),1000);return()=>clearInterval(timer);},[state.running]);
 const send=(presetId?:string)=>{const preset=state.presets.find(p=>p.id===presetId),scope=selection?getSelection():undefined;if(selection&&!scope){controller.report({code:'scopeLost'});return;}void controller.send(preset?preset.name||t(`ai.preset.${preset.builtInId}` as MessageKey):request,preset,scope).catch(e=>controller.report(e));if(!preset)setRequest('');};
 return <div className="ai-sidebar"><ModelChip controller={controller} onManage={onSettings}/>{syncNeedsPermission&&<button onClick={onSettings}>⚠ {t('ai.syncReactivate')}</button>}<div className="ai-bar">{state.presets.filter(p=>!p.hidden).sort((a,b)=>a.order-b.order).map(p=><button key={p.id} disabled={!!state.running} onClick={()=>send(p.id)}>{p.name||t(`ai.preset.${p.builtInId}` as MessageKey)}</button>)}<button onClick={onSettings}>{t('ai.managePresets')}</button></div>
 <ChatLog messages={state.chat.messages} onOpen={path=>controller.workspace.openFile(path)} onRetry={(id,remove)=>void controller.retry(id,remove)}/>
 
 {state.running&&<span aria-live="polite">{t('ai.working')} {elapsed}s</span>}
 <textarea aria-label={t('ai.request')} placeholder={t('ai.request')} value={request} onChange={e=>setRequest(e.target.value)} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();send();}if(e.key==='Escape')controller.stop();}}/>
 <label><input type="checkbox" checked={selection} onChange={e=>setSelection(e.target.checked)}/>{t('ai.selection')}</label>
 <div className="ai-bar"><button onClick={()=>controller.newChat()}>{t('ai.newChat')}</button>{state.running?<button onClick={()=>controller.stop()}>{t('ai.stop')}</button>:<button disabled={!request.trim()||!controller.profile()} onClick={()=>send()}>{t('ai.send')}</button>}</div></div>;
}
