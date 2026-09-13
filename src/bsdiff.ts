/* eslint-disable no-bitwise */
import { createHash } from 'node:crypto';

/**
 * Port of Colin Percival's bsdiff 4.3 (BSD-2-Clause) using the NITROBSD container:
 * "NITROBSD" | ctrlLen i32 | diffLen i32 | newSize i32 | sha256(old) | sha256(new) | ctrl | diff | extra
 * Blocks are stored raw; the enclosing zip provides compression.
 */
export const PATCH_HEADER_SIZE = 84;
const MAGIC = new Uint8Array([78, 73, 84, 82, 79, 66, 83, 68]); // "NITROBSD"
const MAX_SIZE = 256 * 1024 * 1024;

export function sha256(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(data).digest());
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function split(
  I: Int32Array,
  V: Int32Array,
  start: number,
  len: number,
  h: number
): void {
  if (len < 16) {
    for (let k = start; k < start + len; ) {
      let j = 1;
      let x = V[I[k]! + h]!;
      for (let i = 1; k + i < start + len; i++) {
        const v = V[I[k + i]! + h]!;
        if (v < x) {
          x = v;
          j = 0;
        }
        if (v === x) {
          const tmp = I[k + j]!;
          I[k + j] = I[k + i]!;
          I[k + i] = tmp;
          j++;
        }
      }
      for (let i = 0; i < j; i++) V[I[k + i]!] = k + j - 1;
      if (j === 1) I[k] = -1;
      k += j;
    }
    return;
  }

  const x = V[I[start + (len >> 1)]! + h]!;
  let jj = 0;
  let kk = 0;
  for (let i = start; i < start + len; i++) {
    const v = V[I[i]! + h]!;
    if (v < x) jj++;
    if (v === x) kk++;
  }
  jj += start;
  kk += jj;

  let i = start;
  let j = 0;
  let k = 0;
  while (i < jj) {
    const v = V[I[i]! + h]!;
    if (v < x) {
      i++;
    } else if (v === x) {
      const tmp = I[i]!;
      I[i] = I[jj + j]!;
      I[jj + j] = tmp;
      j++;
    } else {
      const tmp = I[i]!;
      I[i] = I[kk + k]!;
      I[kk + k] = tmp;
      k++;
    }
  }
  while (jj + j < kk) {
    if (V[I[jj + j]! + h]! === x) {
      j++;
    } else {
      const tmp = I[jj + j]!;
      I[jj + j] = I[kk + k]!;
      I[kk + k] = tmp;
      k++;
    }
  }

  if (jj > start) split(I, V, start, jj - start, h);
  for (let m = 0; m < kk - jj; m++) V[I[jj + m]!] = kk - 1;
  if (jj === kk - 1) I[jj] = -1;
  if (start + len > kk) split(I, V, kk, start + len - kk, h);
}

function qsufsort(I: Int32Array, V: Int32Array, old: Uint8Array): void {
  const n = old.length;
  const buckets = new Int32Array(256);
  for (let i = 0; i < n; i++) buckets[old[i]!] = buckets[old[i]!]! + 1;
  for (let i = 1; i < 256; i++) buckets[i] = buckets[i]! + buckets[i - 1]!;
  for (let i = 255; i > 0; i--) buckets[i] = buckets[i - 1]!;
  buckets[0] = 0;

  for (let i = 0; i < n; i++) {
    const b = old[i]!;
    buckets[b] = buckets[b]! + 1;
    I[buckets[b]!] = i;
  }
  I[0] = n;
  for (let i = 0; i < n; i++) V[i] = buckets[old[i]!]!;
  V[n] = 0;
  for (let i = 1; i < 256; i++) {
    if (buckets[i] === buckets[i - 1]! + 1) I[buckets[i]!] = -1;
  }
  I[0] = -1;

  for (let h = 1; I[0] !== -(n + 1); h += h) {
    let len = 0;
    let i = 0;
    while (i < n + 1) {
      if (I[i]! < 0) {
        len -= I[i]!;
        i -= I[i]!;
      } else {
        if (len) I[i - len] = -len;
        len = V[I[i]!]! + 1 - i;
        split(I, V, i, len, h);
        i += len;
        len = 0;
      }
    }
    if (len) I[i - len] = -len;
  }

  for (let i = 0; i < n + 1; i++) I[V[i]!] = i;
}

