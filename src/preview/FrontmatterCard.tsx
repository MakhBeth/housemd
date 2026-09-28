import { useEffect, useState } from 'react';

import type { Locale } from '../i18n/i18n';
import { useI18n } from '../i18n/I18nProvider';
import { toCard, type Frontmatter } from './frontmatter';
import styles from './Preview.module.css';

interface Props {
  frontmatter: Frontmatter;
  resolveImage: (src: string) => Promise<string | null>;
}

function formatCardDate(value: string, locale: Locale): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function FrontmatterCard({ frontmatter, resolveImage }: Props) {
  const { t, locale } = useI18n();
  const card = frontmatter.data ? toCard(frontmatter.data) : null;
  const image = card?.image ?? null;
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setImageUrl(null);
    if (image) void resolveImage(image).then((url) => alive && setImageUrl(url));
    return () => {
      alive = false;
    };
  }, [image, resolveImage]);

  if (frontmatter.error) {
    return (
      <div className={styles.cardError} role="note">
        {t('preview.frontmatterInvalid', { detail: frontmatter.error })}
      </div>
    );
  }
  if (!card) return null;

  return (
    <header className={styles.card}>
      {imageUrl && <img className={styles.cardImage} src={imageUrl} alt="" />}
      {card.title && <p className={styles.cardTitle}>{card.title}</p>}
      {(card.date || card.tags.length > 0) && (
        <p className={styles.cardMeta}>
          {card.date && <time dateTime={card.date}>{formatCardDate(card.date, locale)}</time>}
          {card.tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </p>
      )}
      {card.description && <p className={styles.cardDescription}>{card.description}</p>}
      {card.extra.length > 0 && (
        <dl className={styles.cardExtra}>
          {card.extra.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}
