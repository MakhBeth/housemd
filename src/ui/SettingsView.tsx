// src/ui/SettingsView.tsx
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AiController } from '../ai/aiController';
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '../i18n/i18n';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';
import { formatRoute, type SettingsSection } from '../lib/route';
import { clampTextWidth, MAX_TEXT_WIDTH, MIN_TEXT_WIDTH, TEXT_WIDTH_PANES, type TextWidth, type TextWidthPane } from '../lib/textWidth';
import { THEME_PREFS, type ThemePref } from '../theme/theme';
import { AUTOSAVE_MODES, clampDelay, MAX_DELAY_MS, MIN_DELAY_MS, type AutosaveSettings } from '../workspace/autosave';
import { AiPresetsSection } from './ai/settings/AiPresetsSection';
import { AiProfilesSection } from './ai/settings/AiProfilesSection';
import { AiSyncSection, type SyncBinding } from './ai/settings/AiSyncSection';
import { ConfirmDialog } from './ConfirmDialog';
import dialog from './Dialog.module.css';
import { Icon } from './Icon';
import styles from './SettingsView.module.css';

interface Props {
  section: SettingsSection;
  onSection: (section: SettingsSection) => void;
  onClose: () => void;
  /** Bozze aperte in qualche sezione: WorkspaceView le usa per bloccare Indietro. */
  onDirtyChange: (dirty: boolean) => void;
  /** Incrementato quando Indietro è stato bloccato: chiude passando dalla conferma. */
  closeRequest: number;
  ai: AiController | null;
  syncBinding: SyncBinding;
  theme: ThemePref;
  onTheme: (next: ThemePref) => void;
  autosave: AutosaveSettings;
  onAutosave: (next: AutosaveSettings) => void;
  textWidth: TextWidth;
  onTextWidth: (next: TextWidth) => void;
  onSaveAll: () => void;
}

const LABELS: Record<SettingsSection, MessageKey> = {
  general: 'settings.general',
  'ai-profiles': 'settings.aiProfiles',
  'ai-presets': 'settings.aiPresets',
  'ai-sync': 'settings.aiSync',
};

