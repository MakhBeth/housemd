import {useEffect,useState} from 'react';
import {AiController,type AiWorkspace} from '../../ai/aiController';
import {createIdbAiStores} from '../../ai/idbStores';
import {createMemoryAiStores} from '../../ai/stores';
import {readPref} from '../../lib/prefs';
import {registerUpdateParticipant} from '../../pwa/updateHost';
import type {Workspace} from '../../workspace/workspace';
/** Una sessione AI per cartella; IndexedDB non disponibile non impedisce la chat in memoria. */
export function useAiController(workspace:Workspace):AiController|null{
 const [ai,setAi]=useState<AiController|null>(null);
 useEffect(()=>{
  let alive=true,controller:AiController|null=null,unregister:(()=>void)|undefined;
  const binding:AiWorkspace={getDoc:()=>{const s=workspace.getState();return s.doc?{path:s.doc.path,textLf:s.doc.text,conflict:s.doc.conflict,updating:s.updating}:null;},snapshotBeforeAi:()=>workspace.snapshotBeforeAi(),openFile:path=>workspace.openFile(path)};
  void(async()=>{
   try{controller=new AiController(await createIdbAiStores(),binding);await controller.initialize(readPref('aiProfile',''));}
   catch{controller?.dispose();controller=new AiController(createMemoryAiStores(),binding);await controller.initialize();controller.report({code:'server'});}
   if(!alive){controller.dispose();return;}unregister=registerUpdateParticipant(controller);setAi(controller);
  })();
  return()=>{alive=false;unregister?.();controller?.dispose();};
 },[workspace]);
 return ai;
}
