const IMAGE_MANIFEST_URL = '../content/image-index.json';
const POST_CONTENT_BASE_URL = '../content/posts';

const initialState = {
  title: '',
  slug: '',
  subtitle: '',
  cover: '',
  date: '',
  category: 'EDITORIAL',
  status: 'published',
  blocks: [{ type: 'text', content: '' }]
};

let state = JSON.parse(JSON.stringify(initialState));
let imageOptions = [];

function getEditorStatus() {
  return document.getElementById('editor-status');
}

function setEditorStatus(message) {
  const status = getEditorStatus();
  if (status) status.textContent = message;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineFormat(text = '') {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?!\s)(.+?)(?<!\s)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function requestedSlug() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('slug') || '').trim();
}

async function loadImageOptions() {
  try {
    const response = await fetch(`${IMAGE_MANIFEST_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('manifest unavailable');
    imageOptions = await response.json();
  } catch {
    imageOptions = [];
  }
}

function isImagePath(value = '') {
  return value.startsWith('/images/') && !value.includes('..');
}

function normalizeBlockType(block) {
  const type = block.type || 'text';
  const normalized = { type };

  if (type === 'image') {
    normalized.src = block.src || '';
    normalized.alt = block.alt || '';
    normalized.caption = block.caption || '';
    normalized.credit = block.credit || '';
  } else if (type === 'heading') {
    normalized.content = block.content || '';
    normalized.level = block.level || 2;
  } else if (type === 'quote') {
    normalized.content = block.content || '';
    normalized.cite = block.cite || '';
  } else if (type === 'spacer') {
    normalized.height = block.height || '1.5rem';
  } else {
    normalized.content = block.content || '';
  }

  return normalized;
}

function blockTypeOptions(selected) {
  return ['text', 'image', 'heading', 'quote', 'spacer']
    .map((type) => `<option value="${type}" ${type === selected ? 'selected' : ''}>${type}</option>`)
    .join('');
}

function imageOptionMarkup(selectedPath = '') {
  const options = imageOptions.length ? imageOptions : [{ path: '', name: 'No images found' }];
  const current = selectedPath && !options.some((option) => option.path === selectedPath)
    ? [{ path: selectedPath, name: selectedPath.split('/').pop() || selectedPath }].concat(options)
    : options;

  return ['<option value="">Select an image</option>']
    .concat(current.map((option) => `<option value="${escapeHtml(option.path)}" ${option.path === selectedPath ? 'selected' : ''}>${escapeHtml(option.name)}</option>`))
    .join('');
}

function loadDraft() {
  const slug = state.slug || 'untitled-draft';
  const saved = localStorage.getItem(`byte-draft-${slug}`);
  if (!saved) return;

  try {
    state = { ...state, ...JSON.parse(saved) };
  } catch {
    // ignore invalid local drafts
  }
}

function normalizeBlocks(blocks) {
  if (!Array.isArray(blocks) || !blocks.length) {
    return [{ type: 'text', content: '' }];
  }

  return blocks.map((block) => normalizeBlockType(block || {}));
}

async function loadArticleFromSlug(slug) {
  const response = await fetch(`${POST_CONTENT_BASE_URL}/${encodeURIComponent(slug)}.json`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Could not load ${slug}.json`);
  }

  const article = await response.json();
  state = {
    ...JSON.parse(JSON.stringify(initialState)),
    ...article,
    blocks: normalizeBlocks(article.blocks)
  };
}

function renderCoverField() {
  const cover = document.getElementById('cover');
  const coverCustom = document.getElementById('cover-custom');
  if (!cover || !coverCustom) return;

  cover.innerHTML = imageOptionMarkup(state.cover);
  coverCustom.value = state.cover || '';

  cover.onchange = () => {
    state.cover = cover.value;
    coverCustom.value = state.cover;
    updatePreview();
  };

  coverCustom.oninput = () => {
    state.cover = coverCustom.value.trim();
    cover.innerHTML = imageOptionMarkup(state.cover);
    updatePreview();
  };
}

function bindFields() {
  const title = document.getElementById('title');
  const slug = document.getElementById('slug');

  if (title) {
    title.value = state.title || '';
    title.addEventListener('input', () => {
      state.title = title.value;
      updatePreview();
    });
  }

  if (slug) {
    slug.value = state.slug || '';
    slug.addEventListener('input', () => {
      state.slug = slug.value.trim();
    });
  }

  renderCoverField();
}

