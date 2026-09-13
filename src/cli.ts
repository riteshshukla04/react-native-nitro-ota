#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { crc32 } from 'node:zlib';
import { buildPatchZip } from './patchTool';

const USAGE = `Usage: nitro-ota patch --old <dir> [--old <dir> ...] --new <dir> [options]

Builds one differential OTA patch zip per --old release and updates ota.version.json.

Options:
  --old <dir>       Previously published release directory (repeatable, one patch each)
  --new <dir>       New release directory (bundle, assets, ota.version.json)
  --out <dir>       Output directory for patch zips (default: <new>/patches)
  --bundle <path>   Bundle path relative to the release dir (default: auto-detect *.bundle/*.jsbundle)
  --from <version>  Version of each --old release (default: read from ota.version(.json))
  --to <version>    New version (default: read from ota.version(.json) next to the bundle)
  --url-base <url>  URL prefix for manifest entries (default: path relative to the manifest)
  -h, --help        Show this help`;

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function main(): void {
  if (typeof crc32 !== 'function') {
    console.error('nitro-ota requires Node >= 22.2');
    process.exit(1);
  }
  const [command, ...rest] = process.argv.slice(2);
  if (command !== 'patch' || rest.includes('--help') || rest.includes('-h')) {
    console.log(USAGE);
    process.exit(command === 'patch' ? 0 : 1);
  }
  const { values } = parseArgs({
    args: rest,
    options: {
      'old': { type: 'string', multiple: true },
      'new': { type: 'string' },
      'out': { type: 'string' },
      'bundle': { type: 'string' },
      'from': { type: 'string', multiple: true },
      'to': { type: 'string' },
      'url-base': { type: 'string' },
    },
  });
  if (!values.old?.length || !values.new) {
    console.error(USAGE);
    process.exit(1);
  }

  const started = Date.now();
  const result = buildPatchZip({
    old: values.old,
    new: values.new,
    out: values.out,
    bundle: values.bundle,
    from: values.from,
    to: values.to,
    urlBase: values['url-base'],
  });
  for (const patch of result.patches) {
    console.log(
      `${patch.from} -> ${result.to}: ${patch.file} (${formatKb(
        patch.size
      )}, bundle ${formatKb(result.bundleSize)})`
    );
  }
  console.log(
    `Updated ${result.manifestPath} in ${(
      (Date.now() - started) /
      1000
    ).toFixed(1)}s`
  );
}

try {
  main();
} catch (error) {
  console.error(
    `nitro-ota: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}
