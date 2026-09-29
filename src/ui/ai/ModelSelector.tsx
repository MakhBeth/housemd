import { useId, useSyncExternalStore, useState, useRef, useEffect } from 'react';
import type { AiController } from '../../ai/aiController';
import { capabilities } from '../../ai/capabilities';
import { effectiveProfile, isLocalProfile } from '../../ai/profiles';
import { useT } from '../../i18n/I18nProvider';
import { writePref } from '../../lib/prefs';
import { ModelSelect } from './ModelSelect';
import type { GenParams, ModelProfile } from '../../ai/types';
export function Parameters({profile,value,onChange}:{profile:ModelProfile;value:GenParams;onChange:(p:GenParams)=>void}){
 const t=useT(),caps=capabilities(profile.kind,profile.model,{effort:!!profile.params.effort});
 return <>{(['temperature','topP','maxOutputTokens','chunkChars']as const).filter(k=>caps[k]).map(k=><label key={k}>{t(`ai.param.${k}`)}<input type="number" min={k==='temperature'||k==='topP'?0:1} max={k==='temperature'?2:k==='topP'?1:undefined} step={k==='temperature'||k==='topP'?.1:1} value={value[k]??''} onChange={e=>onChange({...value,[k]:e.target.value===''?undefined:Number(e.target.value)})}/></label>)}{caps.effort&&<label>{t('ai.param.effort')}<select value={value.effort??''} onChange={e=>onChange({...value,effort:e.target.value as GenParams['effort']||undefined})}><option value="">{t('ai.default')}</option>{['low','medium','high','xhigh','max'].map(v=><option key={v}>{v}</option>)}</select></label>}</>;
}
export function ModelSelector({controller,onSettings}:{controller:AiController;onSettings:()=>void}){
 const t=useT(),state=useSyncExternalStore(controller.subscribe,controller.getState),id=useId(),profile=controller.profile(),override=state.chat.overrides,effective=profile?effectiveProfile(profile,override):null;
 const [opened,setOpened]=useState(false),popover=useRef<HTMLDivElement>(null);
 useEffect(()=>{const el=popover.current;if(!el)return;const toggle=()=>setOpened(el.matches(':popover-open'));el.addEventListener('toggle',toggle);return()=>el.removeEventListener('toggle',toggle);},[profile?.id]);
 return <section><select aria-label={t('ai.profile')} value={state.profileId} onChange={e=>{if(e.target.value==='__manage')onSettings();else{controller.selectProfile(e.target.value);writePref('aiProfile',e.target.value);}}}>{[true,false].map(local=><optgroup key={String(local)} label={t(local?'ai.local':'ai.cloud')}>{state.profiles.filter(p=>isLocalProfile(p)===local).map(p=><option key={p.id} value={p.id}>{p.name} · {p.model||t('ai.cliDefault')}{p.kind==='anthropic'&&!p.secretId?' ⚠':''}</option>)}</optgroup>)}<option value="__manage">{t('ai.manage')}</option></select>
 <button type="button" {...{popovertarget:id}}>{t('ai.parameters')}{Object.keys(override).length?' •':''}</button>
 {profile&&effective&&<div ref={popover} id={id} {...{popover:'auto'}} className="ai-popover">{opened&&<ModelSelect controller={controller} profile={effective} onChange={selection=>controller.override({...override,...selection})}/>}<Parameters profile={effective} value={{...profile.params,...override}} onChange={params=>controller.override({...override,...params})}/><button onClick={()=>void controller.saveOverrides().catch(e=>controller.report(e))}>{t('ai.saveProfile')}</button><button onClick={()=>void controller.saveOverrides(true).catch(e=>controller.report(e))}>{t('ai.saveAs')}</button><button onClick={()=>controller.override({})}>{t('ai.reset')}</button></div>}
 {profile&&<small>{profile.kind==='claude-code'?t('ai.claudePrivacy'):isLocalProfile(profile)?t('ai.localPrivacy'):t('ai.cloudPrivacy',{host:(()=>{try{return new URL(profile.baseUrl).host;}catch{return '';}})()})}</small>}
 </section>;
}