function renderBlockFields(block) {
  if (block.type === 'image') {
    return `
      <label><span>Image from folder</span><select data-field="src">${imageOptionMarkup(block.src || '')}</select></label>
      <label><span>Image path</span><input data-field="src" type="text" value="${escapeHtml(block.src || '')}" placeholder="/images/your-image.jpg"></label>
      <label><span>Alt text</span><input data-field="alt" type="text" value="${escapeHtml(block.alt || '')}" placeholder="Describe the image"></label>
      <label><span>Caption</span><input data-field="caption" type="text" value="${escapeHtml(block.caption || '')}" placeholder="Optional caption"></label>
      <label><span>Credit</span><input data-field="credit" type="text" value="${escapeHtml(block.credit || '')}" placeholder="Optional credit"></label>
    `;
  }

  if (block.type === 'heading') {
    return `
      <label><span>Heading text</span><input data-field="content" type="text" value="${escapeHtml(block.content || '')}"></label>
      <label><span>Heading level</span><input data-field="level" type="number" min="2" max="4" value="${escapeHtml(block.level || 2)}"></label>
    `;
  }

  if (block.type === 'quote') {
    return `
      <label><span>Quote text</span><textarea data-field="content">${escapeHtml(block.content || '')}</textarea></label>
      <label><span>Cite</span><input data-field="cite" type="text" value="${escapeHtml(block.cite || '')}"></label>
    `;
  }

  if (block.type === 'spacer') {
    return `
      <label><span>Spacer height</span><input data-field="height" type="text" value="${escapeHtml(block.height || '1.5rem')}"></label>
    `;
  }

  return `
    <label><span>Paragraph text</span><textarea data-field="content">${escapeHtml(block.content || '')}</textarea></label>
  `;
}

function blockTemplate(block, index) {
  return `
    <div class="block-item" data-index="${index}">
      <div class="block-row">
        <label>
          <span>Type</span>
          <select data-field="type">${blockTypeOptions(block.type)}</select>
        </label>
        <div class="block-controls">
          <button type="button" data-action="up">↑</button>
          <button type="button" data-action="down">↓</button>
          <button type="button" data-action="duplicate">Duplicate</button>
          <button type="button" data-action="delete">Delete</button>
        </div>
      </div>
      <div class="block-fields">
        ${renderBlockFields(block)}
      </div>
    </div>`;
}

function renderBlocks() {
  const container = document.getElementById('blocks');
  if (!container) return;

  container.innerHTML = state.blocks.map((block, index) => blockTemplate(block, index)).join('');

  container.querySelectorAll('.block-item').forEach((item) => {
    const index = Number(item.dataset.index);

    item.querySelectorAll('[data-field]').forEach((field) => {
      field.addEventListener('input', () => {
        const block = state.blocks[index];
        block[field.dataset.field] = field.value;

        if (field.dataset.field === 'type') {
          state.blocks[index] = normalizeBlockType(block);
          renderBlocks();
        } else {
          updatePreview();
        }
      });
    });

    item.querySelector('[data-action="up"]').addEventListener('click', () => moveBlock(index, -1));
    item.querySelector('[data-action="down"]').addEventListener('click', () => moveBlock(index, 1));
    item.querySelector('[data-action="duplicate"]').addEventListener('click', () => duplicateBlock(index));
    item.querySelector('[data-action="delete"]').addEventListener('click', () => deleteBlock(index));
  });
}

function moveBlock(index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= state.blocks.length) return;
  const [item] = state.blocks.splice(index, 1);
  state.blocks.splice(nextIndex, 0, item);
  renderBlocks();
  updatePreview();
}

function duplicateBlock(index) {
  state.blocks.splice(index + 1, 0, JSON.parse(JSON.stringify(state.blocks[index])));
  renderBlocks();
  updatePreview();
}

function deleteBlock(index) {
  state.blocks.splice(index, 1);
  if (!state.blocks.length) {
    state.blocks.push({ type: 'text', content: '' });
  }
  renderBlocks();
  updatePreview();
}

