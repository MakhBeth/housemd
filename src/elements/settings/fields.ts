import { el } from '../../dom/el';

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** `label > span + campo`, come i campi del dettaglio di profili e preset. */
export function field(caption: HTMLSpanElement, control: Field): HTMLLabelElement {
  return el('label', null, caption, control);
}

/** `label > checkbox + testo`. */
export function checkbox(control: HTMLInputElement, text: Text): HTMLLabelElement {
  return el('label', null, control, text);
}

/**
 * Valore di un campo dalla bozza. Un campo con il focus non si riscrive mai (lezione delle fasi 4–6b): il
 * testo che l'utente scrive è già la bozza; si riallinea al `focusout` (per esempio un numero non valido).
 */
export function syncValue(control: Field, value: string): void {
  if (control.value !== value && control.ownerDocument.activeElement !== control) control.value = value;
}

export function syncChecked(control: HTMLInputElement, checked: boolean): void {
  if (control.checked !== checked) control.checked = checked;
}

/**
 * Figli condizionali di `parent` (come `{cond && <x/>}` di React): toglie quelli di `all` non voluti e
 * inserisce i voluti mancanti nell'ordine di `wanted`, senza mai spostare un nodo già al suo posto.
 */
export function showChildren(parent: Element, wanted: readonly Element[], all: readonly Element[]): void {
  for (const node of all) if (!wanted.includes(node) && node.parentNode === parent) node.remove();
  let cursor: Element | null = parent.firstElementChild;
  for (const node of wanted) {
    if (node === cursor) cursor = cursor.nextElementSibling;
    else parent.insertBefore(node, cursor);
  }
}
