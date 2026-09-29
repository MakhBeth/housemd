export type ProviderKind = 'ollama' | 'lmstudio' | 'openai-compatible' | 'anthropic' | 'claude-code';
export interface SyncRecord { id: string; updatedAt: number; updatedBy: string }
export interface GenParams { temperature?: number; topP?: number; maxOutputTokens?: number; effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'; chunkChars?: number }
export type ProfileOverrides = Partial<GenParams> & { model?: string; contextTokens?: number | null };
export interface ModelProfile extends SyncRecord { name: string; kind: ProviderKind; baseUrl: string; model: string; secretId: string | null; params: GenParams; contextTokens: number | null }
export interface StoredSecret { id: string; value: string; binding: { kind: ProviderKind; origin: string } }
export interface PromptPreset extends SyncRecord { builtInId?: 'sbobina' | 'traduci' | 'consecutio'; name: string; instructions: string; variables?: { targetLanguage?: string }; view: 'diff' | 'side'; strategy: 'whole' | 'chunked'; frontmatter: 'keep' | 'include'; params?: Partial<GenParams>; order: number; hidden: boolean }
export type AiErrorCode = 'unreachable' | 'bridgeDown' | 'bridgeIncompatible' | 'secretBinding' | 'scopeLost' | 'bridgeCli' | 'originRejected' | 'unauthorized' | 'forbidden' | 'notFound' | 'noModel' | 'rateLimited' | 'paramRejected' | 'tooLong' | 'refused' | 'truncated' | 'timeout' | 'server' | 'badStream' | 'aborted' | 'syncInvalid' | 'syncPermission' | 'syncBackupFailed' | 'syncWriteFailed' | 'syncLocked' | 'syncStale' | 'aiPendingUpdate';
export interface CheckWarning { code: string; detail?: string }
export interface ChatMessage { id: string; role: 'user' | 'assistant'; text: string; docPath: string | null; presetId?: string; profileName?: string; model?: string; usage?: { inputTokens?: number; outputTokens?: number }; status: 'streaming' | 'done' | 'aborted' | 'error'; error?: AiErrorCode; warnings?: CheckWarning[]; summary?: { parts:number; originalWords:number; proposalWords:number } }
export interface AiChat { id: string; messages: ChatMessage[]; overrides: ProfileOverrides }
export interface SelectionScope { originalText: string; from: number; to: number; status: 'valid' | 'lost' }
export interface Proposal { path: string; baseText: string; text: string; origin: 'ai' | 'edited'; status: 'streaming' | 'complete' | 'partial' | 'truncated'; progress?: { done: number; total: number }; scope?: SelectionScope; presetId?: string; snapshotTaken: boolean; createdAt: number }
export interface ChatRequest { model: string; system: string; messages: Array<{ role: 'user' | 'assistant'; text: string }>; params: GenParams }
export type ChatEvent = { type: 'text'; text: string } | { type: 'thinking' } | { type: 'usage'; inputTokens?: number; outputTokens?: number } | { type: 'done'; stop: 'end' | 'length' | 'refusal' | 'other' };
export interface ModelOption { value: string; label: string; contextTokens?: number }
export interface ChatProvider { testConnection?(signal: AbortSignal): Promise<void>; stream(req: ChatRequest, signal: AbortSignal): AsyncIterable<ChatEvent>; listModels(signal: AbortSignal): Promise<ModelOption[] | null> }