function addBlock() {
  state.blocks.push({ type: 'text', content: '' });
  renderBlocks();
  updatePreview();
}

function footerMarkup() {
  return `
    <footer class="site-footer">
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
        <a href="../pages/about.html">About</a>
        <a href="../pages/privacy.html">Privacy</a>
      </div>
    </footer>`;
}

function articlePreviewMarkup() {
  const blocks = state.blocks.map((block) => {
    if (block.type === 'image') {
      return `<figure><img src="${escapeHtml(block.src || '')}" alt="${escapeHtml(block.alt || '')}">${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ''}</figure>`;
    }
    if (block.type === 'heading') {
      const level = Math.min(4, Math.max(2, Number(block.level || 2)));
      return `<h${level}>${inlineFormat(block.content || '')}</h${level}>`;
    }
    if (block.type === 'quote') {
      return `<blockquote>${inlineFormat(block.content || '')}${block.cite ? `<cite>${escapeHtml(block.cite)}</cite>` : ''}</blockquote>`;
    }
    if (block.type === 'spacer') {
      return `<div style="height:${escapeHtml(block.height || '1.5rem')}"></div>`;
    }
    return `<p>${inlineFormat(block.content || '')}</p>`;
  }).join('');

  return `
    <article class="story-page preview-article">
      <h1 class="story-title">${escapeHtml(state.title || 'Untitled Article')}</h1>
      ${state.cover ? `<figure class="story-hero"><img src="${escapeHtml(state.cover)}" alt="${escapeHtml(state.title || 'Article cover')}"></figure>` : ''}
      <div class="story-body">${blocks}</div>
      ${footerMarkup()}
    </article>`;
}

function updatePreview() {
  const preview = document.getElementById('preview');
  if (preview) preview.innerHTML = articlePreviewMarkup();
}

async function refreshImages() {
  await loadImageOptions();
  renderCoverField();
  renderBlocks();

  if (imageOptions.length) {
    setEditorStatus(`Loaded ${imageOptions.length} images from the current manifest.`);
  } else {
    setEditorStatus('Image manifest unavailable. Type the /images/... path directly or run npm.cmd run build.');
  }
}

function saveDraft() {
  const slug = state.slug || 'untitled-draft';
  localStorage.setItem(`byte-draft-${slug}`, JSON.stringify(state));
  window.alert('Draft saved locally in this browser.');
}

function buildDownloadPayload() {
  const slug = (state.slug || 'untitled-draft').trim();
  return {
    title: state.title.trim(),
    slug,
    subtitle: (state.subtitle || '').trim(),
    cover: state.cover,
    blocks: state.blocks,
    date: state.date || today(),
    category: state.category || 'EDITORIAL',
    status: state.status || 'published'
  };
}

function downloadJson() {
  if (!state.title.trim()) {
    window.alert('Add a title first.');
    return;
  }

  if (!state.slug.trim()) {
    window.alert('Add a slug first.');
    return;
  }

  if (!state.cover.trim()) {
    window.alert('Choose a cover image first.');
    return;
  }

  if (!isImagePath(state.cover.trim())) {
    window.alert('Cover image must use a path like /images/your-image.jpg.');
    return;
  }

  const invalidImageBlock = state.blocks.find((block) => block.type === 'image' && !isImagePath((block.src || '').trim()));
  if (invalidImageBlock) {
    window.alert('Each image block must use a path like /images/your-image.jpg.');
    return;
  }

  const payload = buildDownloadPayload();
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${payload.slug}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function init() {
  await loadImageOptions();

  const slug = requestedSlug();

  if (slug) {
    try {
      await loadArticleFromSlug(slug);
      setEditorStatus(`Editing ${slug}.json from content/posts.`);
    } catch (error) {
      setEditorStatus(error.message);
    }
  } else {
    loadDraft();
  }

  bindFields();
  renderBlocks();
  updatePreview();

  document.getElementById('add-block')?.addEventListener('click', addBlock);
  document.getElementById('refresh-images')?.addEventListener('click', refreshImages);
  document.getElementById('save-draft')?.addEventListener('click', saveDraft);
  document.getElementById('preview-button')?.addEventListener('click', updatePreview);
  document.getElementById('download-button')?.addEventListener('click', downloadJson);
}

init();
