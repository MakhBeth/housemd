import type { AiController } from '../../ai/aiController';
import { presetLabel } from '../../ai/presetName';
import { sameRange, selectionLabel, type TextRange } from '../../ai/selectionChip';
import type { PromptPreset } from '../../ai/types';
import type { I18nStore } from '../../state/i18nStore';
import type { ModelChipController } from './modelChipView';

/** Quello che il composer usa del controller: quello del chip del modello, più invio e stop. */
export type ComposerController = ModelChipController & Pick<AiController, 'send' | 'stop'>;

/**
 * Testo del chip della selezione, o null se il chip non c'è: nessuna selezione, solo spazi, oppure la
 * stessa selezione ignorata con ✕ (una selezione diversa lo fa ricomparire).
 */
export function selectionChipText(t: I18nStore['t'], text: string, selection: TextRange | null, ignored: TextRange | null): string | null {
  const label = selectionLabel(text, selection);
  if (label === null || sameRange(ignored, selection)) return null;
  return label.lines > 1 ? t('ai.selectionLines', { count: label.lines }) : t('ai.selectionChars', { count: label.chars });
}

/**
 * Messaggio da inviare, come `send` di Composer.tsx: l'etichetta del preset se c'è (un id sconosciuto vale
 * come nessun preset), altrimenti il testo scritto senza spazi ai bordi; null se non c'è niente da inviare.
 */
export function outgoing(request: string, preset: PromptPreset | undefined, t: I18nStore['t']): string | null {
  const message = preset ? presetLabel(preset, t) : request.trim();
  return message || null;
}

export interface SendButton {
  label: 'ai.send' | 'ai.stop';
  icon: 'send' | 'stop';
  disabled: boolean;
}

/** Il pulsante della riga: Stop durante la generazione, altrimenti Invia (spento senza testo o senza profilo). */
export function sendButton(running: boolean, request: string, hasProfile: boolean): SendButton {
  if (running) return { label: 'ai.stop', icon: 'stop', disabled: false };
  return { label: 'ai.send', icon: 'send', disabled: !request.trim() || !hasProfile };
}
