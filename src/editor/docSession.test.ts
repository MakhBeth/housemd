import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState} from '@codemirror/state';
import {history,undo} from '@codemirror/commands';
import {createDocSession,saveDocSession,docStateConfig} from './docSession';
test('cronologia e selezione sopravvivono alle configurazioni Editor/MergeView/Editor',()=>{
 const session=createDocSession('a','original');let state=EditorState.create(docStateConfig(session,history()));
 state=state.update({changes:{from:0,to:8,insert:'proposal'},selection:{anchor:4}}).state;
 for(let i=0;i<3;i++){saveDocSession(session,state);state=EditorState.create(docStateConfig(session,history()));assert.equal(state.selection.main.head,4);}
 assert.equal(undo({state,dispatch:tr=>{state=tr.state;}}),true);assert.equal(state.doc.toString(),'original');
 state=EditorState.create(docStateConfig(createDocSession('b','disk'),history()));assert.equal(undo({state,dispatch:()=>{}}),false);
});
