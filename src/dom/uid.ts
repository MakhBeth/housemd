let counter = 0;

/** Id unico nel documento per `aria-*`, `for`, `popovertarget`, `commandfor` (era useId di React). */
export function uid(prefix: string, doc: Document = document): string {
  let id: string;
  do id = `${prefix}-${++counter}`;
  while (doc.getElementById(id));
  return id;
}
