/** Aspetta che `check` diventi vera (render asincroni: setSafeHTML, immagini, debounce); errore dopo `ms`. */
export async function waitFor(check: () => boolean, ms = 2000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('waitFor: la condizione non è mai diventata vera');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
