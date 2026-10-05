/**
 * jsdom 30 non ha showModal/close/returnValue né i comandi `command="close"` (spec WC §8.2): questo stub
 * li imita quanto basta ai test. `close` arriva in un task successivo, come nel browser. Top layer,
 * inerzia del resto della pagina, `closedby` e ripristino del focus li verificano gli e2e.
 */
const values = new WeakMap<HTMLDialogElement, string>();
let installed = false;

export function installDialogStub(): void {
  if (installed) return;
  installed = true;
  const proto = window.HTMLDialogElement.prototype;
  Object.defineProperty(proto, 'returnValue', {
    configurable: true,
    get(this: HTMLDialogElement) {
      return values.get(this) ?? '';
    },
    set(this: HTMLDialogElement, value: string) {
      values.set(this, String(value));
    },
  });
  Object.assign(proto, {
    showModal(this: HTMLDialogElement) {
      if (this.open) throw new DOMException('dialog già aperto', 'InvalidStateError');
      if (!this.isConnected) throw new DOMException('dialog non collegato', 'InvalidStateError');
      this.setAttribute('open', '');
      this.querySelector<HTMLElement>('[autofocus]')?.focus();
    },
    close(this: HTMLDialogElement, value?: string) {
      if (!this.open) return;
      this.removeAttribute('open');
      if (value !== undefined) this.returnValue = value;
      setTimeout(() => this.dispatchEvent(new Event('close')));
    },
  });
  // Invoker Commands: un clic su <button command="close" commandfor="id"> chiude quel dialog.
  document.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest?.('button[command="close"][commandfor]');
    if (!button) return;
    const target = document.getElementById(button.getAttribute('commandfor')!);
    if (target?.localName === 'dialog') (target as HTMLDialogElement).close((button as HTMLButtonElement).value);
  });
}
