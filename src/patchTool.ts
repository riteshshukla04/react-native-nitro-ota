import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';
import { bsdiff, bspatch } from './bsdiff';

export interface PatchToolOptions {
  /** Directories holding the previously published release(s) (one patch per directory) */
  old: string[];
  /** Directory holding the new release (bundle, assets, ota.version.json) */
  new: string;
  /** Output directory for patch zips. Default: `<new>/patches` */
  out?: string;
  /** Bundle path relative to the release directory. Default: auto-detect `*.bundle` / `*.jsbundle` */
  bundle?: string;
  /** Versions of the old releases, aligned with `old`. Default: read from each directory */
  from?: string[];
  /** New version. Default: read from the new directory */
  to?: string;
  /** URL prefix for manifest entries. Default: path relative to the manifest */
  urlBase?: string;
}

export interface PatchToolResult {
  to: string;
  bundle: string;
  bundleSize: number;
  manifestPath: string;
  patches: { from: string; file: string; size: number; ref: string }[];
}

const BUNDLE_SUFFIXES = ['.bundle', '.jsbundle'];

function toPosix(p: string): string {
  return p.split(sep).join('/');
}

function isBundleName(name: string): boolean {
  return BUNDLE_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

/** Mirrors the native auto-detection: a bundle at the root, else one level down. */
export function findBundle(dir: string): string | undefined {
  const entries = readdirSync(dir, { withFileTypes: true });
  const atRoot = entries.find((e) => e.isFile() && isBundleName(e.name));
  if (atRoot) return atRoot.name;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nested = readdirSync(join(dir, entry.name), {
      withFileTypes: true,
    }).find((e) => e.isFile() && isBundleName(e.name));
    if (nested) return `${entry.name}/${nested.name}`;
  }
  return undefined;
}

/** Same lookup order as the native side: ota.version.json, then ota.version. */
export function readVersion(dir: string): string | undefined {
  const jsonFile = join(dir, 'ota.version.json');
  if (existsSync(jsonFile)) {
    try {
      const version = (
        JSON.parse(readFileSync(jsonFile, 'utf8')) as { version?: unknown }
      ).version;
      if (typeof version === 'string' && version) return version;
    } catch {
      // fall through to the plain-text file
    }
  }
  const textFile = join(dir, 'ota.version');
  if (existsSync(textFile)) {
    const version = readFileSync(textFile, 'utf8').trim();
    if (version) return version;
  }
  return undefined;
}

function walk(dir: string, root: string, out: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, root, out);
    else if (entry.isFile()) out.push(toPosix(relative(root, full)));
  }
  return out;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Minimal zip writer: deflate entries, central directory, no zip64. */
export function writeZip(entries: ZipEntry[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(8, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt16LE(0x21, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(compressed.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(nameBytes.length, 28);
    header.writeUInt32LE(offset, 42);

    parts.push(local, nameBytes, compressed);
    central.push(header, nameBytes);
    offset += local.length + nameBytes.length + compressed.length;
  }
  const centralSize = central.reduce((sum, b) => sum + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, eocd]);
}

function sanitize(version: string): string {
  return version.replace(/[^A-Za-z0-9._-]+/g, '_');
}

function requireDir(path: string, label: string): string {
  const abs = resolve(path);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) {
    throw new Error(`${label} directory not found: ${abs}`);
  }
  return abs;
}

/**
 * Builds one patch zip per old release and rewrites `ota.version.json` next to the new bundle
 * so `patches` lists exactly the patches generated by this run.
 */
export function buildPatchZip(options: PatchToolOptions): PatchToolResult {
  if (options.old.length === 0)
    throw new Error('At least one --old directory is required');
  const newDir = requireDir(options.new, 'New release');
  const oldDirs = options.old.map((dir) => requireDir(dir, 'Old release'));
  if (options.from && options.from.length !== oldDirs.length) {
    throw new Error('--from must be given once per --old directory');
  }

  const bundleRel = options.bundle ?? findBundle(newDir);
  if (!bundleRel)
    throw new Error(
      `No *.bundle / *.jsbundle found in ${newDir}; pass --bundle`
    );
  const newBundle = join(newDir, bundleRel);
  if (!existsSync(newBundle)) throw new Error(`Bundle not found: ${newBundle}`);
  const contentDir = dirname(newBundle);
  const manifestPath = join(contentDir, 'ota.version.json');

  const to = options.to ?? readVersion(contentDir);
  if (!to)
    throw new Error(
      'New version unknown: add ota.version.json next to the bundle or pass --to'
    );

  const outDir = resolve(options.out ?? join(newDir, 'patches'));
  const outRel = toPosix(relative(contentDir, outDir));
  if (
    !options.urlBase &&
    (outRel.startsWith('..') || resolve(outRel) === outRel)
  ) {
    throw new Error(
      'Output directory is outside the manifest directory; pass --url-base'
    );
  }
  mkdirSync(outDir, { recursive: true });

  const newBytes = new Uint8Array(readFileSync(newBundle));
  const patches: PatchToolResult['patches'] = [];
  const entries: Record<string, string> = {};
  for (const [index, oldDir] of oldDirs.entries()) {
    const oldBundle = join(oldDir, bundleRel);
    if (!existsSync(oldBundle))
      throw new Error(`Bundle not found in old release: ${oldBundle}`);
    const from = options.from?.[index] ?? readVersion(dirname(oldBundle));
    if (!from)
      throw new Error(
        `Old version unknown for ${oldDir}: add ota.version(.json) or pass --from`
      );
    if (from === to)
      throw new Error(
        `Old and new versions are both "${to}"; bump the version or pass --to`
      );
    patches.push({
      from,
      file: join(outDir, `${sanitize(from)}-${sanitize(to)}.zip`),
      size: 0,
      ref: '',
    });
    // Placeholder entries are filled in below once the manifest (shipped inside each zip) is final.
    entries[from] = '';
  }
  for (const patch of patches) {
    const file = basename(patch.file);
    patch.ref = options.urlBase
      ? options.urlBase.replace(/\/?$/, '/') + file
      : toPosix(relative(contentDir, patch.file));
    entries[patch.from] = patch.ref;
  }

  let manifest: Record<string, unknown> = {};
  if (existsSync(manifestPath)) {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<
      string,
      unknown
    >;
  }
  manifest.version = to;
  manifest.patches = entries;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  const bundlePosix = toPosix(bundleRel);
  const files = walk(newDir, newDir, []).filter((rel) => {
    const abs = join(newDir, rel);
    return (
      rel !== bundlePosix && !abs.startsWith(outDir + sep) && abs !== outDir
    );
  });
  const sharedEntries: ZipEntry[] = files.map((rel) => ({
    name: rel,
    data: new Uint8Array(readFileSync(join(newDir, rel))),
  }));

  for (const [index, patch] of patches.entries()) {
    const oldBytes = new Uint8Array(
      readFileSync(join(oldDirs[index]!, bundleRel))
    );
    const patchBytes = bsdiff(oldBytes, newBytes);
    const rebuilt = bspatch(oldBytes, patchBytes);
    if (Buffer.compare(rebuilt, newBytes) !== 0) {
      throw new Error(`Self-verification failed for patch from ${patch.from}`);
    }
    const zip = writeZip([
      ...sharedEntries,
      { name: `${bundlePosix}.patch`, data: patchBytes },
    ]);
    writeFileSync(patch.file, zip);
    patch.size = zip.length;
  }

  return {
    to,
    bundle: bundlePosix,
    bundleSize: newBytes.length,
    manifestPath,
    patches,
  };
}
