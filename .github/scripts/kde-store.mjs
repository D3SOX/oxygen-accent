// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 D3SOX
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const products = [
  { id: '2378747', title: 'Oxygen Accent', kind: 'plasma', tagGroup: '18', tagId: '19900' },
  { id: '2378748', title: 'Oxygen Accent Icons', kind: 'icons', tagGroup: '31', tagId: '4' },
];

export function releaseDownloads(tag, release) {
  if (!/^v\d+\.\d+\.\d+-[1-9]\d*$/.test(tag)) throw new Error('Invalid release tag.');
  if (release.tagName !== tag || release.isDraft || release.isPrerelease) {
    throw new Error('KDE Store publishing requires the matching published stable release.');
  }
  return products.map((product) => {
    const name = `oxygen-accent-${product.kind}.tar.gz`;
    const url = `https://github.com/D3SOX/oxygen-accent/releases/download/${tag}/${name}`;
    if (!release.assets.some((asset) => asset.name === name && asset.url === url && asset.size > 0)) {
      throw new Error(`Missing versioned release archive: ${name}`);
    }
    return { ...product, url, version: tag.slice(1), notes: release.body || `Release ${tag}.` };
  });
}

// Runs inside the signed-in browser. Uses the same requests as the Store's edit form.
// These endpoints are not a supported API and may change with the website.
export async function publishProduct({ id, title, kind, tagGroup, tagId, url, version, notes, dryRun }) {
  if (location.origin !== 'https://store.kde.org' || location.pathname !== `/p/${id}/edit`) {
    throw new Error('Unexpected Store page.');
  }
  const form = document.querySelector('#add-product-form');
  if (!form || form.querySelector('#title')?.value !== title) {
    throw new Error('Cannot edit the expected product. Check the login and product permissions.');
  }
  const current = form.querySelector('#version').value.split(/[.-]/).map(Number);
  const requested = version.split(/[.-]/).map(Number);
  for (let i = 0; i < requested.length; i++) {
    if (current[i] > requested[i]) throw new Error('Refusing to replace a newer Store release.');
    if (current[i] < requested[i]) break;
  }
  const collection = document.querySelector('#modal-ppload').getAttribute('data-ppload-collection-id');
  const request = async (path, data) => {
    const endpoint = new URL(path, location.origin);
    if (!data) endpoint.searchParams.set('_', Date.now().toString());
    const response = await fetch(endpoint, { cache: 'no-store', ...(data ? { method: 'POST', body: new URLSearchParams(data) } : {}) });
    if (!response.ok) throw new Error(`Store request failed with HTTP ${response.status}.`);
    let result;
    try { result = await response.json(); } catch { throw new Error('Store returned HTML instead of JSON. Check the login or bot challenge.'); }
    if (!['ok', 'success'].includes(result.status) && !result.file) {
      throw new Error(`Store rejected ${path}.`);
    }
    return result;
  };
  const filesPath = `/p/${id}/getfilesajax?${new URLSearchParams({
    collection_id: collection, perpage: '1000', page: '1', format: 'json', status: 'active',
  })}`;
  const files = Object.values((await request(filesPath)).files);
  if (files.length >= 1000) throw new Error('File list was truncated.');
  const linkOf = (file) => {
    const link = (file.tags || '').split(',').find((tag) => tag.startsWith('link##'));
    return link ? decodeURIComponent(link.slice(6)) : '';
  };
  const matching = files.filter((file) => file.version === version);
  if (matching.some((file) => linkOf(file) !== url)) {
    throw new Error(`Version ${version} already has a different download URL. No files were changed.`);
  }
  const updates = Object.values((await request(`/p/${id}/getupdatesajax?format=json`)).updates);
  const updateTitle = `Oxygen Accent ${version}`;
  if (dryRun) return { product: id, version, existingFiles: matching.length, dryRun: true };

  let file = matching[0] || files.find((entry) => !entry.version && linkOf(entry) === url);
  if (!file) {
    const added = await request('/file/link/', {
      project_id: id, u: url, fn: `oxygen-accent-${kind}-${version}.tar.gz`,
      fd: `Oxygen Accent ${version}`,
    });
    file = added.file;
  }
  if (!file?.id) throw new Error('Store did not return a file ID.');
  await request(`/p/${id}/updatepploadfile/`, { file_id: file.id, file_version: version });
  await request(`/p/${id}/updatefiletag/`, { file_id: file.id, tag_id: tagId, tag_group_id: tagGroup });
  const savedFiles = Object.values((await request(filesPath)).files);
  if (!savedFiles.some((entry) => entry.id === file.id && entry.version === version && linkOf(entry) === url)) {
    throw new Error('Could not verify the saved download URL and version.');
  }

  // Preserve the listing's description, screenshots, license and other fields.
  const fields = new FormData(form);
  for (const [key, value] of [...fields]) if (value instanceof File) fields.delete(key);
  fields.set('version', version);
  const saved = await fetch(form.action, { method: 'POST', body: fields, cache: 'no-store' });
  if (!saved.ok || !saved.redirected || !new URL(saved.url).pathname.endsWith('/products/')) {
    throw new Error('Store did not confirm the listing update.');
  }
  if (!updates.some((update) => update.raw_title === updateTitle)) {
    await request(`/p/${id}/saveupdateajax`, { title: updateTitle, text: notes, update_id: '' });
  }
  const verifyUrl = new URL(form.action);
  verifyUrl.searchParams.set('_', Date.now().toString());
  const verified = await fetch(verifyUrl, { cache: 'no-store' });
  const doc = new DOMParser().parseFromString(await verified.text(), 'text/html');
  if (doc.querySelector('#version')?.value !== version) throw new Error('Listing version verification failed.');
  const savedUpdates = Object.values((await request(`/p/${id}/getupdatesajax?format=json`)).updates);
  if (!savedUpdates.some((update) => update.raw_title === updateTitle)) throw new Error('Changelog verification failed.');
  return { product: id, version, file: file.id, dryRun: false };
}

