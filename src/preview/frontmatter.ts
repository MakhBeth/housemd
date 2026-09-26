import { parse as parseYaml } from 'yaml';

import { basename, stripMd } from '../lib/paths';

export interface Frontmatter {
  raw: string;
  data: Record<string, unknown> | null;
  error: string | null;
}

export interface SplitDocument {
  frontmatter: Frontmatter | null;
  body: string;
  /** Indice 0-based della prima riga del corpo nel file originale. */
  bodyLine: number;
}

/** Separa il frontmatter YAML iniziale (tra due righe "---") dal corpo. Non modifica il testo. */
export function splitFrontmatter(text: string): SplitDocument {
  const src = text.startsWith('﻿') ? text.slice(1) : text;
  const lines = src.split(/\r?\n/);
  if (lines[0]?.trimEnd() !== '---') return { frontmatter: null, body: src, bodyLine: 0 };
  const end = lines.findIndex((line, i) => i > 0 && (line.trimEnd() === '---' || line.trimEnd() === '...'));
  if (end === -1) return { frontmatter: null, body: src, bodyLine: 0 };

  const raw = lines.slice(1, end).join('\n');
  let data: Record<string, unknown> | null = null;
  let error: string | null = null;
  try {
    const parsed: unknown = parseYaml(raw);
    if (parsed === null || parsed === undefined) data = {};
    else if (typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
    else error = 'Il frontmatter non è un oggetto YAML';
  } catch (err) {
    error = (err as Error).message;
  }
  return { frontmatter: { raw, data, error }, body: lines.slice(end + 1).join('\n'), bodyLine: end + 1 };
}

export interface FrontmatterCardData {
  title: string | null;
  date: string | null;
  description: string | null;
  image: string | null;
  tags: string[];
  extra: [string, string][];
}

const KNOWN = new Set(['title', 'date', 'description', 'image', 'tags']);

function scalar(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return null;
}

function display(value: unknown): string {
  return scalar(value) ?? JSON.stringify(value);
}

export function toCard(data: Record<string, unknown>): FrontmatterCardData {
  const rawTags = data.tags;
  const tags = Array.isArray(rawTags)
    ? rawTags.map(display)
    : typeof rawTags === 'string'
      ? rawTags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];
  return {
    title: scalar(data.title),
    date: scalar(data.date),
    description: scalar(data.description),
    image: scalar(data.image),
    tags,
    extra: Object.entries(data)
      .filter(([key]) => !KNOWN.has(key))
      .map(([key, value]) => [key, display(value)]),
  };
}

/** Titolo mostrato per un documento: frontmatter, poi primo "# titolo", poi nome del file. */
export function documentTitle(path: string, text: string): string {
  const { frontmatter, body } = splitFrontmatter(text);
  const fmTitle = frontmatter?.data ? scalar(frontmatter.data.title)?.trim() : null;
  if (fmTitle) return fmTitle;
  const heading = /^#\s+(.+?)\s*#*\s*$/m.exec(body);
  if (heading) return heading[1];
  return stripMd(basename(path));
}
