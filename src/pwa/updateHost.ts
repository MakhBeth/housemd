import type { SettleResult, Workspace } from '../workspace/workspace';
import type { UpdateHost } from './updateFlow';
export interface UpdateParticipant { prepare():Promise<SettleResult>; cancel():void; }
let active: Workspace | null = null;
const participants=new Set<UpdateParticipant>();
export function setUpdateWorkspace(workspace: Workspace | null): void { active = workspace; }
export function registerUpdateParticipant(participant:UpdateParticipant):()=>void{participants.add(participant);return()=>{participants.delete(participant);};}
export async function prepareParticipants(list:UpdateParticipant[]):Promise<SettleResult>{
 const prepared:UpdateParticipant[]=[];
 for(const participant of list){let result:SettleResult;try{result=await participant.prepare();}catch{result='failed';}
 if(result!=='durable'){participant.cancel();prepared.reverse().forEach(p=>p.cancel());return result;}prepared.push(participant);}
 return 'durable';
}
export const updateHost: UpdateHost = {
 prepare:()=>prepareParticipants([...(active?[{prepare:()=>active!.beginUpdate(),cancel:()=>active?.endUpdate()}]:[]),...participants]),
 cancel:()=>{active?.endUpdate();participants.forEach(p=>p.cancel());},
 reload:()=>window.location.reload(),
 setTimer(callback,ms){const id=window.setTimeout(callback,ms);return()=>window.clearTimeout(id);},
};
