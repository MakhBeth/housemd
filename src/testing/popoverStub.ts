/**
 * jsdom 30 non ha la Popover API (spec WC §8.2): `showPopover`/`hidePopover` segnano lo stato in un
 * attributo di prova, e `matches(':popover-open')` lo legge da lì (gli altri selettori passano a jsdom).
 * Il comportamento vero (top layer, chiusura alla rimozione) lo verificano gli e2e.
 */
const OPEN = 'data-test-popover-open';
const matches = Element.prototype.matches;

export function installPopoverStub(): void {
  Object.assign(Element.prototype, {
    matches(this: Element, selectors: string): boolean {
      return selectors === ':popover-open' ? this.hasAttribute(OPEN) : matches.call(this, selectors);
    },
  });
  Object.assign(HTMLElement.prototype, {
    showPopover(this: HTMLElement) {
      if (!this.isConnected) throw new DOMException('elemento non collegato', 'InvalidStateError');
      this.setAttribute(OPEN, '');
    },
    hidePopover(this: HTMLElement) {
      if (!this.isConnected) throw new DOMException('elemento non collegato', 'InvalidStateError');
      this.removeAttribute(OPEN);
    },
  });
}

export function isPopoverOpen(el: Element): boolean {
  return el.hasAttribute(OPEN);
}
