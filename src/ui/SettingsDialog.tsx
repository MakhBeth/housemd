import { useEffect, useRef, useState } from 'react';

import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '../i18n/i18n';
import { useI18n } from '../i18n/I18nProvider';
import { THEME_PREFS, type ThemePref } from '../theme/theme';
import { AUTOSAVE_MODES, clampDelay, MAX_DELAY_MS, MIN_DELAY_MS, type AutosaveSettings } from '../workspace/autosave';
import styles from './Dialog.module.css';

interface Props {
  theme: ThemePref;
  onTheme: (next: ThemePref) => void;
  autosave: AutosaveSettings;
  onAutosave: (next: AutosaveSettings) => void;
  onSaveAll: () => void;
  onClose: () => void;
}

const lightDismiss = { closedby: 'any' } as Record<string, string>;

export function SettingsDialog({ theme, onTheme, autosave, onAutosave, onSaveAll, onClose }: Props) {
  const { t, locale, setLocale } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [delay, setDelay] = useState(String(autosave.delayMs));

  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  /** Il ritardo si applica all'uscita dal campo (o con Invio), già riportato nel range 500–10000. */
  const commitDelay = () => {
    const next = clampDelay(Number(delay));
    setDelay(String(next));
    if (next !== autosave.delayMs) onAutosave({ ...autosave, delayMs: next });
  };

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      {...lightDismiss}
      onClose={() => {
        // Evento "fantasma" di StrictMode: il dialog è già stato riaperto dal secondo montaggio.
        if (ref.current?.open) return;
        commitDelay();
        onClose();
      }}
      aria-labelledby="settings-title"
    >
      <h2 id="settings-title" className={styles.title}>
        {t('settings.title')}
      </h2>

      <label className={styles.field}>
        <span>{t('settings.language')}</span>
        <select className={styles.input} value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
          {SUPPORTED_LOCALES.map((l) => (
            <option key={l} value={l} lang={l}>
              {LOCALE_NAMES[l]}
            </option>
          ))}
        </select>
      </label>

      <fieldset className={styles.group}>
        <legend>{t('settings.theme')}</legend>
        {THEME_PREFS.map((value) => (
          <label key={value} className={styles.option}>
            <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => onTheme(value)} />
            {t(`theme.option.${value}`)}
          </label>
        ))}
      </fieldset>

      <fieldset className={styles.group}>
        <legend>{t('settings.autosave')}</legend>
        {AUTOSAVE_MODES.map((mode) => (
          <label key={mode} className={styles.option}>
            <input
              type="radio"
              name="autosave"
              value={mode}
              checked={autosave.mode === mode}
              onChange={() => onAutosave({ ...autosave, mode })}
            />
            {t(`settings.autosave.${mode}`)}
          </label>
        ))}
        {autosave.mode === 'afterDelay' && (
          <label className={styles.field}>
            <span>{t('settings.delay')}</span>
            <input
              className={styles.input}
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

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onSaveAll}>
          {t('settings.saveAll')}
        </button>
        <button type="button" className={styles.primary} onClick={() => ref.current?.close()}>
          {t('settings.close')}
        </button>
      </div>
    </dialog>
  );
}
