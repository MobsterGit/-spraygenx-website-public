(() => {
  const feed = document.getElementById('regionalUpdates');
  if (!feed) return;

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);

  const safeUrl = value => {
    try {
      const url = new URL(value, window.location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
    } catch {
      return '#';
    }
  };

  const formatDate = value => {
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    }).format(date);
  };

  const renderArticle = article => {
    const sections = Array.isArray(article.sections) ? article.sections : [];
    const sources = Array.isArray(article.sources) ? article.sources : [];
    const sectionHtml = sections.map(section => `
      <section class="insights-card">
        <h3>${escapeHtml(section.heading)}</h3>
        <p>${escapeHtml(section.content)}</p>
      </section>`).join('');
    const sourceHtml = sources.length ? `
      <div class="insights-sources">
        <h3>Sources and further reading</h3>
        <ul>${sources.map(source => `<li><a href="${safeUrl(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`).join('')}</ul>
      </div>` : '';

    return `<article class="insights-article">
      <header class="insights-article-header">
        <div class="insights-meta"><span>${escapeHtml(formatDate(article.date))}</span><span>Northeast Ohio</span></div>
        <h2>${escapeHtml(article.title)}</h2>
        <p class="insights-summary">${escapeHtml(article.summary)}</p>
      </header>
      <div class="insights-grid">${sectionHtml}</div>
      <div class="insights-takeaway"><strong>Practical takeaway</strong><p>${escapeHtml(article.takeaway)}</p></div>
      ${sourceHtml}
    </article>`;
  };

  fetch(`data/regional-updates/index.json?ts=${Date.now()}`, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(async index => {
      const files = Array.isArray(index.updates) ? index.updates.slice(0, 12) : [];
      if (!files.length) {
        feed.innerHTML = '<div class="insights-empty"><strong>First regional briefing coming soon.</strong><br>New Northeast Ohio commercial painting, coatings and contractor-market updates will appear here after editorial review.</div>';
        return;
      }
      const articles = await Promise.all(files.map(file => fetch(`data/regional-updates/${encodeURIComponent(file)}?ts=${Date.now()}`, { cache: 'no-store' }).then(response => {
        if (!response.ok) throw new Error(`Unable to load ${file}`);
        return response.json();
      })));
      feed.innerHTML = articles.map(renderArticle).join('');
    })
    .catch(error => {
      console.error('Regional updates failed to load:', error);
      feed.innerHTML = '<div class="insights-error">The latest industry briefing could not be loaded. Please check back shortly.</div>';
    });
})();
