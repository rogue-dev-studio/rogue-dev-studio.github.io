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
const TOPICS_FILE = path.join(OUT_DIR, 'karya-topics.json');
const PREVIEWS_DIR = path.join(ROOT, 'thumbs');

const OWNER = 'rogue-dev-studio';
const TOPIC_LAB = 'experiment-arishadisopiyan';
const TOPIC_KARYA = 'business-system-arishadisopiyan';
const ARCHIVE_EXCLUDE = new Set([
  'rogue-dev-studio.github.io',
  'ArisHadisopiyan',
  'rogue-dev-studio',
  'professional-portfolio-template-with-ai-protection',
]);
const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;
const MAX_GITHUB_TOPICS = 20;

const FEATURED_ORDER = [
  'sijama',
  'laravel-pms',
  'sistem-antrian',
  'sistem-informasi-klinik',
  'rental-mobil-new',
];

const karyaTopicsManifest = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf8'));

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

async function gh(pathname, { raw = false, method = 'GET', body } = {}) {
  const url = pathname.startsWith('http') ? pathname : `https://api.github.com${pathname}`;
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${pathname} — ${text.slice(0, 200)}`);
  }
  if (raw) return res;
  if (res.status === 204) return null;
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

async function listContentImageEntries(repo, contentPath = 'github-contents', depth = 0) {
  if (depth > 4) return [];
  try {
    const entries = await gh(`/repos/${OWNER}/${encodeURIComponent(repo)}/contents/${contentPath}`);
    if (!Array.isArray(entries)) return [];
    const files = [];
    for (const e of entries) {
      if (e.type === 'file' && IMAGE_EXT.test(e.name || '') && e.download_url) {
        files.push({ name: e.name, download_url: e.download_url });
      } else if (e.type === 'dir' && e.path) {
        files.push(...await listContentImageEntries(repo, e.path, depth + 1));
      }
    }
    files.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
    return files;
  } catch {
    return [];
  }
}

async function listContentImages(repo, contentPath = 'github-contents', depth = 0) {
  const files = await listContentImageEntries(repo, contentPath, depth);
  return files.map((f) => f.download_url);
}

async function cachePrivateRepoPreviews(repo) {
  if (!repo.private) return null;
  const files = await listContentImageEntries(repo.name);
  if (!files.length) return [];

  const previewDir = path.join(PREVIEWS_DIR, repo.name);
  fs.mkdirSync(previewDir, { recursive: true });

  const publicPaths = [];
  for (const file of files) {
    const res = await fetch(file.download_url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {
      console.warn(`preview ${repo.name}/${file.name} download failed: ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(previewDir, file.name), buf);
    publicPaths.push(`thumbs/${repo.name}/${file.name}`);
    console.log(`preview cached ${repo.name}/${file.name}`);
  }
  return publicPaths;
}

async function resolveKaryaImages(repo) {
  const remoteUrls = await listContentImages(repo.name);
  if (repo.private) {
    const cached = await cachePrivateRepoPreviews(repo);
    if (cached?.length) return cached;
  }
  return remoteUrls.map(normalizeRawUrl);
}

function buildRepoTopics(repoName) {
  const spec = karyaTopicsManifest.repos[repoName];
  if (!spec) return [];
  const primary = karyaTopicsManifest.primaryTopic || TOPIC_KARYA;
  const merged = [
    primary,
    ...(spec.technology || []),
    ...(spec.industry || []),
    ...(spec.business || []),
  ];
  return [...new Set(merged.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, MAX_GITHUB_TOPICS);
}

function topicGroupsForRepo(repoName) {
  const spec = karyaTopicsManifest.repos[repoName];
  if (!spec) return null;
  return {
    primary: karyaTopicsManifest.primaryTopic || TOPIC_KARYA,
    technology: spec.technology || [],
    industry: spec.industry || [],
    business: spec.business || [],
  };
}

async function getRepoTopics(repoName) {
  try {
    const data = await gh(`/repos/${OWNER}/${encodeURIComponent(repoName)}/topics`);
    return Array.isArray(data.names) ? data.names : [];
  } catch {
    return [];
  }
}

async function applyRepoTopics(repoName, requiredTopics) {
  const current = await getRepoTopics(repoName);
  const canonical = requiredTopics.map((t) => t.toLowerCase());
  const same = canonical.length === current.length
    && canonical.every((t, i) => current[i]?.toLowerCase() === t);
  if (same) {
    console.log(`topics ${repoName}: OK (${canonical.length})`);
    return canonical;
  }
  await gh(`/repos/${OWNER}/${encodeURIComponent(repoName)}/topics`, {
    method: 'PUT',
    body: { names: canonical },
  });
  console.log(`topics ${repoName}: applied ${canonical.join(', ')}`);
  return canonical;
}

function normalizeRawUrl(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'raw.githubusercontent.com') {
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    }
    return url.split('?')[0];
  } catch {
    return String(url).split('?')[0];
  }
}

