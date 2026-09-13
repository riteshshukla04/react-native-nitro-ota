import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bspatch } from '../bsdiff';
import { buildPatchZip, findBundle, readVersion, writeZip } from '../patchTool';

function hasUnzip(): boolean {
  try {
    execFileSync('unzip', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function makeRelease(
  root: string,
  version: string,
  bundleText: string,
  manifest?: object
) {
  mkdirSync(join(root, 'assets'), { recursive: true });
  writeFileSync(join(root, 'index.android.bundle'), bundleText);
  writeFileSync(
    join(root, 'assets', 'logo.png'),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, version.charCodeAt(0)])
  );
  writeFileSync(
    join(root, 'ota.version.json'),
    JSON.stringify(manifest ?? { version })
  );
}

describe('patchTool', () => {
  let work: string;
  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), 'nitro-ota-'));
  });
  afterEach(() => {
    rmSync(work, { recursive: true, force: true });
  });

  it('finds bundles at the root or one level down', () => {
    mkdirSync(join(work, 'App-Bundles'));
    writeFileSync(join(work, 'App-Bundles', 'main.jsbundle'), 'x');
    expect(findBundle(work)).toBe('App-Bundles/main.jsbundle');
    writeFileSync(join(work, 'index.android.bundle'), 'x');
    expect(findBundle(work)).toBe('index.android.bundle');
  });

  it('reads ota.version.json before ota.version', () => {
    writeFileSync(join(work, 'ota.version'), 'text-version\n');
    expect(readVersion(work)).toBe('text-version');
    writeFileSync(join(work, 'ota.version.json'), '{"version":"json-version"}');
    expect(readVersion(work)).toBe('json-version');
  });

  it('builds a patch zip and rewrites the manifest', () => {
    const oldDir = join(work, 'old');
    const newDir = join(work, 'new');
    const oldBundle = 'var a=1;\n'.repeat(500) + 'console.log("v1");\n';
    const newBundle =
      'var a=1;\n'.repeat(500) + 'console.log("v2 with a fix");\n';
    makeRelease(oldDir, '1', oldBundle);
    makeRelease(newDir, '2', newBundle, {
      version: '2',
      isSemver: false,
      patches: { stale: 'old.zip' },
    });

    const result = buildPatchZip({ old: [oldDir], new: newDir });

    expect(result.to).toBe('2');
    expect(result.bundle).toBe('index.android.bundle');
    expect(result.patches).toHaveLength(1);
    const patchFile = join(newDir, 'patches', '1-2.zip');
    expect(result.patches[0]!.file).toBe(patchFile);
    expect(existsSync(patchFile)).toBe(true);
    expect(result.patches[0]!.size).toBeLessThan(oldBundle.length);

    const manifest = JSON.parse(
      readFileSync(join(newDir, 'ota.version.json'), 'utf8')
    );
    expect(manifest).toEqual({
      version: '2',
      isSemver: false,
      patches: { '1': 'patches/1-2.zip' },
    });

    if (!hasUnzip()) {
      return;
    }
    const extracted = join(work, 'extracted');
    execFileSync('unzip', ['-q', patchFile, '-d', extracted]);
    expect(existsSync(join(extracted, 'index.android.bundle'))).toBe(false);
    expect(
      readFileSync(join(extracted, 'assets', 'logo.png')).equals(
        readFileSync(join(newDir, 'assets', 'logo.png'))
      )
    ).toBe(true);
    expect(
      JSON.parse(readFileSync(join(extracted, 'ota.version.json'), 'utf8'))
        .version
    ).toBe('2');
    const rebuilt = bspatch(
      new Uint8Array(readFileSync(join(oldDir, 'index.android.bundle'))),
      new Uint8Array(
        readFileSync(join(extracted, 'index.android.bundle.patch'))
      )
    );
    expect(Buffer.from(rebuilt).toString('utf8')).toBe(newBundle);
  });

  it('uses --url-base for manifest entries and one patch per old release', () => {
    const old1 = join(work, 'old1');
    const old2 = join(work, 'old2');
    const newDir = join(work, 'new');
    makeRelease(old1, 'r1', 'bundle one');
    makeRelease(old2, 'r2', 'bundle two');
    makeRelease(newDir, 'r3', 'bundle three');

    buildPatchZip({
      old: [old1, old2],
      new: newDir,
      out: join(work, 'out'),
      urlBase: 'https://cdn.example.com/ota',
    });

    const manifest = JSON.parse(
      readFileSync(join(newDir, 'ota.version.json'), 'utf8')
    );
    expect(manifest.patches).toEqual({
      r1: 'https://cdn.example.com/ota/r1-r3.zip',
      r2: 'https://cdn.example.com/ota/r2-r3.zip',
    });
    expect(existsSync(join(work, 'out', 'r1-r3.zip'))).toBe(true);
    expect(existsSync(join(work, 'out', 'r2-r3.zip'))).toBe(true);
  });

  it('refuses equal versions and out-of-tree output without --url-base', () => {
    const oldDir = join(work, 'old');
    const newDir = join(work, 'new');
    makeRelease(oldDir, 'same', 'a');
    makeRelease(newDir, 'same', 'b');
    expect(() => buildPatchZip({ old: [oldDir], new: newDir })).toThrow(
      'bump the version'
    );
    expect(() =>
      buildPatchZip({
        old: [oldDir],
        new: newDir,
        to: 'next',
        out: join(work, 'elsewhere'),
      })
    ).toThrow('--url-base');
  });

  it('writes zips that unzip cleanly', () => {
    const zip = writeZip([
      { name: 'a.txt', data: new Uint8Array(Buffer.from('hello')) },
      { name: 'dir/b.bin', data: new Uint8Array(1000) },
    ]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
    if (!hasUnzip()) {
      return;
    }
    const file = join(work, 'test.zip');
    writeFileSync(file, zip);
    expect(() =>
      execFileSync('unzip', ['-tq', file], { stdio: 'ignore' })
    ).not.toThrow();
  });
});
