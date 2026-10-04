/**
 * jsdom 30 non ha la Popover API (spec WC §8.2): `showPopover`/`hidePopover` segnano lo stato in un
 * attributo di prova. Il comportamento vero (top layer, chiusura alla rimozione) lo verificano gli e2e.
 */
const OPEN = 'data-test-popover-open';

export function installPopoverStub(): void {
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
