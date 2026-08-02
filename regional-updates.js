(() => {
  const feed = document.getElementById('regionalUpdates');
  const archive = document.getElementById('reportArchive');
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

  const articleId = article => `report-${String(article.date || '').replace(/[^0-9-]/g, '')}`;

  const showConfirmation = text => {
    const note = document.createElement('div');
    note.className = 'copy-confirm';
    note.textContent = text;
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 1800);
  };

  const copyText = async text => {
    try {
      await navigator.clipboard.writeText(text);
      showConfirmation('Link copied');
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      showConfirmation('Link copied');
    }
  };

  const shareUrlFor = article => `${location.origin}${location.pathname}#${articleId(article)}`;

  const shareArticle = async article => {
    const url = shareUrlFor(article);
    const data = {
      title: article.title || 'Commercial Painting & Coatings Report',
      text: article.summary || 'Commercial painting and coatings industry report.',
      url
    };
    if (navigator.share) {
      try { await navigator.share(data); } catch {}
    } else {
      await copyText(url);
    }
  };

  const renderArticle = article => {
    const sections = Array.isArray(article.sections) ? article.sections : [];
    const sources = Array.isArray(article.sources) ? article.sources : [];
    const id = articleId(article);
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
    const citation = `Commercial Painting & Coatings Report. “${article.title || 'Industry Report'}.” ${formatDate(article.date)}. Spray GenX LLC. ${shareUrlFor(article)}`;

    return `<article class="insights-article" id="${id}" data-report-date="${escapeHtml(article.date)}">
      <header class="insights-article-header">
        <div class="insights-meta"><span>${escapeHtml(formatDate(article.date))}</span><span>Commercial Painting &amp; Coatings Report</span></div>
        <h2>${escapeHtml(article.title)}</h2>
        <p class="insights-summary">${escapeHtml(article.summary)}</p>
      </header>
      <div class="insights-tools">
        <button type="button" data-article-share="${id}">Share report</button>
        <button type="button" data-article-print="${id}">Print / Save PDF</button>
        <button type="button" data-article-copy="${id}">Copy link</button>
        <button type="button" data-article-cite="${escapeHtml(citation)}">Copy citation</button>
      </div>
      <div class="insights-grid">${sectionHtml}</div>
      <div class="insights-takeaway"><strong>Market outlook</strong><p>${escapeHtml(article.takeaway)}</p></div>
      ${sourceHtml}
      <div class="report-citation"><strong>Cite this report:</strong><br>${escapeHtml(citation)}</div>
    </article>`;
  };

  const bindArticleTools = articles => {
    const byId = new Map(articles.map(article => [articleId(article), article]));
    document.querySelectorAll('[data-article-share]').forEach(button => {
      button.addEventListener('click', () => shareArticle(byId.get(button.dataset.articleShare)));
    });
    document.querySelectorAll('[data-article-copy]').forEach(button => {
      button.addEventListener('click', () => {
        const article = byId.get(button.dataset.articleCopy);
        if (article) copyText(shareUrlFor(article));
      });
    });
    document.querySelectorAll('[data-article-print]').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.articlePrint;
        if (history.replaceState) history.replaceState(null, '', `#${id}`);
        window.print();
      });
    });
    document.querySelectorAll('[data-article-cite]').forEach(button => {
      button.addEventListener('click', () => copyText(button.dataset.articleCite || ''));
    });
  };

  const renderArchive = articles => {
    if (!archive) return;
    if (!articles.length) {
      archive.textContent = 'The first edition will appear here after publication.';
      return;
    }
    archive.innerHTML = articles.map(article => `<a href="#${articleId(article)}"><span>${escapeHtml(formatDate(article.date))}</span><span>View →</span></a>`).join('');
  };

  const bindGlobalTools = () => {
    document.querySelectorAll('[data-report-print]').forEach(button => button.addEventListener('click', () => window.print()));
    document.querySelectorAll('[data-report-copy]').forEach(button => button.addEventListener('click', () => copyText(location.href)));
    document.querySelectorAll('[data-report-share]').forEach(button => button.addEventListener('click', async () => {
      const data = {
        title: 'Commercial Painting & Coatings Report',
        text: 'Industry reporting for commercial painting, industrial coatings and facility maintenance professionals.',
        url: location.href
      };
      if (navigator.share) {
        try { await navigator.share(data); } catch {}
      } else {
        copyText(location.href);
      }
    }));
  };

  bindGlobalTools();

  fetch(`data/regional-updates/index.json?ts=${Date.now()}`, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(async index => {
      const files = Array.isArray(index.updates) ? index.updates.slice(0, 52) : [];
      if (!files.length) {
        feed.innerHTML = '<div class="insights-empty"><strong>First edition coming soon.</strong><br>The Commercial Painting & Coatings Report will publish sourced market, product, pricing, bidding, safety and technical coverage for industry professionals.</div>';
        renderArchive([]);
        return;
      }
      const articles = await Promise.all(files.map(file => fetch(`data/regional-updates/${encodeURIComponent(file)}?ts=${Date.now()}`, { cache: 'no-store' }).then(response => {
        if (!response.ok) throw new Error(`Unable to load ${file}`);
        return response.json();
      })));
      feed.innerHTML = articles.map(renderArticle).join('');
      renderArchive(articles);
      bindArticleTools(articles);
      if (location.hash) {
        const target = document.querySelector(location.hash);
        if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      }
    })
    .catch(error => {
      console.error('Commercial Painting & Coatings Report failed to load:', error);
      feed.innerHTML = '<div class="insights-error">The latest report could not be loaded. Please check back shortly.</div>';
      if (archive) archive.textContent = 'Archive temporarily unavailable.';
    });
})();
