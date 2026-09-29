import { useRef, useState, useSyncExternalStore } from 'react';
import type { AiController } from '../../ai/aiController';
import { Editor, type EditorProps, type EditorHandle } from '../../editor/Editor';
import type { PreviewProps } from '../../preview/Preview';
import { useT } from '../../i18n/I18nProvider';
import { readPref, writePref } from '../../lib/prefs';
import { ConfirmDialog } from '../ConfirmDialog';
import { DiffPane, type DiffHandle } from './DiffPane';
import { SideBySidePane } from './SideBySidePane';
export function ReviewView({controller,editor,previewProps}:{controller:AiController;editor:EditorProps;previewProps:PreviewProps}){
 const t=useT(),state=useSyncExternalStore(controller.subscribe,controller.getState),p=state.proposals.get(previewProps.path),left=useRef<EditorHandle>(null),diff=useRef<DiffHandle>(null);
 const [view,setView]=useState<'diff'|'side'>(()=>readPref('aiView','diff')),[right,setRight]=useState<'source'|'preview'>(()=>readPref('aiRightPane','source')),[linked,setLinked]=useState(()=>readPref('aiLinkedScroll',true)),[collapse,setCollapse]=useState(false),[confirm,setConfirm]=useState(false);
 const effectiveView=p?.presetId?state.presets.find(x=>x.id===p.presetId)?.view||view:view;
 const [override,setOverride]=useState<{path:string;createdAt:number;view:'diff'|'side'}|null>(null);
 const actualView=override&&p&&override.path===p.path&&override.createdAt===p.createdAt?override.view:effectiveView;
 const warnings=[...state.chat.messages].reverse().find(m=>m.role==='assistant'&&m.docPath===previewProps.path)?.warnings||[];
 const streaming=!p||p.status==='streaming'||state.running?.path===p.path||p.scope?.status==='lost';
 const range=p?.scope?{from:p.scope.from,to:p.scope.from+p.text.length}:undefined;
 const text=p?controller.proposalText(p)??p.text:editor.text,accept=()=>{if(!p||!controller.beforeAccept(p,true))return;const text=controller.proposalText(p);if(text!==null)(actualView==='diff'?diff.current:left.current)?.replace(text);setConfirm(false);};
 const edit=(text:string)=>{if(!p)return;if(p.scope){const suffix=editor.text.length-p.scope.to;controller.edited(p.path,text.slice(p.scope.from,suffix?text.length-suffix:undefined));}else controller.edited(p.path,text);};
 return <section className="ai-review"><div className="ai-bar">
 <span>{p?t(`ai.status.${p.status}`):t('ai.emptyProposal')}</span>
 {warnings.length>0&&<details><summary>⚠ {warnings.length}</summary>{warnings.map((w,i)=><button key={i} onClick={()=>{const handle=actualView==='diff'?diff.current:left.current;handle?.scrollToLine((w as {line?:number}).line||0);}}>{t(`ai.warning.${w.code}` as import('../../i18n/messages').MessageKey)}</button>)}</details>}
 <span>{p?`${p.text.trim().split(/\s+/).filter(Boolean).length} ${t('ai.words')}`:''}</span>
 {p?.progress&&<span>{p.progress.done}/{p.progress.total}</span>}
 {(['diff','side']as const).map(v=><button key={v} aria-pressed={actualView===v} onClick={()=>{setView(v);writePref('aiView',v);if(p)setOverride({path:p.path,createdAt:p.createdAt,view:v});}}>{t(`ai.view.${v}`)}</button>)}
 {actualView==='diff'?<><button onClick={()=>diff.current?.previous()}>{t('ai.previous')}</button><button onClick={()=>diff.current?.next()}>{t('ai.next')}</button><label><input type="checkbox" checked={collapse} onChange={e=>setCollapse(e.target.checked)}/>{t('ai.collapse')}</label></>:<><button onClick={()=>{const v=right==='source'?'preview':'source';setRight(v);writePref('aiRightPane',v);}}>{t(`ai.right.${right}`)}</button><label><input type="checkbox" checked={linked} onChange={e=>{setLinked(e.target.checked);writePref('aiLinkedScroll',e.target.checked);}}/>{t('ai.linked')}</label></>}
 <button disabled={!p||!controller.canAccept(p,true)} onClick={()=>{if(p&&editor.text!==p.baseText&&!p.scope)setConfirm(true);else accept();}}>{t('ai.acceptAll')}</button>
 <button disabled={!p||p.status==='streaming'} onClick={()=>p&&controller.discard(p.path)}>{t('ai.discard')}</button>
 {p?.status==='partial'&&<button onClick={()=>void controller.continue(p.path)}>{t('ai.continue')}</button>}
 {p?.scope?.status==='lost'&&<span role="alert">{t('ai.error.scopeLost')}</span>}
 {p&&text===editor.text&&p.status!=='streaming'&&<span>{t('ai.applied')}</span>}
 </div>
 <div className="ai-pane-labels"><span>{t('ai.original')}</span><span>{t('ai.proposal')}</span></div>
 {state.streamingPreview&&<details><summary>{t('ai.streamingPreview')}</summary><pre>{state.streamingPreview}</pre></details>}
 {!p?<div className="ai-columns"><Editor {...editor} ref={left}/><div>{t('ai.emptyProposal')}</div></div>:actualView==='diff'?<DiffPane ref={diff} editor={editor} range={range} proposal={text} canAccept={!!p&&controller.canAccept(p)} streaming={streaming} collapse={collapse} beforeAccept={()=>!!p&&controller.beforeAccept(p)} onEdit={edit} acceptLabel={t('ai.acceptBlock')}/>:<SideBySidePane ref={left} editor={editor} range={range} proposal={text} streaming={streaming} preview={right==='preview'} linked={linked} onEdit={edit} previewProps={previewProps}/>}
 {confirm&&<ConfirmDialog title={t('ai.acceptAll')} message={t('ai.changedWarning')} confirmLabel={t('ai.acceptAll')} onConfirm={accept} onCancel={()=>setConfirm(false)}/>}
 </section>;
}
