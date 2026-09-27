/** Ripristino dalla cronologia da applicare nell'editor con una transazione (puro). */
export interface RestoreCommand {
  seq: number;
  textLf: string;
}

/** Al montaggio, il comando già presente è già riflesso in props.text: lo si considera applicato. */
export function initialRestoreSeq(restore: RestoreCommand | null | undefined): number {
  return restore?.seq ?? 0;
}

/** Il comando da applicare adesso, oppure null se è già stato applicato (o c'era già al montaggio). */
export function pendingRestore(appliedSeq: number, restore: RestoreCommand | null | undefined): RestoreCommand | null {
  return restore && restore.seq > appliedSeq ? restore : null;
}