async function main() {
  const tag = process.env.RELEASE_TAG;
  if (!/^v\d+\.\d+\.\d+-[1-9]\d*$/.test(tag || '')) throw new Error('Set RELEASE_TAG to a version tag.');
  const release = JSON.parse(execFileSync('gh', [
    'release', 'view', tag, '--repo', 'D3SOX/oxygen-accent',
    '--json', 'tagName,isDraft,isPrerelease,assets,body',
  ], { encoding: 'utf8' }));
  const downloads = releaseDownloads(tag, release);
  const password = process.env.KDE_STORE_PASSWORD;
  const username = process.env.KDE_STORE_USERNAME;
  if (!password || !username) throw new Error('Add KDE_STORE_USERNAME and KDE_STORE_PASSWORD to the repository Actions secrets before publishing.');
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: process.env.KDE_STORE_HEADED !== '1' });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120_000);
    console.log('Opening the KDE Store login page.');
    const response = await page.goto('https://store.kde.org/login/', { waitUntil: 'domcontentloaded' });
    try {
      await page.locator('input[name="mail"]').waitFor();
    } catch {
      const address = new URL(page.url());
      const text = (await page.locator('body').innerText()).slice(0, 300);
      throw new Error(`Store login form was unavailable. HTTP ${response?.status()}, ${address.origin}${address.pathname}, title: ${await page.title()}, response: ${text}`);
    }
    await page.locator('input[name="mail"]').fill(username);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('#login').click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { waitUntil: 'domcontentloaded' });
    for (const download of downloads) {
      console.log(`Updating Store product ${download.id} to ${download.version}.`);
      await page.goto(`https://store.kde.org/p/${download.id}/edit`, { waitUntil: 'domcontentloaded' });
      await page.locator('#add-product-form').waitFor();
      console.log(await page.evaluate(publishProduct, { ...download, dryRun: process.argv.includes('--dry-run') }));
    }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