function matchlen(
  old: Uint8Array,
  op: number,
  nw: Uint8Array,
  np: number
): number {
  let i = 0;
  while (
    op + i < old.length &&
    np + i < nw.length &&
    old[op + i] === nw[np + i]
  )
    i++;
  return i;
}

let searchPos = 0;

function search(
  I: Int32Array,
  old: Uint8Array,
  nw: Uint8Array,
  np: number
): number {
  let st = 0;
  let en = old.length;
  while (en - st >= 2) {
    const x = st + ((en - st) >> 1);
    const op = I[x]!;
    const n = Math.min(old.length - op, nw.length - np);
    let cmp = 0;
    for (let i = 0; i < n; i++) {
      const d = old[op + i]! - nw[np + i]!;
      if (d !== 0) {
        cmp = d;
        break;
      }
    }
    if (cmp < 0) st = x;
    else en = x;
  }
  const x = matchlen(old, I[st]!, nw, np);
  const y = matchlen(old, I[en]!, nw, np);
  if (x > y) {
    searchPos = I[st]!;
    return x;
  }
  searchPos = I[en]!;
  return y;
}

function encodePatch(
  ctrl: number[],
  db: Uint8Array,
  eb: Uint8Array,
  newSize: number,
  oldSha: Uint8Array,
  newSha: Uint8Array
): Uint8Array {
  const ctrlLen = ctrl.length * 4;
  const out = new Uint8Array(
    PATCH_HEADER_SIZE + ctrlLen + db.length + eb.length
  );
  const view = new DataView(out.buffer);
  out.set(MAGIC, 0);
  view.setInt32(8, ctrlLen, true);
  view.setInt32(12, db.length, true);
  view.setInt32(16, newSize, true);
  out.set(oldSha, 20);
  out.set(newSha, 52);
  let off = PATCH_HEADER_SIZE;
  for (const v of ctrl) {
    view.setInt32(off, v, true);
    off += 4;
  }
  out.set(db, off);
  out.set(eb, off + db.length);
  return out;
}

/**
 * Computes a NITROBSD patch that rebuilds `nw` from `old`.
 */
export function bsdiff(old: Uint8Array, nw: Uint8Array): Uint8Array {
  if (old.length > MAX_SIZE || nw.length > MAX_SIZE) {
    throw new Error(
      `bsdiff: inputs larger than ${MAX_SIZE} bytes are not supported`
    );
  }
  const oldsize = old.length;
  const newsize = nw.length;
  const I = new Int32Array(oldsize + 1);
  const V = new Int32Array(oldsize + 1);
  qsufsort(I, V, old);

  const db = new Uint8Array(newsize + 1);
  const eb = new Uint8Array(newsize + 1);
  let dblen = 0;
  let eblen = 0;
  const ctrl: number[] = [];

  let scan = 0;
  let len = 0;
  let pos = 0;
  let lastscan = 0;
  let lastpos = 0;
  let lastoffset = 0;

  while (scan < newsize) {
    let oldscore = 0;
    scan += len;
    let scsc = scan;
    for (; scan < newsize; scan++) {
      len = search(I, old, nw, scan);
      pos = searchPos;
      for (; scsc < scan + len; scsc++) {
        if (scsc + lastoffset < oldsize && old[scsc + lastoffset] === nw[scsc])
          oldscore++;
      }
      if ((len === oldscore && len !== 0) || len > oldscore + 8) break;
      if (scan + lastoffset < oldsize && old[scan + lastoffset] === nw[scan])
        oldscore--;
    }

    if (len !== oldscore || scan === newsize) {
      let s = 0;
      let Sf = 0;
      let lenf = 0;
      for (let i = 0; lastscan + i < scan && lastpos + i < oldsize; ) {
        if (old[lastpos + i] === nw[lastscan + i]) s++;
        i++;
        if (s * 2 - i > Sf * 2 - lenf) {
          Sf = s;
          lenf = i;
        }
      }

      let lenb = 0;
      if (scan < newsize) {
        s = 0;
        let Sb = 0;
        for (let i = 1; scan >= lastscan + i && pos >= i; i++) {
          if (old[pos - i] === nw[scan - i]) s++;
          if (s * 2 - i > Sb * 2 - lenb) {
            Sb = s;
            lenb = i;
          }
        }
      }

      if (lastscan + lenf > scan - lenb) {
        const overlap = lastscan + lenf - (scan - lenb);
        s = 0;
        let Ss = 0;
        let lens = 0;
        for (let i = 0; i < overlap; i++) {
          if (
            nw[lastscan + lenf - overlap + i] ===
            old[lastpos + lenf - overlap + i]
          )
            s++;
          if (nw[scan - lenb + i] === old[pos - lenb + i]) s--;
          if (s > Ss) {
            Ss = s;
            lens = i + 1;
          }
        }
        lenf += lens - overlap;
        lenb -= lens;
      }

      for (let i = 0; i < lenf; i++)
        db[dblen + i] = nw[lastscan + i]! - old[lastpos + i]!;
      const extraLen = scan - lenb - (lastscan + lenf);
      for (let i = 0; i < extraLen; i++)
        eb[eblen + i] = nw[lastscan + lenf + i]!;
      dblen += lenf;
      eblen += extraLen;
      ctrl.push(lenf, extraLen, pos - lenb - (lastpos + lenf));

      lastscan = scan - lenb;
      lastpos = pos - lenb;
      lastoffset = pos - scan;
    }
  }

  return encodePatch(
    ctrl,
    db.subarray(0, dblen),
    eb.subarray(0, eblen),
    newsize,
    sha256(old),
    sha256(nw)
  );
}