function mapRepo(repo, images = [], extra = {}) {
  return {
    name: repo.name,
    description: repo.description || '',
    homepage: repo.homepage || '',
    html_url: repo.html_url,
    language: repo.language || '',
    default_branch: repo.default_branch || 'main',
    updated_at: repo.updated_at || null,
    images: images.map(normalizeRawUrl),
    ...extra,
  };
}

async function withImages(repos, { concurrency = 4, mapExtra, karya = false } = {}) {
  const out = [];
  for (let i = 0; i < repos.length; i += concurrency) {
    const chunk = repos.slice(i, i + concurrency);
    const mapped = await Promise.all(
      chunk.map(async (repo) => {
        const images = karya ? await resolveKaryaImages(repo) : (await listContentImages(repo.name)).map(normalizeRawUrl);
        const extra = typeof mapExtra === 'function' ? mapExtra(repo) : {};
        return mapRepo(repo, images, extra);
      }),
    );
    out.push(...mapped);
    console.log(`images ${Math.min(i + concurrency, repos.length)}/${repos.length}`);
  }
  return out;
}

console.log('Sync catalog as', OWNER);

const [labRepos, karyaTopicRepos, allRepos] = await Promise.all([
  searchTopic(TOPIC_LAB),
  searchTopic(TOPIC_KARYA),
  listAllRepos(),
]);

const labNames = new Set(labRepos.filter((r) => !r.fork).map((r) => r.name));
const karyaByName = new Map(karyaTopicRepos.filter((r) => !r.fork).map((r) => [r.name, r]));
const allByName = new Map(allRepos.filter((r) => !r.fork).map((r) => [r.name, r]));
const karyaSource = FEATURED_ORDER.map((name) => karyaByName.get(name) || allByName.get(name)).filter(Boolean);

const archiveSource = allRepos.filter((r) => {
  if (r.fork) return false;
  if (ARCHIVE_EXCLUDE.has(r.name)) return false;
  if (labNames.has(r.name)) return false;
  if (FEATURED_ORDER.includes(r.name)) return false;
  return true;
});

console.log(`lab=${labRepos.length} karya=${karyaSource.length} archive=${archiveSource.length}`);

console.log('Applying Karya GitHub topics…');
const appliedTopics = {};
for (const repoName of FEATURED_ORDER) {
  const required = buildRepoTopics(repoName);
  if (!required.length) continue;
  try {
    appliedTopics[repoName] = await applyRepoTopics(repoName, required);
  } catch (error) {
    console.warn(`topics ${repoName} failed:`, error.message);
    appliedTopics[repoName] = required;
  }
}

const [lab, karya, archive] = await Promise.all([
  withImages(labRepos.filter((r) => !r.fork)),
  withImages(karyaSource, {
    karya: true,
    mapExtra: (repo) => ({
      topics: appliedTopics[repo.name] || buildRepoTopics(repo.name),
      topicGroups: topicGroupsForRepo(repo.name),
    }),
  }),
  withImages(archiveSource.slice(0, 60)),
]);

const catalog = {
  generatedAt: new Date().toISOString(),
  owner: OWNER,
  topics: {
    lab: TOPIC_LAB,
    karya: TOPIC_KARYA,
  },
  karyaTopicManifest: karyaTopicsManifest,
  lab,
  karya,
  archive,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, `${JSON.stringify(catalog, null, 2)}\n`);
console.log('Wrote', OUT_FILE);
console.log('DONE');
