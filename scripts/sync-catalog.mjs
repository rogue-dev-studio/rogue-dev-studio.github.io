/**
 * Sync portfolio catalog (Karya / Lab / Archive) using a server-side token.
 * NEVER expose the token to the browser — this script runs in GitHub Actions only
 * (or locally with `gh auth token` / GITHUB_TOKEN env).
 *
 * Usage:
 *   GITHUB_TOKEN=... node scripts/sync-catalog.mjs
 *   # or
 *   gh auth token | { read t; GITHUB_TOKEN=$t node scripts/sync-catalog.mjs }
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data');
const OUT_FILE = path.join(OUT_DIR, 'catalog.json');

const OWNER = 'rogue-dev-studio';
const TOPIC_LAB = 'experiment-arishadisopiyan';
const TOPIC_PORTFOLIO = 'portfolio-arishadisopiyan';
const ARCHIVE_EXCLUDE = new Set([
  'rogue-dev-studio.github.io',
  'ArisHadisopiyan',
]);
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;

const FEATURED_ORDER = [
  'laravel-project-management-system-aris',
  'sistem-antrian',
  'sistem-informasi-klinik',
  'rental-mobil-new',
];

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
if (!token) {
  console.error('Missing GITHUB_TOKEN (or GH_TOKEN). Refusing to run without a server-side token.');
  process.exit(1);
}

const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'User-Agent': 'rogue-dev-catalog-sync',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function gh(pathname, { raw = false } = {}) {
  const url = pathname.startsWith('http') ? pathname : `https://api.github.com${pathname}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${pathname} — ${body.slice(0, 200)}`);
  }
  if (raw) return res;
  return res.json();
}

async function searchTopic(topic) {
  const q = encodeURIComponent(`user:${OWNER} topic:${topic}`);
  const data = await gh(`/search/repositories?q=${q}&per_page=100&sort=updated`);
  return Array.isArray(data.items) ? data.items : [];
}

async function listAllRepos() {
  const all = [];
  for (let page = 1; page <= 5; page += 1) {
    const batch = await gh(`/users/${OWNER}/repos?sort=updated&per_page=100&page=${page}&type=owner`);
    if (!Array.isArray(batch) || !batch.length) break;
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

async function listContentImages(repo) {
  try {
    const entries = await gh(`/repos/${OWNER}/${encodeURIComponent(repo)}/contents/github-contents`);
    if (!Array.isArray(entries)) return [];
    return entries
      .filter((e) => e.type === 'file' && IMAGE_EXT.test(e.name || '') && e.download_url)
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
      .map((e) => e.download_url);
  } catch {
    return [];
  }
}

function mapRepo(repo, images = []) {
  return {
    name: repo.name,
    description: repo.description || '',
    homepage: repo.homepage || '',
    html_url: repo.html_url,
    language: repo.language || '',
    default_branch: repo.default_branch || 'main',
    updated_at: repo.updated_at || null,
    images,
  };
}

async function withImages(repos, { concurrency = 4 } = {}) {
  const out = [];
  for (let i = 0; i < repos.length; i += concurrency) {
    const chunk = repos.slice(i, i + concurrency);
    const mapped = await Promise.all(
      chunk.map(async (repo) => mapRepo(repo, await listContentImages(repo.name))),
    );
    out.push(...mapped);
    console.log(`images ${Math.min(i + concurrency, repos.length)}/${repos.length}`);
  }
  return out;
}

console.log('Sync catalog as', OWNER);

const [labRepos, portfolioRepos, allRepos] = await Promise.all([
  searchTopic(TOPIC_LAB),
  searchTopic(TOPIC_PORTFOLIO),
  listAllRepos(),
]);

const labNames = new Set(labRepos.map((r) => r.name));
const portfolioNames = new Set(portfolioRepos.map((r) => r.name));

// Ensure featured order first in karya
const portfolioByName = new Map(portfolioRepos.map((r) => [r.name, r]));
const karyaSource = [
  ...FEATURED_ORDER.map((n) => portfolioByName.get(n)).filter(Boolean),
  ...portfolioRepos.filter((r) => !FEATURED_ORDER.includes(r.name)),
];
// If featured missing from topic search, still try to resolve via allRepos
for (const name of FEATURED_ORDER) {
  if (!karyaSource.find((r) => r.name === name)) {
    const found = allRepos.find((r) => r.name === name);
    if (found) karyaSource.unshift(found);
  }
}

const archiveSource = allRepos.filter((r) => {
  if (r.fork) return false;
  if (ARCHIVE_EXCLUDE.has(r.name)) return false;
  if (labNames.has(r.name) || portfolioNames.has(r.name)) return false;
  if (FEATURED_ORDER.includes(r.name)) return false;
  return true;
});

console.log(`lab=${labRepos.length} karya=${karyaSource.length} archive=${archiveSource.length}`);

const [lab, karya, archive] = await Promise.all([
  withImages(labRepos),
  withImages(karyaSource),
  withImages(archiveSource.slice(0, 60)), // cap archive image fetch to keep Action fast
]);

const catalog = {
  generatedAt: new Date().toISOString(),
  owner: OWNER,
  topics: {
    lab: TOPIC_LAB,
    portfolio: TOPIC_PORTFOLIO,
  },
  lab,
  karya,
  archive,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, `${JSON.stringify(catalog, null, 2)}\n`);
console.log('Wrote', OUT_FILE);
console.log('DONE');
