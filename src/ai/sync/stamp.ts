/** Una modifica supera sempre la versione da cui deriva, anche dal futuro. */
export const nextStamp = (now: number, previous = 0): number => Math.max(now, previous + 1);
