/**
 * @Author: rogue-dev-studio
 * @Date: 2026-09-23 11:15:00
 * @Last Modified by: rogue-dev-studio
 * @Last Modified time: 2026-09-23 11:15:00
 *
 * Sync catalog.json from public contributor sets (Shutterstock API).
 * Env: SHUTTERSTOCK_CLIENT_ID + SHUTTERSTOCK_CLIENT_SECRET
 *   (or CONSUMER_KEY / CONSUMER_SECRET)
 * Optional: SHUTTERSTOCK_CONTRIBUTOR_ID (default 298451514)
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const dir = __dirname;
const OUT = path.join(dir, "catalog.json");
const CONTRIBUTOR_ID = process.env.SHUTTERSTOCK_CONTRIBUTOR_ID || "298451514";
const PROFILE = "https://www.shutterstock.com/g/ArisHadisopiyan";
const KEY =
  process.env.SHUTTERSTOCK_CONSUMER_KEY ||
  process.env.SHUTTERSTOCK_CLIENT_ID ||
  "";
const SECRET =
  process.env.SHUTTERSTOCK_CONSUMER_SECRET ||
  process.env.SHUTTERSTOCK_CLIENT_SECRET ||
  "";
const PER_PAGE = 50;

function authHeader() {
  return "Basic " + Buffer.from(`${KEY}:${SECRET}`).toString("base64");
}

function getJson(urlPath) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.shutterstock.com",
        path: urlPath,
        method: "GET",
        headers: {
          Authorization: authHeader(),
          Accept: "application/json",
          "User-Agent": "rogue-dev-stock-sync/1.1",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          let data;
          try {
            data = JSON.parse(body);
          } catch (e) {
            reject(new Error(`JSON ${res.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          if (res.statusCode >= 400) {
            reject(
              new Error(
                `HTTP ${res.statusCode}: ${data.message || body.slice(0, 200)}`
              )
            );
            return;
          }
          resolve(data);
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(60000, () => req.destroy(new Error("timeout")));
    req.end();
  });
}

function loadExisting() {
  const map = new Map();
  if (!fs.existsSync(OUT)) return map;
  try {
    const cat = JSON.parse(fs.readFileSync(OUT, "utf8"));
    for (const it of cat.items || []) {
      if (it && it.id) map.set(String(it.id), it);
    }
  } catch (_) {}
  return map;
}

async function listCollections() {
  const data = await getJson(
    `/v2/contributors/${CONTRIBUTOR_ID}/collections?sort=newest`
  );
  return data.data || [];
}

async function listCollectionItems(collectionId) {
  const items = [];
  let page = 1;
  for (;;) {
    const data = await getJson(
      `/v2/contributors/${CONTRIBUTOR_ID}/collections/${collectionId}/items?page=${page}&per_page=${PER_PAGE}`
    );
    const batch = data.data || [];
    items.push(...batch);
    if (batch.length < PER_PAGE) break;
    page += 1;
    if (page > 40) break;
  }
  return items;
}

async function fetchImageMeta(id) {
  try {
    return await getJson(`/v2/images/${id}?view=full`);
  } catch (_) {
    return null;
  }
}

function pickThumb(assets) {
  if (!assets || typeof assets !== "object") return "";
  for (const name of ["huge_thumb", "preview", "large_thumb", "small_thumb"]) {
    const node = assets[name];
    if (node && node.url) return node.url;
  }
  return "";
}

function fromApiImage(raw, collectionName) {
  const id = String(raw.id);
  const imageType = (raw.image_type || "vector").toLowerCase();
  const desc = (raw.description || "").trim();
  let title = desc.split(".")[0].trim() || `Shutterstock ${id}`;
  if (title.length > 80) title = title.slice(0, 77) + "...";
  const thumb = pickThumb(raw.assets);
  const pathType = imageType === "vector" ? "vector" : "photo";
  const url =
    raw.url || `https://www.shutterstock.com/image-${pathType}/${id}`;
  if (!thumb) return null;
  return {
    id,
    title,
    url,
    thumb,
    kind: imageType,
    collection: collectionName || undefined,
  };
}

function toAddedAt(raw) {
  if (!raw) return "";
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return String(raw).slice(0, 10);
  return new Date(t).toISOString().slice(0, 10);
}

function fallbackFromId(id, existing, collectionName, addedAt) {
  if (existing.has(id)) {
    const prev = { ...existing.get(id) };
    if (collectionName) prev.collection = collectionName;
    if (addedAt && !prev.addedAt) prev.addedAt = addedAt;
    return prev;
  }
  return {
    id,
    title: `Shutterstock ${id}`,
    url: `https://www.shutterstock.com/image-vector/${id}`,
    thumb: `https://image.shutterstock.com/image-vector/${id}-260nw-${id}.jpg`,
    kind: "vector",
    collection: collectionName || undefined,
    addedAt: addedAt || undefined,
    downloadCount: 0,
    favoriteCount: 0,
    _needsEnrich: true,
  };
}

async function main() {
  if (!KEY || !SECRET) {
    console.error("Set SHUTTERSTOCK_CLIENT_ID and SHUTTERSTOCK_CLIENT_SECRET");
    process.exit(1);
  }
  const existing = loadExisting();
  const collections = await listCollections();
  console.log(
    JSON.stringify({
      collections: collections.map((c) => ({
        id: c.id,
        name: c.name,
        n: c.total_item_count,
      })),
    })
  );

  const seen = new Set();
  const items = [];
  let enrichedApi = 0;
  let fromCache = 0;
  let fallback = 0;

  for (const col of collections) {
    const rows = await listCollectionItems(col.id);
    console.log(`collection ${col.id} ${col.name}: ${rows.length} ids`);
    for (const row of rows) {
      const id = String(row.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const addedAt = toAddedAt(row.added_time || row.addedAt);

      let item = null;
      const apiImg =
        process.env.SKIP_IMAGE_DETAIL === "0" ? await fetchImageMeta(id) : null;
      if (apiImg) {
        item = fromApiImage(apiImg, col.name);
        if (item) {
          if (addedAt) item.addedAt = item.addedAt || addedAt;
          enrichedApi += 1;
        }
      }
      if (!item && existing.has(id)) {
        item = fallbackFromId(id, existing, col.name, addedAt);
        delete item._needsEnrich;
        fromCache += 1;
      }
      if (!item) {
        item = fallbackFromId(id, existing, col.name, addedAt);
        if (item._needsEnrich) {
          fallback += 1;
          delete item._needsEnrich;
        }
      }
      if (addedAt) item.addedAt = item.addedAt || addedAt;
      if (typeof item.downloadCount !== "number") item.downloadCount = 0;
      if (typeof item.favoriteCount !== "number") {
        item.favoriteCount =
          typeof item.likes === "number" ? item.likes : 0;
      }
      items.push(item);
    }
  }

  const catalog = {
    store: "shutterstock",
    profile: PROFILE,
    source: "contributor-collections",
    contributorId: CONTRIBUTOR_ID,
    updatedAt: new Date().toISOString(),
    total: items.length,
    collections: collections.map((c) => ({
      id: String(c.id),
      name: c.name,
      totalItemCount: c.total_item_count,
    })),
    items,
  };
  fs.writeFileSync(OUT, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  try {
    require("child_process").execFileSync(
      process.execPath,
      [path.join(__dirname, "_polish-catalog.js")],
      { stdio: "inherit", cwd: __dirname }
    );
  } catch (err) {
    console.error("polish skipped:", err && err.message);
  }
  console.log(
    JSON.stringify({
      wrote: items.length,
      enrichedApi,
      fromCache,
      fallback,
      out: OUT,
    })
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
