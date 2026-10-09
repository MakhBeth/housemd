import { Text, type ChangeSet, type ChangeDesc } from '@codemirror/state';
import type { AiStores } from './stores';
import type { AiChat, ChatMessage, ChatProvider, ModelProfile, ProfileOverrides, PromptPreset, Proposal, SelectionScope, StoredSecret, AiErrorCode } from './types';
import { createProvider } from './providers';
import { defaultProfile, effectiveParams, effectiveProfile, profileOrigin, validateProfile } from './profiles';
import { builtInPresets, validatePreset } from './presets';
import { mapScope, applyScope } from './scope';
import { runRequest, createCursor, partialText, type RunInput, type RunCursor } from './runner';
import { checkProposal } from './checks';
export interface AiWorkspace { getDoc(): { path: string; textLf: string; conflict: unknown; updating: boolean } | null; snapshotBeforeAi(): void; openFile(path:string): unknown; }
export interface AiState { chat: AiChat; proposals: Map<string,Proposal>; running: { messageId:string; path:string; startedAt:number } | null; profiles:ModelProfile[]; presets:PromptPreset[]; profileId:string; error:AiErrorCode|null; streamingPreview:string|null; }
const uuid=()=>crypto.randomUUID();
export class AiController {
  private state:AiState={ chat:{id:uuid(),messages:[],overrides:{}},proposals:new Map(),running:null,profiles:[],presets:[],profileId:'',error:null,streamingPreview:null };
  private listeners=new Set<()=>void>();
  private abort:AbortController|null=null;
  private transient=new Map<string,StoredSecret>();
  private resumeData=new Map<string,{input:RunInput;cursor:RunCursor;scope?:SelectionScope}>();
  private retries=new Map<string,{input:RunInput;baseText:string;scope?:SelectionScope;rejected?:string}>();
  private updating=false;
  private accepting=false;
  private appliedPaths=new Set<string>();
  onSettingsChanged?:()=>void;
  constructor(readonly store:AiStores, readonly workspace:AiWorkspace, private providerFactory:(p:ModelProfile,s:StoredSecret|null)=>ChatProvider=createProvider) {}
  getState=()=>this.state;
  subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
  private set(patch:Partial<AiState>){this.state={...this.state,...patch};this.listeners.forEach(fn=>fn());}
  async initialize(profileId?:string){ await this.store.seed([defaultProfile()],builtInPresets()); await this.reload(); if(profileId&&this.state.profiles.some(p=>p.id===profileId))this.selectProfile(profileId); }
  async reload(){const loaded=await this.store.load();const data={profiles:loaded.profiles.map(validateProfile),presets:loaded.presets.map(validatePreset).filter((p):p is PromptPreset=>p!==null)};this.set({...data,profileId:data.profiles.some(p=>p.id===this.state.profileId)?this.state.profileId:data.profiles[0]?.id||''});}
  selectProfile(profileId:string){this.set({profileId,chat:{...this.state.chat,overrides:{}}});}
  override(overrides:ProfileOverrides){this.set({chat:{...this.state.chat,overrides}});}
  async saveProfile(p:ModelProfile){await this.store.saveProfile(p);await this.reload();this.onSettingsChanged?.();}
  async savePreset(p:PromptPreset){await this.store.savePreset(p);await this.reload();this.onSettingsChanged?.();}
  async deleteProfile(id:string){await this.store.deleteProfile(id);await this.reload();this.onSettingsChanged?.();}
  async deletePreset(id:string){await this.store.deletePreset(id);await this.reload();this.onSettingsChanged?.();}
  async saveOverrides(asNew=false){const p=this.profile();if(!p)return;const {model,contextTokens,...params}=this.state.chat.overrides;const next={...effectiveProfile(p,{model,contextTokens}),id:asNew?uuid():p.id,params:{...p.params,...params}};await this.saveProfile(next);this.selectProfile(next.id);}
  profile(){return this.state.profiles.find(p=>p.id===this.state.profileId);}
  async secret(profile:ModelProfile){return profile.secretId?(this.transient.get(profile.secretId)||await this.store.getSecret(profile.secretId)):null;}
  async setSecret(profile:ModelProfile,value:string,remember:boolean){const id=profile.secretId||uuid();const secret={id,value,binding:{kind:profile.kind,origin:profileOrigin(profile)}};if(remember){await this.store.saveSecret(secret);this.transient.delete(id);}else{await this.store.deleteSecret(id);this.transient.set(id,secret);}await this.saveProfile({...profile,secretId:id});}
  async provider(profile:ModelProfile){return this.providerFactory(profile,await this.secret(profile));}
  report(error:unknown){const code=error&&typeof error==='object'&&'code'in error?String(error.code):'server';this.set({error:code as AiErrorCode});}
  clearError(){this.set({error:null});}
  stop(){this.abort?.abort();}
  dispose(){this.stop();this.transient.clear();this.listeners.clear();}
  newChat(){this.stop();this.retries.clear();this.set({chat:{id:uuid(),messages:[],overrides:this.state.chat.overrides}});}
  discard(path:string){if(this.state.running?.path===path)this.stop();const proposals=new Map(this.state.proposals);proposals.delete(path);this.resumeData.delete(path);this.set({proposals});}
  hasPendingWork(){return !!this.state.running||[...this.state.proposals.values()].some(p=>!this.appliedPaths.has(p.path)&&(p.path!==this.workspace.getDoc()?.path||this.proposalText(p)!==this.workspace.getDoc()?.textLf));}
  prepare=async():Promise<'failed'|'durable'>=>{if(this.hasPendingWork()){this.set({error:'aiPendingUpdate'});return 'failed';}this.updating=true;return 'durable';};
  cancel=()=>{this.updating=false;};
  proposalText(p:Proposal){const doc=this.workspace.getDoc();return p.scope?doc?.path===p.path?applyScope(doc.textLf,p.scope,p.text):null:p.text;}
  canAccept(p:Proposal,all=false){const doc=this.workspace.getDoc();return !!doc&&doc.path===p.path&&!doc.conflict&&!doc.updating&&!this.updating&&this.state.running?.path!==p.path&&p.status!=='streaming'&&(!all||p.status!=='truncated')&&(!p.scope||applyScope(doc.textLf,p.scope,p.text)!==null);}
  beforeAccept(p:Proposal,all=false){if(!this.canAccept(p,all))return false;const current=this.state.proposals.get(p.path);if(!current||current.createdAt!==p.createdAt)return false;this.accepting=true;if(!current.snapshotTaken){this.workspace.snapshotBeforeAi();this.put({...current,snapshotTaken:true});}return true;}
  edited(path:string,text:string){this.appliedPaths.delete(path);const p=this.state.proposals.get(path);if(p&&p.status!=='streaming')this.put({...p,text,origin:'edited'});}
  private put(p:Proposal){const proposals=new Map(this.state.proposals);proposals.set(p.path,p);this.set({proposals});}
  documentChanged(path:string,changes:ChangeDesc,reset=false,texts?:{before:string;after:string}){
    const p=this.state.proposals.get(path),doc=this.workspace.getDoc();
    const changed=changes as ChangeSet;
    // Un ripristino può aver aggiornato Workspace prima dell'editor: fanno fede i testi
    // della transazione, non una ChangeSet applicata una seconda volta al modello.
    const before=texts?.before??doc?.textLf;
    const next=texts?.after??(doc?.path===path&&typeof changed.apply==='function'?changed.apply(Text.of(doc.textLf.split('\n'))).toString():null);
    if(p?.scope){
      let scope=mapScope(p.scope,changes,reset);
      if(this.accepting&&!reset&&next!==null&&before!==undefined&&doc?.path===path){
        // MergeView sostituisce righe intere e Accetta tutto l'intero documento:
        // mapPos allargherebbe la selezione anche al contesto esterno invariato.
        const prefix=before.slice(0,p.scope.from),suffix=before.slice(p.scope.to);
        if(next.length>=prefix.length+suffix.length&&next.startsWith(prefix)&&next.endsWith(suffix)){
          const from=prefix.length,to=next.length-suffix.length;
          scope={from,to,status:'valid',originalText:next.slice(from,to)};
        }else scope={...scope,status:'lost'};
      }
      this.put({...p,scope});
    }
    if(p&&next!==null&&!reset){const current=this.state.proposals.get(path)!;const target=current.scope?applyScope(next,current.scope,current.text):current.text;if(target===next)this.appliedPaths.add(path);else this.appliedPaths.delete(path);}else if(reset)this.appliedPaths.delete(path);
    const pending=this.resumeData.get(path);if(pending?.scope)pending.scope=mapScope(pending.scope,changes,reset);
    // Anche Riprova deve seguire la selezione originale, non un tratto omonimo agli offset iniziali.
    for(const retry of this.retries.values())if(retry.input.path===path&&retry.scope)retry.scope=mapScope(retry.scope,changes,reset);
    this.accepting=false;
  }
  async send(request:string,preset?:PromptPreset,scope?:SelectionScope){
    const doc=this.workspace.getDoc(), profile=this.profile();
    if(!doc||!profile||this.state.running||this.updating||doc.updating)return;
    const previous=this.state.proposals.get(doc.path);
    const effective=effectiveProfile(profile,this.state.chat.overrides);
    const input:RunInput={path:doc.path,document:scope?scope.originalText:doc.textLf,proposal:scope?undefined:previous?(previous.scope?applyScope(doc.textLf,previous.scope,previous.text)??undefined:previous.text):undefined,request,history:[...this.state.chat.messages],profile:effective,params:effectiveParams(effective,this.state.chat.overrides,preset),preset};
    this.appliedPaths.delete(doc.path);const cursor=createCursor(input);this.resumeData.set(doc.path,{input,cursor,scope});
    const user:ChatMessage={id:uuid(),role:'user',text:request,docPath:doc.path,presetId:preset?.id,status:'done'};
    this.set({chat:{...this.state.chat,messages:[...this.state.chat.messages,user]}});
    await this.execute(input,cursor,doc.textLf,scope);
  }
  async continue(path:string){const pending=this.resumeData.get(path),p=this.state.proposals.get(path);if(!pending||!p||this.state.running||this.updating||this.workspace.getDoc()?.updating)return;await this.execute(pending.input,pending.cursor,p.baseText,pending.scope);}
  async retry(messageId:string,removeRejected=false){
    const previous=this.retries.get(messageId);if(!previous||this.state.running||this.updating||this.workspace.getDoc()?.updating)return;
    // Un Riprova si usa una volta: il messaggio fallito resta con il suo errore, senza pulsante.
    this.retries.delete(messageId);this.set({chat:{...this.state.chat,messages:this.state.chat.messages.map(m=>m.id===messageId?{...m,retried:true}:m)}});
    const input={...previous.input,params:{...previous.input.params}};
    if(removeRejected&&previous.rejected){const names:Record<string,keyof typeof input.params>={temperature:'temperature',top_p:'topP',max_tokens:'maxOutputTokens',effort:'effort',reasoning_effort:'effort'};for(const [name,key]of Object.entries(names))if(previous.rejected.includes(name))delete input.params[key];}
    const cursor=createCursor(input);this.resumeData.set(input.path,{input,cursor,scope:previous.scope});await this.execute(input,cursor,previous.baseText,previous.scope);
  }
  private async execute(input:RunInput,cursor:RunCursor,baseText:string,scope?:SelectionScope){
    this.appliedPaths.delete(input.path);
    const createdAt=Date.now(),messageId=uuid(),chatId=this.state.chat.id,previous=this.state.proposals.get(input.path),preserve=previous?.origin==='edited';
    this.retries.set(messageId,{input,baseText,scope});
    const assistant:ChatMessage={id:messageId,role:'assistant',text:'',docPath:input.path,profileName:input.profile.name,model:input.profile.model,status:'streaming',presetId:input.preset?.id};
    this.set({running:{messageId,path:input.path,startedAt:Date.now()},error:null,chat:{...this.state.chat,messages:[...this.state.chat.messages,assistant]}});
    const abort=new AbortController();this.abort=abort;
    let produced=false;
    const usage:{inputTokens?:number;outputTokens?:number}={};
    const updateMessage=(patch:Partial<ChatMessage>)=>{if(this.state.chat.id===chatId)this.set({chat:{...this.state.chat,messages:this.state.chat.messages.map(m=>m.id===messageId?{...m,...patch}:m)}});};
    const proposal=(text:string,status:Proposal['status'],done=cursor.next,total=cursor.chunks.length):Proposal=>({path:input.path,baseText,text,origin:'ai',status,progress:{done,total},scope:this.resumeData.get(input.path)?.scope??scope,presetId:input.preset?.id,snapshotTaken:false,createdAt});
    try{
      const provider=await this.provider(input.profile);
      for await(const event of runRequest(input,provider,abort.signal,cursor)){
        if(event.type==='usage'){if(event.inputTokens!==undefined)usage.inputTokens=event.inputTokens;if(event.outputTokens!==undefined)usage.outputTokens=event.outputTokens;updateMessage({usage:{...usage}});continue;}
        if(event.type==='thinking')continue;
        updateMessage({text:event.comment});
        if(event.text!==null){produced=true;if(preserve&&event.type!=='done')this.set({streamingPreview:event.text});else this.put(proposal(event.text,event.type==='done'?(event.truncated?'truncated':'complete'):'streaming',event.type==='progress'?event.done:cursor.next));}
        if(event.type==='done') {updateMessage({status:'done',summary:input.preset&&event.text!==null?{parts:cursor.chunks.length,originalWords:input.document.trim().split(/\s+/).filter(Boolean).length,proposalWords:event.text.trim().split(/\s+/).filter(Boolean).length}:undefined,warnings:event.text===null?[]:checkProposal(input.document,event.text,input.preset?.builtInId,event.truncated)});}
      }
    }catch(error){
      const aborted=abort.signal.aborted,code=aborted?'aborted':error&&typeof error==='object'&&'code'in error?String(error.code):'unreachable';
      if(code==='paramRejected'){const retry=this.retries.get(messageId);if(retry)retry.rejected=error&&typeof error==='object'&&'detail'in error?String(error.detail):'';}
      updateMessage({status:aborted?'aborted':'error',error:code as AiErrorCode});
      if(!preserve&&produced){const p=this.state.proposals.get(input.path);if(p)this.put({...p,text:input.preset?partialText(cursor):p.text,status:input.preset?'partial':'truncated'});}
    }finally{this.abort=null;this.set({running:null,streamingPreview:null});}
  }
}
