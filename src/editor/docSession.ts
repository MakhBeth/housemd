import { EditorState, type EditorSelection, type Extension, type EditorStateConfig } from '@codemirror/state';
import { historyField } from '@codemirror/commands';
export interface DocSession { resetKey: string; textLf: string; selection?: EditorSelection; history?: ReturnType<EditorState['field']>; }
export function createDocSession(resetKey:string,textLf:string):DocSession{return{resetKey,textLf};}
export function saveDocSession(session:DocSession,state:EditorState){session.textLf=state.doc.toString();session.selection=state.selection;session.history=state.field(historyField,false);}
export function docStateConfig(session:DocSession,extensions:Extension):EditorStateConfig{return{doc:session.textLf,selection:session.selection,extensions:[extensions,...(session.history?[historyField.init(()=>session.history as never)]:[])]};}
