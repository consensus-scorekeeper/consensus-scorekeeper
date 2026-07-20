// Vendored files must stay byte-identical to their canonical sibling
// checkouts (see scripts/sync-vendored.mjs). Skipped when the sibling
// checkout isn't present (e.g. CI).

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { VENDORED } from '../scripts/sync-vendored.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

describe('vendored files match their canonical copies', () => {
  for (const { vendored, canonical } of VENDORED) {
    const src = path.resolve(root, canonical);
    const run = existsSync(src) ? it : it.skip;
    run(`${vendored} === ${canonical}`, () => {
      const want = readFileSync(src, 'utf8');
      const have = readFileSync(path.resolve(root, vendored), 'utf8');
      expect(have, `run \`npm run sync-vendored\` (canonical copy lives in ${canonical})`).toBe(want);
    });
  }
});
