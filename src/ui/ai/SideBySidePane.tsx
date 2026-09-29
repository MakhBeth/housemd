import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Editor, type EditorHandle, type EditorProps } from '../../editor/Editor';
import { Preview, type PreviewHandle, type PreviewProps } from '../../preview/Preview';
import { alignedLine, align } from '../../ai/align';
import { imageUrls } from '../../ai/safeRender';
interface Props {editor:EditorProps;proposal:string;range?:{from:number;to:number};streaming:boolean;preview:boolean;linked:boolean;onEdit(text:string):void;previewProps:PreviewProps;}
export const SideBySidePane=forwardRef<EditorHandle,Props>(function SideBySidePane(props,ref){
 const left=useRef<EditorHandle>(null),right=useRef<EditorHandle>(null),preview=useRef<PreviewHandle>(null);
 const incoming=useRef({text:props.proposal,seq:0});if(incoming.current.text!==props.proposal)incoming.current={text:props.proposal,seq:incoming.current.seq+1};
 const mapping=useMemo(()=>align(props.editor.text,props.proposal),[props.editor.text,props.proposal]);
 const untrusted=useMemo(()=>({allowedUrls:imageUrls(props.editor.text)}),[props.editor.text]);
 useImperativeHandle(ref,()=>({focus:()=>left.current?.focus(),getView:()=>left.current?.getView()??null,replace:text=>left.current?.replace(text),scrollToLine:line=>left.current?.scrollToLine(line)}),[]);
 return <div className="ai-columns"><Editor {...props.editor} ref={left} onTopLine={line=>{if(props.linked)(props.preview?preview.current:right.current)?.scrollToLine(alignedLine(line,mapping));}}/>
 {props.preview?<Preview {...props.previewProps} text={props.proposal} untrusted={untrusted} ref={preview} onTopLine={line=>{if(props.linked)left.current?.scrollToLine(alignedLine(line,mapping,true));}}/>:<Editor canChange={changes=>{if(!props.range)return true;let valid=true;changes.iterChangedRanges((from,to)=>{if(from<props.range!.from||to>props.range!.to)valid=false;});return valid;}} ref={right} text={props.proposal} resetKey={`${props.editor.resetKey}:proposal`} restore={{seq:incoming.current.seq,textLf:props.proposal}} readOnly={props.streaming} getDocs={()=>[]} onImage={async()=>null} onChange={text=>{if(text!==props.proposal)props.onEdit(text);}} onTopLine={line=>{if(props.linked)left.current?.scrollToLine(alignedLine(line,mapping,true));}}/>}</div>;
});
