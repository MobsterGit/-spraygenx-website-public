(() => {
  'use strict';

  const recordGrid = document.querySelector('.record-grid');
  if (recordGrid && !recordGrid.querySelector('[data-record="westfield-floor"]')) {
    const article = document.createElement('article');
    article.className = 'record-card';
    article.dataset.record = 'westfield-floor';
    article.innerHTML = '<span class="record-id">SGX-J-2026-007</span><p>Failure Analysis</p><h3>Westfield Control Room Floor Repaint</h3><a href="westfield-control-room-floor-repaint/">Read failure analysis →</a>';
    recordGrid.prepend(article);
  }

  const input = document.getElementById('journalSearch');
  const grid = document.querySelector('[data-journal-grid]');
  const status = document.getElementById('journalSearchStatus');

  if (!input || !grid) return;

  const cards = Array.from(grid.querySelectorAll('.category-card'));

  const updateResults = () => {
    const query = input.value.trim().toLowerCase();
    let visible = 0;

    cards.forEach((card) => {
      const searchable = `${card.dataset.title || ''} ${card.textContent || ''}`.toLowerCase();
      const match = !query || searchable.includes(query);
      card.hidden = !match;
      if (match) visible += 1;
    });

    if (!status) return;
    status.textContent = query
      ? `${visible} journal department${visible === 1 ? '' : 's'} found.`
      : 'Search all journal departments.';
  };

  input.addEventListener('input', updateResults);
  updateResults();
})();
