/** Stili calcolati per elemento: chiave = percorso nel DOM (più `::before`/`::after`), valore = proprietà → valore. */
export type StyleDump = Record<string, Record<string, string>>;

/**
 * Gira nella pagina (page.evaluate): deve bastare a sé stessa. Prende <html>, <body> e tutto ciò che sta
 * nel body, compresi dialog e popover nel top layer; i pseudo-elementi solo se generano contenuto.
 */
export function dumpComputedStyles(): StyleDump {
  const out: StyleDump = {};
  // I wrapper dei custom element con `display: contents` non hanno un box: si saltano, così l'albero
  // confrontato è quello di React (spec WC fase 4, host trasparenti).
  const transparent = (node: Element) => node.localName.startsWith('hmd-') && getComputedStyle(node).display === 'contents';
  const flatChildren = (node: Element): Element[] => [...node.children].flatMap((child) => (transparent(child) ? flatChildren(child) : [child]));
  const parentOf = (node: Element): Element | null => {
    let parent = node.parentElement;
    while (parent && transparent(parent)) parent = parent.parentElement;
    return parent;
  };
  const pathOf = (el: Element): string => {
    const parts: string[] = [];
    for (let node: Element | null = el; node && node !== document.documentElement; node = parentOf(node)) {
      const parent = parentOf(node);
      const index = parent ? flatChildren(parent).indexOf(node) : 0;
      parts.unshift(`${node.localName}:${index}`);
    }
    return parts.join('>') || 'html';
  };
  const read = (style: CSSStyleDeclaration) => {
    const props: Record<string, string> = {};
    for (let i = 0; i < style.length; i++) {
      const name = style.item(i);
      props[name] = style.getPropertyValue(name);
    }
    return props;
  };
  const skip = new Set(['script', 'style', 'template', 'link', 'meta']);
  for (const el of [document.documentElement, ...document.querySelectorAll('body, body *')]) {
    if (skip.has(el.localName)) continue;
    if (transparent(el)) continue;
    const path = pathOf(el);
    out[path] = read(getComputedStyle(el));
    for (const pseudo of ['::before', '::after']) {
      const style = getComputedStyle(el, pseudo);
      if (style.content !== 'none' && style.content !== 'normal') out[`${path}${pseudo}`] = read(style);
    }
  }
  return out;
}

/** Ogni differenza come riga leggibile: elementi spariti o nuovi, proprietà con valore diverso. */
export function styleDifferences(before: StyleDump, after: StyleDump): string[] {
  const found: string[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key];
    const b = after[key];
    if (!a || !b) {
      found.push(`${key}: ${a ? 'sparito' : 'nuovo'}`);
      continue;
    }
    for (const prop of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (a[prop] !== b[prop]) found.push(`${key} { ${prop}: ${a[prop]} → ${b[prop]} }`);
    }
  }
  return found;
}
