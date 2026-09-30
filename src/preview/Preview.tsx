import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
  type MouseEvent, type UIEvent,
} from 'react';

import { safeRender, allowedImage, resourceHost, type UntrustedOptions } from '../ai/safeRender';
import type { HouseConfig } from '../config/config';
import { resolveImageSrc } from '../config/images';
import { useT } from '../i18n/I18nProvider';
import { isMarkdown, normalizePath, resolveRelative } from '../lib/paths';
import { FrontmatterCard } from './FrontmatterCard';
import { splitFrontmatter, toCard, type SplitDocument } from './frontmatter';
import { highlightTerms } from './highlight';
import { ImageUrlCache } from './imageCache';
import { LINE_CLASS_PREFIX, renderMarkdown, sourceLineOf, wikiTargetOfHref } from './render';
import { setSafeHTML } from './sanitize';
import { lineForOffset, offsetForLine, type Anchor } from './scrollSync';
import styles from './Preview.module.css';

export interface PreviewHandle {
  scrollToLine(line: number): void;
}

export interface PreviewProps {
  text: string;
  untrusted?: UntrustedOptions;
  path: string;
  files: string[];
  config: HouseConfig;
  readBlob: (path: string) => Promise<Blob>;
  highlight: string[];
  onTopLine: (line: number) => void;
  onOpenWiki: (target: string) => void;
  onOpenPath: (path: string) => void;
}

export const PREVIEW_DEBOUNCE_MS = 150;
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

export const Preview = forwardRef<PreviewHandle, PreviewProps>(function Preview(props, ref) {
  const { text, path, files, config, readBlob, highlight, onTopLine, onOpenWiki, onOpenPath } = props;
  const t = useT();
  const [approved, setApproved] = useState<Set<string>>(new Set());
  useEffect(() => setApproved(new Set()), [path]);
  const untrusted = useMemo(() => props.untrusted ? { ...props.untrusted, allowedUrls: new Set([...props.untrusted.allowedUrls, ...approved]), isLocal: (src: string) => !!resolveImageSrc(src, path, config), imageLabel: (host: string) => t('ai.loadImage', { host }) } : undefined, [props.untrusted, approved, path, config, t]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const anchors = useRef<Anchor[] | null>(null);
  const suppressUntil = useRef(0);
  const [doc, setDoc] = useState<{ path: string; split: SplitDocument }>(() => ({ path, split: splitFrontmatter(text) }));

  const cache = useMemo(() => new ImageUrlCache(readBlob), [readBlob]);
  useEffect(() => () => void cache.clear(), [cache]);

  // Cambio file: subito. Modifiche al testo: con debounce.
  useEffect(() => {
    if (doc.path !== path) {
      setDoc({ path, split: splitFrontmatter(text) });
      return;
    }
    const timer = setTimeout(() => setDoc({ path, split: splitFrontmatter(text) }), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, path]);

  const resolveImage = useCallback(
    async (src: string) => {
      const local = resolveImageSrc(src, doc.path, config);
      if (untrusted && !allowedImage(src, untrusted)) return null;
      return local ? cache.get(local) : src;
    },
    [doc.path, config, cache, untrusted],
  );

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    let cancelled = false;
    const { split } = doc;
    const html = untrusted ? safeRender(split.body, untrusted, split.bodyLine) : renderMarkdown(split.body, { currentPath: doc.path, files, lineOffset: split.bodyLine });
    void (async () => {
      await setSafeHTML(body, html);
      if (cancelled) return;
      anchors.current = null;

      const used: string[] = [];
      const cardImage = split.frontmatter?.data ? toCard(split.frontmatter.data).image : null;
      const cardLocal = cardImage ? resolveImageSrc(cardImage, doc.path, config) : null;
      if (cardLocal) used.push(cardLocal);
      for (const img of body.querySelectorAll('img')) {
        const src = img.getAttribute('data-local-src') || img.getAttribute('src');
        const local = src ? resolveImageSrc(src, doc.path, config) : null;
        if (!local) continue;
        used.push(local);
        img.removeAttribute('src');
        void cache.get(local).then((url) => {
          if (cancelled) return;
          if (url) {
            img.src = url;
          } else {
            img.classList.add(styles.missingImage);
            img.title = t('preview.imageMissing', { path: local });
          }
        });
      }
      void cache.retain(used);

      for (const a of body.querySelectorAll('a[href]')) {
        if (EXTERNAL.test(a.getAttribute('href') ?? '')) {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        }
      }
      highlightTerms(body, highlight);
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, files, config, cache, highlight, t, untrusted]);

  // Le posizioni cambiano con il ridimensionamento e il caricamento delle immagini.
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      anchors.current = null;
    });
    observer.observe(bodyRef.current!);
    return () => observer.disconnect();
  }, []);

  const getAnchors = useCallback((): Anchor[] => {
    if (anchors.current) return anchors.current;
    const scroller = scrollRef.current!;
    const base = scroller.getBoundingClientRect().top - scroller.scrollTop;
    const list: Anchor[] = [{ line: 0, top: 0 }];
    for (const el of scroller.querySelectorAll<HTMLElement>(`[class*="${LINE_CLASS_PREFIX}"]`)) {
      const line = sourceLineOf(el);
      if (line !== null) list.push({ line, top: el.getBoundingClientRect().top - base });
    }
    list.sort((a, b) => a.line - b.line || a.top - b.top);
    anchors.current = list.filter((a, i) => i === 0 || a.line !== list[i - 1].line);
    return anchors.current;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      scrollToLine(line: number) {
        const scroller = scrollRef.current;
        if (!scroller) return;
        suppressUntil.current = performance.now() + 150;
        scroller.scrollTop = offsetForLine(getAnchors(), line);
      },
    }),
    [getAnchors],
  );

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    if (performance.now() < suppressUntil.current) return;
    onTopLine(lineForOffset(getAnchors(), event.currentTarget.scrollTop));
  };

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const blocked = (event.target as Element).closest<HTMLElement>('[data-ai-image]');
    if (blocked) { const src = blocked.dataset.aiImage; if (src) setApproved(previous => new Set([...previous, src])); return; }
    const link = (event.target as Element).closest('a');
    if (!link) return;
    const href = link.getAttribute('href') ?? '';
    const wiki = wikiTargetOfHref(href);
    if (wiki !== null) {
      event.preventDefault();
      onOpenWiki(wiki);
      return;
    }
    if (href.startsWith('#') || EXTERNAL.test(href)) return;
    event.preventDefault();
    let clean = href.replace(/[?#].*$/, '');
    try {
      clean = decodeURIComponent(clean);
    } catch {
      // lascia il link così com'è
    }
    const target = clean.startsWith('/') ? normalizePath(clean) : resolveRelative(doc.path, clean);
    if (isMarkdown(target)) onOpenPath(target);
  };

  return (
    <div ref={scrollRef} className={styles.scroller} onScroll={onScroll} onClick={onClick}>
      <article className={styles.prose}>
        {doc.split.frontmatter && <FrontmatterCard frontmatter={doc.split.frontmatter} resolveImage={resolveImage} blockedLabel={untrusted ? (src) => allowedImage(src, untrusted) ? null : t('ai.loadImage', { host: resourceHost(src) }) : undefined} onAllowImage={(src) => setApproved(previous => new Set([...previous, src]))} />}
        <div ref={bodyRef} />
      </article>
    </div>
  );
});
