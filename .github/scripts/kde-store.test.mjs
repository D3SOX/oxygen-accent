// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 D3SOX
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseDownloads } from './kde-store.mjs';

const tag = 'v6.8.0-1';
const release = () => ({
  tagName: tag, isDraft: false, isPrerelease: false,
  assets: ['plasma', 'icons'].map((kind) => ({
    name: `oxygen-accent-${kind}.tar.gz`, size: 100,
    url: `https://github.com/D3SOX/oxygen-accent/releases/download/${tag}/oxygen-accent-${kind}.tar.gz`,
  })),
});

test('both downloads belong to the exact published version', () => {
  const downloads = releaseDownloads(tag, release());
  assert.equal(downloads.length, 2);
  assert.ok(downloads.every((entry) => entry.version === '6.8.0-1' && entry.url.includes(`/download/${tag}/`)));
});

test('unpublished or mismatched releases cannot reach the Store', () => {
  for (const change of [{ isDraft: true }, { isPrerelease: true }, { tagName: 'v6.8.0-2' }]) {
    assert.throws(() => releaseDownloads(tag, { ...release(), ...change }));
  }
  assert.throws(() => releaseDownloads('main', release()));
});

test('latest URLs, missing archives and empty archives are rejected', () => {
  for (const change of [{ url: 'https://github.com/D3SOX/oxygen-accent/releases/latest/download/oxygen-accent-plasma.tar.gz' }, { size: 0 }]) {
    const data = release();
    Object.assign(data.assets[0], change);
    assert.throws(() => releaseDownloads(tag, data));
  }
  assert.throws(() => releaseDownloads(tag, { ...release(), assets: release().assets.slice(1) }));
});
