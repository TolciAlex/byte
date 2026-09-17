import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const contentDir = path.join(rootDir, 'content', 'posts');
const imagesDir = path.join(rootDir, 'images');
const siteUrl = process.env.SITE_URL || '';

const STATIC_COPY = ['css', 'images', 'js'];

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function applyInlineFormatting(text = '') {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?!\s)(.+?)(?<!\s)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function validateSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function validateAssetPath(assetPath) {
  return typeof assetPath === 'string' && assetPath.startsWith('/images/') && !assetPath.includes('..');
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function removeDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

async function copyDir(src, dest) {
  const entries = await fs.readdir(src, { withFileTypes: true });
  await ensureDir(dest);
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function loadImageManifest() {
  const images = [];
  const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

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

function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

function absoluteUrl(relativePath) {
  return siteUrl ? `${siteUrl}${relativePath}` : relativePath;
}

function renderHeader() {
  const contactLink = '/#footer';
  const aboutLink = '/about/';
  const privacyLink = '/privacy/';
  return `
  <header class="site-header">
    <div>
      <a class="logo" href="/">BYTE</a>
      <p class="tagline">Get a byte of Fashion & Culture</p>
    </div>
    <nav class="header-nav">
      <a href="${aboutLink}">About</a>
      <a href="${contactLink}">Contact</a>
      <a href="${privacyLink}">Privacy</a>
    </nav>
  </header>`;
}

function renderFooter() {
  return `
  <footer id="footer" class="site-footer">
    <div class="footer-section">
      <h3 class="footer-heading">About BYTE</h3>
      <p>BYTE is a magazine about culture, art, and fashion bringing a new perspective and putting the spotlight on upcoming designers shaping the future.</p>
    </div>
    <div class="footer-section">
      <h3 class="footer-heading">Get in Touch</h3>
      <p><strong>General Inquiries:</strong><br><a href="mailto:contact@byte-magazine.com">contact@byte-magazine.com</a></p>
      <p><strong>Submissions & Collaborations:</strong><br><a href="mailto:submissions@byte-magazine.com">submissions@byte-magazine.com</a></p>
    </div>
    <div class="footer-section">
      <h3 class="footer-heading">Follow Us</h3>
      <p><a href="https://www.instagram.com/bytewearmagazine/?hl=en" target="_blank" rel="noopener">Instagram: @bytewearmagazine</a></p>
    </div>
    <div class="footer-links">
      <a href="/about/">About</a>
      <a href="/privacy/">Privacy</a>
    </div>
  </footer>`;
}

function renderCookieBanner() {
  return `
  <div id="cookie-banner" class="cookie-banner hidden">
    <div class="cookie-message">We use cookies to improve your experience. By continuing to browse, you agree to our use of cookies.</div>
    <div class="cookie-actions">
      <button class="cookie-btn" id="cookie-decline">Decline</button>
      <button class="cookie-btn accept" id="cookie-accept">Accept</button>
    </div>
  </div>
  <script src="/js/cookies.js"></script>`;
}

function renderShell({ title, description, bodyClass = '', canonicalPath = '/', ogImage = '' }, inner) {
  const canonical = absoluteUrl(canonicalPath);
  const imageUrl = ogImage ? absoluteUrl(ogImage) : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  ${imageUrl ? `<meta property="og:image" content="${imageUrl}">` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@400;600;700&family=Bodoni+Moda:opsz,wght@6..96,400;6..96,700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body class="${bodyClass}">
${inner}
</body>
</html>`;
}

function renderTextBlock(content) {
  return `<p>${applyInlineFormatting(content)}</p>`;
}

function renderImageBlock(block) {
  const alt = escapeHtml(block.alt || 'Article image');
  const credit = block.credit ? `<span class="image-credit">${escapeHtml(block.credit)}</span>` : '';
  const caption = block.caption ? `<figcaption>${escapeHtml(block.caption)}${credit ? ` ${credit}` : ''}</figcaption>` : credit ? `<figcaption>${credit}</figcaption>` : '';
  return `<figure class="article-block image-block"><img src="${escapeHtml(block.src)}" alt="${alt}">${caption}</figure>`;
}

function renderHeadingBlock(block) {
  const level = Math.min(4, Math.max(2, Number(block.level || 2)));
  return `<h${level}>${applyInlineFormatting(block.content || '')}</h${level}>`;
}

function renderQuoteBlock(block) {
  const cite = block.cite ? `<cite>${escapeHtml(block.cite)}</cite>` : '';
  return `<blockquote>${applyInlineFormatting(block.content || '')}${cite}</blockquote>`;
}

function renderSpacerBlock(block) {
  const height = block.height || '1.5rem';
  return `<div class="spacer" style="height:${escapeHtml(height)}"></div>`;
}

function renderBlocks(blocks = []) {
  return blocks.map((block) => {
    switch (block.type) {
      case 'text':
        return renderTextBlock(block.content || '');
      case 'image':
        return renderImageBlock(block);
      case 'heading':
        return renderHeadingBlock(block);
      case 'quote':
        return renderQuoteBlock(block);
      case 'spacer':
        return renderSpacerBlock(block);
      default:
        return '';
    }
  }).join('\n');
}

function renderArticlePage(post) {
  const body = `
${renderHeader()}
  <article class="story-page">
    <div class="article-kicker">${escapeHtml(post.category)}</div>
    <h1 class="story-title">${escapeHtml(post.title)}</h1>
    ${post.subtitle ? `<p class="story-deck">${escapeHtml(post.subtitle)}</p>` : ''}
    <figure class="story-hero">
      <img src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.title)} cover">
    </figure>
    <div class="story-body">
      ${renderBlocks(post.blocks)}
    </div>
  </article>
${renderFooter()}
${renderCookieBanner()}`;

  return renderShell({
    title: `BYTE | ${post.title}`,
    description: post.subtitle || post.title,
    bodyClass: 'article-page',
    canonicalPath: `/${post.slug}/`,
    ogImage: post.cover
  }, body);
}

function renderHomePage(posts) {
  const cards = posts.map((post) => `
    <a class="image-card" href="/${post.slug}/" aria-label="Read ${escapeHtml(post.title)}">
      <div class="image-frame">
        <img src="${escapeHtml(post.cover)}" alt="Cover image for ${escapeHtml(post.title)}" loading="lazy">
        <h2 class="card-title">${escapeHtml(post.title)}</h2>
      </div>
    </a>`).join('\n');

  const body = `
${renderHeader()}
  <main class="home-main" aria-label="Magazine stories">
    <section class="masonry-grid" aria-label="Featured posts">
${cards}
    </section>
  </main>
${renderFooter()}
${renderCookieBanner()}`;

  return renderShell({
    title: 'BYTE | Fashion Magazine',
    description: 'BYTE is a black-and-white fashion and design magazine.',
    bodyClass: 'home-page',
    canonicalPath: '/'
  }, body);
}

function renderStaticPage({ title, description, bodyClass = 'page', canonicalPath, content }) {
  const body = `
${renderHeader()}
  <article class="story-page">
    <h1 class="story-title">${escapeHtml(title)}</h1>
    <div class="story-body">${content}</div>
  </article>
${renderFooter()}
${renderCookieBanner()}`;

  return renderShell({ title: `BYTE | ${title}`, description, bodyClass, canonicalPath }, body);
}

async function loadPosts() {
  const files = await fs.readdir(contentDir);
  const posts = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(contentDir, file);
    const raw = await fs.readFile(filePath, 'utf8');
    const stat = await fs.stat(filePath);
    const post = JSON.parse(raw);

    if (post.status !== 'published') continue;
    if (!validateSlug(post.slug)) throw new Error(`Invalid slug: ${post.slug}`);
    if (!validateAssetPath(post.cover)) throw new Error(`Invalid cover path for ${post.slug}`);

    post.title = post.title || '';
    post.subtitle = post.subtitle || '';
    post.category = post.category || 'EDITORIAL';
    post.date = post.date || stat.mtime.toISOString().slice(0, 10);
    post.instagram = post.instagram || '';
    post.modifiedTime = stat.mtimeMs;

    for (const block of post.blocks || []) {
      if (block.type === 'image' && !validateAssetPath(block.src)) {
        throw new Error(`Invalid image path in ${post.slug}: ${block.src}`);
      }
    }

    posts.push(post);
  }

  posts.sort((a, b) => {
    const dateDiff = new Date(b.date) - new Date(a.date);
    if (dateDiff !== 0) return dateDiff;
    return (b.modifiedTime || 0) - (a.modifiedTime || 0);
  });
  return posts;
}

async function writeHtml(filePath, html) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, html, 'utf8');
}

async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function writeSitePages(outputDir, posts, aboutHtml, privacyHtml) {
  await writeHtml(path.join(outputDir, 'index.html'), renderHomePage(posts));
  await writeHtml(path.join(outputDir, 'about', 'index.html'), aboutHtml);
  await writeHtml(path.join(outputDir, 'privacy', 'index.html'), privacyHtml);

  for (const post of posts) {
    await writeHtml(path.join(outputDir, post.slug, 'index.html'), renderArticlePage(post));
  }
}

async function cleanRootGeneratedRoutes(posts) {
  await removeDir(path.join(rootDir, 'blog'));

  for (const post of posts) {
    await removeDir(path.join(rootDir, 'blog', post.slug));
  }
}

async function build() {
  const posts = await loadPosts();
  const imageManifest = await loadImageManifest();

  await removeDir(distDir);
  await ensureDir(distDir);
  await cleanRootGeneratedRoutes(posts);

  for (const dir of STATIC_COPY) {
    const src = path.join(rootDir, dir);
    const dest = path.join(distDir, dir);
    await copyDir(src, dest);
  }

  const publishedContentDir = path.join(distDir, 'content', 'posts');
  await ensureDir(publishedContentDir);

  const manifest = posts.map(({ title, slug, subtitle, date, category, cover, status }) => ({
    title,
    slug,
    subtitle,
    date,
    category,
    cover,
    status
  }));

  await writeJson(path.join(distDir, 'content', 'index.json'), manifest);
  await writeJson(path.join(rootDir, 'content', 'index.json'), manifest);
  await writeJson(path.join(distDir, 'content', 'image-index.json'), imageManifest);
  await writeJson(path.join(rootDir, 'content', 'image-index.json'), imageManifest);

  for (const post of posts) {
    await writeJson(path.join(publishedContentDir, `${post.slug}.json`), post);
  }

  const aboutHtml = renderStaticPage({
    title: 'About',
    description: 'About BYTE Magazine.',
    canonicalPath: '/about/',
    content: `
      <p>BYTE is a magazine about culture, art, and fashion that wants to bring a new perspective and put the spotlight on the upcoming designers that are giving us the direction towards the future we're building.</p>
      <p>We believe in celebrating emerging creative voices and exploring the visual languages that define contemporary culture. From runway innovations to cultural trends, BYTE documents the aesthetic movements shaping tomorrow.</p>
      <p><a href="https://www.instagram.com/bytewearmagazine/?hl=en" target="_blank" rel="noopener">Follow BYTE on Instagram</a></p>`
  });

  const privacyHtml = renderStaticPage({
    title: 'Privacy & Cookies',
    description: 'Privacy policy and cookie information for BYTE Magazine.',
    canonicalPath: '/privacy/',
    content: `
      <p><strong>Our Commitment to Your Privacy</strong></p>
      <p>BYTE is committed to protecting your privacy and ensuring transparent data practices. This policy outlines how we collect, use, store, and protect your personal information in compliance with GDPR and other privacy regulations.</p>
      <p><strong>What Data We Collect</strong></p>
      <p>We collect minimal data necessary to provide our services. This may include email addresses, information you voluntarily provide in submissions or inquiries, and basic analytics data that is anonymized and aggregated.</p>
      <p><strong>How We Use Your Data</strong></p>
      <p>Any personal information you provide is used solely for responding to your inquiries and submissions, sending updates or newsletters only if you opt in, and improving your experience on BYTE.</p>
      <p>We do not use your data for marketing purposes without explicit consent, and we never sell, trade, or share your personal information with third parties.</p>
      <p><strong>Data Storage & Security</strong></p>
      <p>All personal data is stored securely using industry-standard encryption and security protocols. We retain data only for as long as necessary to fulfill the purposes outlined above.</p>
      <p><strong>Your Rights Under GDPR</strong></p>
      <p>If you are in the European Union or another jurisdiction with similar data protection laws, you have the right to access, rectify, delete, and export your personal data, and to withdraw consent for processing at any time.</p>
      <p>To exercise any of these rights, contact us at <a href="mailto:contact@byte-magazine.com">contact@byte-magazine.com</a>. We will respond within 30 days where required by law.</p>
      <p><strong>Cookies</strong></p>
      <p>We use minimal cookies to enhance your browsing experience. The cookie banner on our site allows you to accept or decline cookies. No cookies are used for targeted advertising.</p>
      <p><strong>Third-Party Services</strong></p>
      <p>BYTE may use third-party services for hosting and analytics. These services maintain their own privacy policies and data processing obligations.</p>
      <p><strong>Policy Changes</strong></p>
      <p>We may update this privacy policy periodically. Significant changes will be reflected on this page with an updated date.</p>
      <p><strong>Contact</strong></p>
      <p>For privacy inquiries or deletion requests, contact <a href="mailto:contact@byte-magazine.com">contact@byte-magazine.com</a>.</p>
      <p>Last updated: September 2026</p>`
  });

  await writeSitePages(distDir, posts, aboutHtml, privacyHtml);
  await writeSitePages(rootDir, posts, aboutHtml, privacyHtml);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
