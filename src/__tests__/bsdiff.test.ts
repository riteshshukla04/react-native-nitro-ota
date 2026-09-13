import { randomBytes } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { bsdiff, bspatch, PATCH_HEADER_SIZE } from '../bsdiff';

const bytes = (text: string) => new Uint8Array(Buffer.from(text, 'utf8'));

function roundtrip(old: Uint8Array, nw: Uint8Array): Uint8Array {
  const patch = bsdiff(old, nw);
  expect(Buffer.compare(bspatch(old, patch), nw)).toBe(0);
  return patch;
}

function fakeBundle(modules: number, changed: Record<number, string> = {}) {
  const lines: string[] = [];
  for (let id = 0; id < modules; id++) {
    lines.push(
      `__d(function(g,r,i,a,m,e,d){${
        changed[id] ?? `var x${id}=r(d[0]);e.default=x${id}+${id * 7};`
      }},${id},[${(id + 1) % modules}]);`
    );
  }
  return bytes(lines.join('\n'));
}

describe('bsdiff/bspatch', () => {
  it('rebuilds identical inputs with a tiny patch', () => {
    const data = randomBytes(5000);
    const patch = roundtrip(data, data);
    expect(patch.length).toBe(PATCH_HEADER_SIZE + 12 + data.length);
  });

  it('handles an empty old file', () => {
    roundtrip(new Uint8Array(0), bytes('hello world'));
  });

  it('handles an empty new file', () => {
    roundtrip(bytes('hello world'), new Uint8Array(0));
  });

  it('roundtrips random buffers of assorted sizes', () => {
    for (const [oldSize, newSize] of [
      [1, 1],
      [17, 3],
      [100, 4000],
      [4000, 100],
      [65536, 65537],
    ]) {
      roundtrip(randomBytes(oldSize!), randomBytes(newSize!));
    }
  });

  it('roundtrips a new file that is a shuffled copy of the old one', () => {
    const old = randomBytes(20000);
    const nw = Buffer.concat([
      old.subarray(15000),
      old.subarray(5000, 15000),
      old.subarray(0, 5000),
    ]);
    roundtrip(old, nw);
  });

  it('produces small patches for realistic bundle edits', () => {
    const old = fakeBundle(3000);
    const nw = fakeBundle(3001, {
      42: 'var fixed=r(d[0]);e.default="a one line fix";',
      1500: 'var added=1;',
    });
    const patch = roundtrip(old, nw);
    // Blocks are stored raw; the enclosing zip deflates them, so measure the deflated size.
    expect(deflateRawSync(patch).length).toBeLessThan(nw.length / 20);
  });

  it('rejects a tampered header', () => {
    const old = bytes('abc');
    const patch = bsdiff(old, bytes('abcd'));
    const badMagic = Uint8Array.from(patch);
    badMagic[0] = 0;
    expect(() => bspatch(old, badMagic)).toThrow('Invalid patch header');

    const hugeNewSize = Uint8Array.from(patch);
    new DataView(hugeNewSize.buffer).setInt32(16, 0x7fffffff, true);
    expect(() => bspatch(old, hugeNewSize)).toThrow('Corrupt patch header');

    expect(() =>
      bspatch(old, patch.subarray(0, PATCH_HEADER_SIZE - 1))
    ).toThrow('Invalid patch header');
  });

  it('rejects a wrong base bundle', () => {
    const patch = bsdiff(bytes('base one'), bytes('target'));
    expect(() => bspatch(bytes('base two'), patch)).toThrow(
      'Base bundle mismatch'
    );
  });

  it('rejects corrupted patch data', () => {
    const old = randomBytes(1000);
    const patch = bsdiff(old, randomBytes(1000));
    const corrupted = Uint8Array.from(patch);
    corrupted[corrupted.length - 1] = 255 - corrupted[corrupted.length - 1]!;
    expect(() => bspatch(old, corrupted)).toThrow(
      'Patched bundle hash mismatch'
    );
  });
});
