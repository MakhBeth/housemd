import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { MergeView, goToNextChunk, goToPreviousChunk } from '@codemirror/merge';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import type { EditorProps, EditorHandle } from '../../editor/Editor';
import { docExtensions, editable, readOnlyExtensions } from '../../editor/docExtensions';
import { docStateConfig, saveDocSession } from '../../editor/docSession';
import { applyDocRestore } from '../../editor/useDocBinding';
import { initialRestoreSeq } from '../../editor/restoreCommand';
export interface DiffHandle extends EditorHandle { next():void; previous():void; }
interface Props { editor:EditorProps; proposal:string; range?:{from:number;to:number}; canAccept:boolean; streaming:boolean; collapse:boolean; beforeAccept():boolean; onEdit(text:string):void; acceptLabel:string; }
export const DiffPane=forwardRef<DiffHandle,Props>(function DiffPane(props,ref){
 const host=useRef<HTMLDivElement>(null), merge=useRef<MergeView|null>(null), latest=useRef(props),callbacks=useRef(props.editor),applied=useRef(initialRestoreSeq(props.editor.restore));latest.current=props;callbacks.current=props.editor;
 const remote=useRef(false), rightEditable=useRef(new Compartment());
 useEffect(()=>{
 const session=props.editor.session!;
 const m=new MergeView({parent:host.current!,a:docStateConfig(session,docExtensions(callbacks)),b:{doc:latest.current.proposal,extensions:[basicSetup,EditorState.transactionFilter.of(tr=>{if(remote.current||!tr.docChanged||!latest.current.range)return tr;let valid=true;tr.changes.iterChangedRanges((from,to)=>{if(from<latest.current.range!.from||to>latest.current.range!.to)valid=false;});return valid?tr:[];}),markdown(),EditorView.lineWrapping,rightEditable.current.of(readOnlyExtensions(props.streaming)),EditorView.updateListener.of(u=>{if(u.docChanged&&!remote.current)latest.current.onEdit(u.state.doc.toString());})]},revertControls:'b-to-a',renderRevertControl:()=>{const b=document.createElement('button');b.textContent='←';b.title=latest.current.acceptLabel;b.disabled=!latest.current.canAccept; b.setAttribute('aria-label',latest.current.acceptLabel);b.addEventListener('mousedown',e=>{if(!latest.current.canAccept||!latest.current.beforeAccept()){e.preventDefault();e.stopPropagation();}});b.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&latest.current.canAccept){e.preventDefault();b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}));}});return b;},collapseUnchanged:props.collapse?{margin:3,minSize:6}:undefined});
 merge.current=m;
 return()=>{saveDocSession(session,m.a.state);m.destroy();merge.current=null;};
 },[props.editor.resetKey]);
 useEffect(()=>{const m=merge.current;if(!m)return;remote.current=true;if(m.b.state.doc.toString()!==props.proposal)m.b.dispatch({changes:{from:0,to:m.b.state.doc.length,insert:props.proposal}});remote.current=false;},[props.proposal]);
 useEffect(()=>{const m=merge.current;if(!m)return;m.reconfigure({collapseUnchanged:props.collapse?{margin:3,minSize:6}:undefined});m.a.dispatch({effects:editable.reconfigure(readOnlyExtensions(props.editor.readOnly??false))});m.b.dispatch({effects:rightEditable.current.reconfigure(readOnlyExtensions(props.streaming))});for(const b of host.current!.querySelectorAll<HTMLButtonElement>('.cm-merge-revert button'))b.disabled=!props.canAccept;},[props.canAccept,props.streaming,props.collapse,props.editor.readOnly]);
 useEffect(()=>{const m=merge.current;if(m)applied.current=applyDocRestore(m.a,applied.current,props.editor.restore);},[props.editor.restore?.seq]);
 useImperativeHandle(ref,()=>({getView:()=>merge.current?.a??null,focus:()=>merge.current?.a.focus(),replace(text){const a=merge.current?.a;if(a)a.dispatch({changes:{from:0,to:a.state.doc.length,insert:text},userEvent:'input.ai'});},scrollToLine(line){const a=merge.current?.a;if(a)a.dispatch({effects:EditorView.scrollIntoView(a.state.doc.line(Math.min(a.state.doc.lines,Math.max(1,Math.floor(line)+1))).from)});},next(){if(merge.current)goToNextChunk(merge.current.a);},previous(){if(merge.current)goToPreviousChunk(merge.current.a);}}),[]);
 return <div className="ai-diff" ref={host}/>;
});
