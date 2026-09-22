import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, access, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { ImageOptimizerCache } = require('next/dist/server/image-optimizer');
const { config } = JSON.parse(await readFile(new URL('../.next/required-server-files.json', import.meta.url), 'utf8'));

test('production image optimization does not create disk cache in the installation', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'deckvault-image-cache-'));
  try {
    const cache = new ImageOptimizerCache({ distDir: directory, nextConfig: config });
    await cache.set('image-test', {
      kind: 'IMAGE', buffer: Buffer.from('test'), extension: 'webp',
      etag: 'image-etag', upstreamEtag: 'source-etag',
    }, { cacheControl: { revalidate: 60 } });
    assert.equal(await cache.get('image-test'), null);
    await assert.rejects(access(path.join(directory, 'cache', 'images')), { code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
