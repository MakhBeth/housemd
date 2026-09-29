import { useEffect, useState } from 'react';
import type { AiController } from '../../ai/aiController';
import type { ModelProfile, ModelOption } from '../../ai/types';
import { modelOptions } from '../../ai/models';
import { modelSelection } from '../../ai/profiles';
import { useT } from '../../i18n/I18nProvider';
export function ModelSelect({controller,profile,onChange}:{controller:AiController;profile:ModelProfile;onChange:(selection:Pick<ModelProfile,'model'|'contextTokens'>)=>void}){
 const t=useT(),[models,setModels]=useState<ModelOption[]|null>(null),[custom,setCustom]=useState(false),[revision,setRevision]=useState(0),[error,setError]=useState(false);
 useEffect(()=>{const abort=new AbortController();setError(false);setModels(null);void controller.provider(profile).then(p=>p.listModels(abort.signal)).then(list=>{if(!abort.signal.aborted){setModels(list);if(!list)setError(true);}}).catch(e=>{if(!abort.signal.aborted){setError(true);controller.report(e);}});return()=>abort.abort();},[profile.kind,profile.baseUrl,profile.secretId,revision,controller]);
 const select=(value:string)=>onChange(modelSelection(profile,value,models?.find(m=>m.value===value)));
 return <div><label>{t('ai.model')}<select value={custom?'__custom':profile.model} onChange={e=>{if(e.target.value==='__custom')setCustom(true);else {setCustom(false);select(e.target.value);}}}><option value="">{profile.kind==='claude-code'?t('ai.cliDefault'):t('ai.chooseModel')}</option>{modelOptions(profile.kind,profile.model,models).filter(m=>m.value).map(m=><option key={m.value} value={m.value}>{m.label}</option>)}<option value="__custom">{t('ai.other')}</option></select></label>{custom&&<input aria-label={t('ai.model')} value={profile.model} onChange={e=>select(e.target.value)}/>}<button type="button" onClick={()=>setRevision(r=>r+1)}>{t('ai.refresh')}</button>{error&&<small>{t('ai.error.unreachable')}</small>}</div>;
}
