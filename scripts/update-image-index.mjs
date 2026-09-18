import { promises as fs, watch as fsWatch } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const imagesDir = path.join(rootDir, 'images');
const rootManifestPath = path.join(rootDir, 'content', 'image-index.json');
const distManifestPath = path.join(rootDir, 'dist', 'content', 'image-index.json');
const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadImageManifest() {
  const images = [];

  async function walk(dir, relativeBase = '') {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      const relativePath = path.posix.join(relativeBase, entry.name);

      if (entry.isDirectory()) {
        await walk(entryPath, relativePath);
        continue;
      }

      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!allowedExt.has(ext)) continue;

      const stat = await fs.stat(entryPath);
      images.push({
        path: `/images/${relativePath}`,
        name: entry.name,
        modified: stat.mtimeMs
      });
    }
  }

  await walk(imagesDir);
  images.sort((a, b) => b.modified - a.modified);
  return images.map(({ modified, ...rest }) => rest);
}

async function updateImageManifest() {
  const manifest = await loadImageManifest();
  await writeJson(rootManifestPath, manifest);

  if (await pathExists(path.join(rootDir, 'dist'))) {
    await writeJson(distManifestPath, manifest);
  }

  return manifest.length;
}

async function runOnce() {
  const total = await updateImageManifest();
  console.log(`Updated image manifest with ${total} images.`);
}

function debounce(fn, delay) {
  let timer = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn().catch((error) => {
        console.error(error);
      });
    }, delay);
  };
}

async function runWatch() {
  await runOnce();
  console.log('Watching images/ for changes...');

  const triggerUpdate = debounce(async () => {
    const total = await updateImageManifest();
    console.log(`Refreshed image manifest (${total} images).`);
  }, 200);

  fsWatch(imagesDir, { recursive: true }, (_eventType, fileName) => {
    if (!fileName) return;
    const ext = path.extname(fileName).toLowerCase();
    if (!allowedExt.has(ext)) return;
    triggerUpdate();
  });
}

const shouldWatch = process.argv.includes('--watch');

if (shouldWatch) {
  runWatch().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  runOnce().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
