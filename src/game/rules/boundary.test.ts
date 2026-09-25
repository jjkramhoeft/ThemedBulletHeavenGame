// Enforces ADR 0002: rules/ must not see Phaser or Themes.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = import.meta.dirname;
const sources = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

describe('rules/ import boundary', () => {
  it.each(sources)('%s imports only from rules/', (file) => {
    const imports = [...readFileSync(join(dir, file), 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
    for (const spec of imports) expect(spec, `${file} imports ${spec}`).toMatch(/^\.\/[\w-]+$/);
  });
});