export function SettingsView({ section, onSection, onClose, onDirtyChange, closeRequest, ai, syncBinding, theme, onTheme, autosave, onAutosave, textWidth, onTextWidth, onSaveAll }: Props) {
  const { t, locale, setLocale } = useI18n();
  const [delay, setDelay] = useState(String(autosave.delayMs));
  // Campo vuoto = nessun limite.
  const widthText = (pane: TextWidthPane) => String(textWidth[pane] ?? '');
  const [widths, setWidths] = useState<Record<TextWidthPane, string>>(() => ({ editor: widthText('editor'), preview: widthText('preview') }));
  const [dirty, setDirty] = useState<Set<SettingsSection>>(() => new Set());
  const [confirmClose, setConfirmClose] = useState(false);
  const [visible, setVisible] = useState<SettingsSection>(section);
  const content = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const sections: SettingsSection[] = ai ? ['general', 'ai-profiles', 'ai-presets', 'ai-sync'] : ['general'];

  const markDirty = (id: SettingsSection) => (value: boolean) =>
    setDirty((prev) => {
      if (prev.has(id) === value) return prev;
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });

  // Callback stabili: useDraft le mette nelle dipendenze dei suoi effetti.
  const profilesDirty = useCallback(markDirty('ai-profiles'), []);
  const presetsDirty = useCallback(markDirty('ai-presets'), []);

  const commitWidth = (pane: TextWidthPane) => {
    const next = clampTextWidth(widths[pane]);
    setWidths((prev) => ({ ...prev, [pane]: String(next ?? '') }));
    if (next !== textWidth[pane]) onTextWidth({ ...textWidth, [pane]: next });
  };

  const commitDelay = () => {
    const next = clampDelay(Number(delay));
    setDelay(String(next));
    if (next !== autosave.delayMs) onAutosave({ ...autosave, delayMs: next });
  };
  const close = () => {
    commitDelay();
    if (dirty.size > 0) setConfirmClose(true);
    else onClose();
  };

  // Aprendo, il focus va sul titolo: il resto dell'app è inerte e il focus precedente andrebbe perso.
  useEffect(() => title.current?.focus({ preventScroll: true }), []);

  useEffect(() => onDirtyChange(dirty.size > 0), [dirty, onDirtyChange]);
  // Il contatore vive in WorkspaceView e può essere già > 0 al montaggio: si reagisce solo ai cambi.
  const seenRequest = useRef(closeRequest);
  useEffect(() => {
    if (closeRequest === seenRequest.current) return;
    seenRequest.current = closeRequest;
    close();
    // Solo al cambio del contatore: close legge lo stato corrente a ogni render.
  }, [closeRequest]);

  // Entrando (o cambiando sezione dall'hash) si scorre alla sezione richiesta; `ai` nelle dipendenze
  // perché con un link diretto a una sezione AI le sezioni compaiono solo quando il controller è pronto.
  useEffect(() => {
    content.current?.querySelector(`#settings-${section}`)?.scrollIntoView({ block: 'start' });
  }, [section, ai]);

  // La voce dell'indice segue la sezione visibile mentre si scorre.
  useEffect(() => {
    const root = content.current!;
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setVisible(top.target.id.replace('settings-', '') as SettingsSection);
      },
      { root, rootMargin: '0px 0px -60% 0px' },
    );
    root.querySelectorAll('section[id^="settings-"]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ai]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className={styles.view} role="region" aria-label={t('settings.title')}>
      <nav className={styles.nav} aria-label={t('settings.sections')}>
        <div className={styles.navHeader}>
          <button type="button" className={`${styles.iconButton} tooltip`} aria-label={t('settings.close')} data-tooltip={t('settings.close')} onClick={close}>
            <Icon name="close" />
          </button>
          <h1 ref={title} tabIndex={-1}>
            {t('settings.title')}
          </h1>
        </div>
        {sections.map((id) => (
          <a
            key={id}
            className={styles.navLink}
            href={formatRoute({ view: 'settings', section: id })}
            aria-current={visible === id ? 'true' : undefined}
            onClick={(e) => {
              e.preventDefault();
              onSection(id);
              // Se la sezione è già quella della rotta l'effetto non riparte: si scorre direttamente.
              content.current?.querySelector(`#settings-${id}`)?.scrollIntoView({ block: 'start' });
            }}
          >
            {t(LABELS[id])}
          </a>
        ))}
      </nav>
      <div ref={content} className={styles.content}>
        <section id="settings-general" className={styles.section}>
          <h2>{t('settings.general')}</h2>
          <label className={dialog.field}>
            <span>{t('settings.language')}</span>
            <select className={dialog.input} value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
              {SUPPORTED_LOCALES.map((l) => (
                <option key={l} value={l} lang={l}>
                  {LOCALE_NAMES[l]}
                </option>
              ))}
            </select>
          </label>
          <fieldset className={dialog.group}>
            <legend>{t('settings.theme')}</legend>
            {THEME_PREFS.map((value) => (
              <label key={value} className={dialog.option}>
                <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => onTheme(value)} />
                {t(`theme.option.${value}`)}
              </label>
            ))}
          </fieldset>
          <fieldset className={dialog.group}>
            <legend>{t('settings.autosave')}</legend>
            {AUTOSAVE_MODES.map((mode) => (
              <label key={mode} className={dialog.option}>
                <input type="radio" name="autosave" value={mode} checked={autosave.mode === mode} onChange={() => onAutosave({ ...autosave, mode })} />
                {t(`settings.autosave.${mode}`)}
              </label>
            ))}
            {autosave.mode === 'afterDelay' && (
              <label className={dialog.field}>
                <span>{t('settings.delay')}</span>
                <input
                  className={dialog.input}
                  type="number"
                  min={MIN_DELAY_MS}
                  max={MAX_DELAY_MS}
                  step={100}
                  value={delay}
                  onChange={(e) => setDelay(e.target.value)}
                  onBlur={commitDelay}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitDelay();
                  }}
                />
              </label>
            )}
          </fieldset>
          <fieldset className={dialog.group}>
            <legend>{t('settings.textWidth')}</legend>
            {TEXT_WIDTH_PANES.map((pane) => (
              <label key={pane} className={dialog.field}>
                <span>{t(`settings.textWidth.${pane}`)}</span>
                <input
                  className={dialog.input}
                  type="number"
                  min={MIN_TEXT_WIDTH}
                  max={MAX_TEXT_WIDTH}
                  step={1}
                  placeholder={t('settings.textWidth.none')}
                  value={widths[pane]}
                  onChange={(e) => setWidths((prev) => ({ ...prev, [pane]: e.target.value }))}
                  onBlur={() => commitWidth(pane)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitWidth(pane);
                  }}
                />
              </label>
            ))}
            <p className={styles.hint}>{t('settings.textWidth.hint', { min: MIN_TEXT_WIDTH, max: MAX_TEXT_WIDTH })}</p>
          </fieldset>
          <button type="button" className={dialog.secondary} onClick={onSaveAll}>
            {t('settings.saveAll')}
          </button>
        </section>
        {ai && (
          <>
            <section id="settings-ai-profiles" className={styles.section}>
              <h2>{t('settings.aiProfiles')}</h2>
              <AiProfilesSection controller={ai} onDirty={profilesDirty} />
            </section>
            <section id="settings-ai-presets" className={styles.section}>
              <h2>{t('settings.aiPresets')}</h2>
              <AiPresetsSection controller={ai} onDirty={presetsDirty} />
            </section>
            <section id="settings-ai-sync" className={styles.section}>
              <h2>{t('settings.aiSync')}</h2>
              <AiSyncSection controller={ai} binding={syncBinding} />
            </section>
          </>
        )}
      </div>
      {confirmClose && (
        <ConfirmDialog
          title={t('ai.unsavedTitle')}
          message={t('ai.unsavedMessage')}
          confirmLabel={t('ai.discardChanges')}
          onConfirm={() => {
            setConfirmClose(false);
            // Prima di uscire: altrimenti la guardia di useRoute bloccherebbe di nuovo la cronologia.
            onDirtyChange(false);
            onClose();
          }}
          onCancel={() => setConfirmClose(false)}
        />
      )}
    </div>
  );
}