/**
 * Applies a NITROBSD patch to `old`. Mirrors the native implementations, including their bounds checks.
 */
export function bspatch(old: Uint8Array, patch: Uint8Array): Uint8Array {
  if (
    patch.length < PATCH_HEADER_SIZE ||
    !bytesEqual(patch.subarray(0, 8), MAGIC)
  ) {
    throw new Error('Invalid patch header');
  }
  const view = new DataView(patch.buffer, patch.byteOffset, patch.byteLength);
  const ctrlLen = view.getInt32(8, true);
  const diffLen = view.getInt32(12, true);
  const newSize = view.getInt32(16, true);
  if (
    ctrlLen < 0 ||
    ctrlLen % 12 !== 0 ||
    diffLen < 0 ||
    newSize < 0 ||
    newSize > MAX_SIZE ||
    PATCH_HEADER_SIZE + ctrlLen + diffLen > patch.length
  ) {
    throw new Error('Corrupt patch header');
  }
  if (!bytesEqual(sha256(old), patch.subarray(20, 52))) {
    throw new Error('Base bundle mismatch');
  }

  const out = new Uint8Array(newSize);
  let ctrl = PATCH_HEADER_SIZE;
  const ctrlEnd = ctrl + ctrlLen;
  let diff = ctrlEnd;
  const diffEnd = ctrlEnd + diffLen;
  let extra = diffEnd;
  let oldPos = 0;
  let newPos = 0;

  while (newPos < newSize) {
    if (ctrl + 12 > ctrlEnd) throw new Error('Corrupt patch control block');
    const x = view.getInt32(ctrl, true);
    const y = view.getInt32(ctrl + 4, true);
    const z = view.getInt32(ctrl + 8, true);
    ctrl += 12;
    if (
      x < 0 ||
      y < 0 ||
      oldPos < 0 ||
      oldPos + x > old.length ||
      newPos + x + y > newSize ||
      diff + x > diffEnd ||
      extra + y > patch.length
    ) {
      throw new Error('Corrupt patch data');
    }
    for (let i = 0; i < x; i++)
      out[newPos + i] = old[oldPos + i]! + patch[diff + i]!;
    newPos += x;
    diff += x;
    oldPos += x;
    out.set(patch.subarray(extra, extra + y), newPos);
    newPos += y;
    extra += y;
    oldPos += z;
  }

  if (!bytesEqual(sha256(out), patch.subarray(52, 84))) {
    throw new Error('Patched bundle hash mismatch');
  }
  return out;
}
