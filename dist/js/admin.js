async function loadArticles() {
  const response = await fetch('/content/index.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load article manifest');
  return response.json();
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function renderRows(articles) {
  const table = document.getElementById('articles-table');
  if (!table) return;

  table.innerHTML = articles.map((article) => `
    <tr>
      <td>
        <strong>${escapeHtml(article.title)}</strong><br>
        <small>${escapeHtml(article.slug)}</small>
      </td>
      <td>${escapeHtml(formatDate(article.date))}</td>
      <td>${escapeHtml(article.status)}</td>
      <td>${escapeHtml(article.category)}</td>
      <td>
        <a class="admin-link" href="editor.html?slug=${encodeURIComponent(article.slug)}">Edit</a>
        <button class="admin-link button-link" type="button" data-action="toggle" data-slug="${escapeHtml(article.slug)}">Delete / Unpublish</button>
      </td>
    </tr>
  `).join('');

  table.querySelectorAll('[data-action="toggle"]').forEach((button) => {
    button.addEventListener('click', () => {
      window.alert('Local workflow: unpublish by changing the JSON file in content/posts, then rebuild and sync with git.');
    });
  });
}

loadArticles().then(renderRows).catch((error) => {
  const table = document.getElementById('articles-table');
  if (table) {
    table.innerHTML = `<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>`;
  }
});
