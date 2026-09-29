import { useState, useSyncExternalStore } from 'react';
import type { AiController } from '../../../ai/aiController';
import { defaultProfile, PROVIDER_KINDS, DEFAULT_URLS, validateProfile } from '../../../ai/profiles';
import { changeProvider } from '../../../ai/models';
import type { ModelProfile, ProviderKind } from '../../../ai/types';
import type { MessageKey } from '../../../i18n/messages';
import { useT } from '../../../i18n/I18nProvider';
import { ModelSelect } from '../ModelSelect';
import { Parameters } from '../ModelSelector';
export function AiProfilesSection({controller}:{controller:AiController}){
 const t=useT(),state=useSyncExternalStore(controller.subscribe,controller.getState),[draft,setDraft]=useState<ModelProfile|null>(null),[key,setKey]=useState(''),[remember,setRemember]=useState(false),[connected,setConnected]=useState(false);
 const run=(job:Promise<unknown>)=>void job.catch(e=>controller.report(e));
 return <fieldset className="ai-settings"><legend>{t('ai.profile')}</legend><div className="ai-bar">{state.profiles.map(p=><button key={p.id} onClick={()=>{setDraft({...p,params:{...p.params}});setKey('');setConnected(false);}}>{p.name}</button>)}<button onClick={()=>setDraft(defaultProfile('ollama',crypto.randomUUID()))}>{t('ai.create')}</button></div>
 {draft&&<><label>{t('ai.name')}<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>{t('ai.provider')}<select value={draft.kind} onChange={e=>{const kind=e.target.value as ProviderKind;setDraft({...changeProvider(draft,kind),baseUrl:DEFAULT_URLS[kind]});setKey('');}}>{PROVIDER_KINDS.map(k=><option key={k}>{k}</option>)}</select></label><label>{t('ai.url')}<input type="url" disabled={draft.kind==='anthropic'} value={draft.baseUrl} onChange={e=>setDraft({...draft,baseUrl:e.target.value})}/></label><p>{t(`ai.help.${draft.kind}` as MessageKey)}</p>
 <ModelSelect controller={controller} profile={draft} onChange={selection=>setDraft({...draft,...selection})}/><Parameters profile={draft} value={draft.params} onChange={params=>setDraft({...draft,params})}/><label>{t('ai.contextTokens')}<input type="number" min="1" value={draft.contextTokens??''} onChange={e=>setDraft({...draft,contextTokens:e.target.value?Number(e.target.value):null})}/></label>
 {['ollama','lmstudio','openai-compatible'].includes(draft.kind)&&<label><input type="checkbox" checked={!!draft.params.effort} onChange={e=>setDraft({...draft,params:{...draft.params,effort:e.target.checked?'medium':undefined}})}/>{t('ai.enableEffort')}</label>}
 {['anthropic','openai-compatible'].includes(draft.kind)&&<><label>{t('ai.secret')}<input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)}/></label><label><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>{t('ai.remember')}</label><p>{t('ai.secretNotice')}</p><button disabled={!key} onClick={()=>run(controller.setSecret(validateProfile(draft),key,remember).then(()=>{setKey('');setDraft(controller.getState().profiles.find(p=>p.id===draft.id)??draft);}))}>{t('ai.saveSecret')}</button></>}
 <div className="ai-bar"><button onClick={()=>run(controller.saveProfile(validateProfile(draft)))}>{t('ai.save')}</button><button onClick={()=>setDraft({...draft,id:crypto.randomUUID(),secretId:null,name:draft.name})}>{t('ai.duplicate')}</button><button onClick={()=>run(controller.deleteProfile(draft.id).then(()=>setDraft(null)))}>{t('ai.delete')}</button><button onClick={()=>{setConnected(false);run(controller.provider(draft).then(async p=>{const signal=new AbortController().signal;if(p.testConnection)await p.testConnection(signal);else{const list=await p.listModels(signal);if(list===null)throw {code:'unreachable'};}setConnected(true);}));}}>{t('ai.connection')}</button></div>{connected&&<p role="status">{t('ai.connected')}</p>}</>}
 </fieldset>;
}
