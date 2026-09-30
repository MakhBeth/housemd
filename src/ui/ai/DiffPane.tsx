import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { MergeView, goToNextChunk, goToPreviousChunk } from '@codemirror/merge';
import { Compartment, EditorState, Transaction } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import type { EditorProps, EditorHandle } from '../../editor/Editor';
import { docAppearance, docExtensions, editable, mainSelectionRange, readOnlyExtensions } from '../../editor/docExtensions';
import { docStateConfig, saveDocSession } from '../../editor/docSession';
import { applyDocRestore } from '../../editor/useDocBinding';
import { initialRestoreSeq } from '../../editor/restoreCommand';
import styles from './ReviewView.module.css';
export interface DiffHandle extends EditorHandle { next():void; previous():void; }
interface Props { editor:EditorProps; proposal:string; range?:{from:number;to:number}; canAccept:boolean; streaming:boolean; beforeAccept():boolean; onEdit(text:string):void; acceptLabel:string; rejectLabel:string; /** L'ultimo blocco rimasto è stato rifiutato: equivale a rifiutare tutto. */ onAllRejected():void; }
export const DiffPane=forwardRef<DiffHandle,Props>(function DiffPane(props,ref){
 const host=useRef<HTMLDivElement>(null), merge=useRef<MergeView|null>(null), latest=useRef(props),callbacks=useRef(props.editor),applied=useRef(initialRestoreSeq(props.editor.restore));latest.current=props;callbacks.current=props.editor;
 const remote=useRef(false), rightEditable=useRef(new Compartment());
 // Rifiuto di un blocco: il testo originale torna nella proposta (verso opposto a quello della libreria).
 const reject=(chunkIndex:number)=>{
  const m=merge.current,chunk=m?.chunks[chunkIndex];
  if(!m||!chunk||latest.current.streaming)return;
  let insert=m.a.state.sliceDoc(chunk.fromA,Math.max(chunk.fromA,chunk.toA-1));
  if(chunk.fromA!==chunk.toA&&chunk.toB<=m.b.state.doc.length)insert+=m.a.state.lineBreak;
  m.b.dispatch({changes:{from:chunk.fromB,to:Math.min(m.b.state.doc.length,chunk.toB),insert},userEvent:'revert'});
  // Focus sulla proposta: Ctrl+Z annulla il rifiuto (è nella cronologia di b).
  if(m.chunks.length===0)latest.current.onAllRejected();else m.b.focus();
 };
 const controlButton=(text:string,label:string,action:'accept'|'reject')=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.title=label;b.setAttribute('aria-label',label);b.dataset.action=action;return b;};
 // Due pulsanti per blocco: ← accetta (gestito dalla libreria, revertControls 'b-to-a'), → rifiuta (gestito qui).
 const renderControls=()=>{
  const box=document.createElement('div');box.className=styles.revert;
  const accept=controlButton('←',latest.current.acceptLabel,'accept');accept.disabled=!latest.current.canAccept;
  accept.addEventListener('mousedown',e=>{if(!latest.current.canAccept||!latest.current.beforeAccept()){e.preventDefault();e.stopPropagation();return;}
   // La libreria applica il blocco subito dopo, sul documento: il focus va lì perché Ctrl+Z lo annulli.
   queueMicrotask(()=>merge.current?.a.focus());});
  accept.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&latest.current.canAccept){e.preventDefault();accept.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}));}});
  const rejectButton=controlButton('→',latest.current.rejectLabel,'reject');rejectButton.disabled=latest.current.streaming;
  const onReject=(e:Event)=>{e.preventDefault();e.stopPropagation();reject(Number(box.dataset.chunk));};
  rejectButton.addEventListener('mousedown',onReject);
  rejectButton.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')onReject(e);});
  box.append(accept,rejectButton);return box;
 };
 useEffect(()=>{
 const session=props.editor.session!;
 const m=new MergeView({parent:host.current!,a:docStateConfig(session,docExtensions(callbacks)),b:{doc:latest.current.proposal,extensions:[basicSetup,EditorState.transactionFilter.of(tr=>{if(remote.current||!tr.docChanged||!latest.current.range)return tr;let valid=true;tr.changes.iterChangedRanges((from,to)=>{if(from<latest.current.range!.from||to>latest.current.range!.to)valid=false;});return valid?tr:[];}),docAppearance(),rightEditable.current.of(readOnlyExtensions(props.streaming)),EditorView.updateListener.of(u=>{if(u.docChanged&&!remote.current)latest.current.onEdit(u.state.doc.toString());})]},revertControls:'b-to-a',renderRevertControl:renderControls});
 merge.current=m;
 // Lo stato creato dalla sessione non passa dall'updateListener: si annuncia la selezione ripristinata.
 callbacks.current.onSelection?.(mainSelectionRange(m.a.state));
 return()=>{saveDocSession(session,m.a.state);m.destroy();merge.current=null;};
 },[props.editor.resetKey]);
 useEffect(()=>{const m=merge.current;if(!m)return;remote.current=true;if(m.b.state.doc.toString()!==props.proposal)m.b.dispatch({changes:{from:0,to:m.b.state.doc.length,insert:props.proposal},annotations:Transaction.addToHistory.of(false)});remote.current=false;},[props.proposal]);
 useEffect(()=>{const m=merge.current;if(!m)return;m.a.dispatch({effects:editable.reconfigure(readOnlyExtensions(props.editor.readOnly??false))});m.b.dispatch({effects:rightEditable.current.reconfigure(readOnlyExtensions(props.streaming))});for(const b of host.current!.querySelectorAll<HTMLButtonElement>('.cm-merge-revert button'))b.disabled=b.dataset.action==='reject'?props.streaming:!props.canAccept;},[props.canAccept,props.streaming,props.editor.readOnly]);
 useEffect(()=>{const m=merge.current;if(m)applied.current=applyDocRestore(m.a,applied.current,props.editor.restore);},[props.editor.restore?.seq]);
 useImperativeHandle(ref,()=>({getView:()=>merge.current?.a??null,focus:()=>merge.current?.a.focus(),replace(text){const a=merge.current?.a;if(a)a.dispatch({changes:{from:0,to:a.state.doc.length,insert:text},userEvent:'input.ai'});},scrollToLine(line){const a=merge.current?.a;if(a)a.dispatch({effects:EditorView.scrollIntoView(a.state.doc.line(Math.min(a.state.doc.lines,Math.max(1,Math.floor(line)+1))).from)});},next(){if(merge.current)goToNextChunk(merge.current.a);},previous(){if(merge.current)goToPreviousChunk(merge.current.a);}}),[]);
 return <div className={styles.diff} ref={host}/>;
});
