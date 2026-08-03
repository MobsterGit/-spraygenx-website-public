(() => {
  const completedOverall = 'https://i2.wp.com/96u.046.myftpupload.com/wp-content/uploads/2023/01/received_695596537610849-1024x768.jpeg?ssl=1';
  const completedFront = 'https://i0.wp.com/96u.046.myftpupload.com/wp-content/uploads/2023/01/received_249081969366815-1024x768.jpeg?ssl=1';

  // Correct the comparison header immediately: only completed photographs belong under AFTER.
  const afterPanel = document.querySelector('.comparison-panel.after');
  if (afterPanel) {
    const main = afterPanel.querySelector('.comparison-main');
    const details = afterPanel.querySelector('.comparison-details');

    if (main) {
      main.src = completedOverall;
      main.alt = 'Riley House after completion of the historic exterior restoration';
    }

    if (details) {
      details.style.gridTemplateColumns = '1fr';
      details.innerHTML = `<img src="${completedFront}" alt="Completed Riley House front elevation with the 1853 property sign">`;
    }
  }

  // The four photographs previously labeled as completed are repair-stage documentation.
  const repairLabels = new Map([
    ['received_1445447968962211.jpeg', ['Exposed repair condition', 'Concealed deterioration exposed during restoration.']],
    ['received_523194035098287.jpeg', ['Localized wood repair', 'Localized damaged wood and substrate stabilization during restoration.']],
    ['received_956557534681044.jpeg', ['Carpentry repair', 'Carpentry repair and substrate replacement during restoration.']],
    ['received_2296604793795983.jpeg', ['Repair-stage access', 'Temporary access and repair-stage documentation before finish completion.']]
  ]);

  document.querySelectorAll('.gallery-item').forEach((item) => {
    for (const [filename, values] of repairLabels) {
      if (!item.href.includes(filename)) continue;
      const [label, caption] = values;
      item.dataset.caption = caption;
      const tag = item.querySelector('.gallery-tag');
      const image = item.querySelector('img');
      if (tag) tag.textContent = label;
      if (image) image.alt = label;
      break;
    }
  });

  // Add the verified completed-result photographs to the project gallery.
  const gallery = document.querySelector('.project-gallery');
  if (gallery && !gallery.querySelector('[data-verified-after="true"]')) {
    const completedPhotos = [
      {
        src: completedOverall,
        label: 'Completed exterior',
        caption: 'Completed Riley House exterior following the historic restoration.'
      },
      {
        src: completedFront,
        label: 'Completed front elevation',
        caption: 'Completed Riley House front elevation with the 1853 property sign.'
      }
    ];

    completedPhotos.forEach((photo) => {
      const item = document.createElement('a');
      item.className = 'gallery-item';
      item.href = photo.src;
      item.dataset.caption = photo.caption;
      item.dataset.verifiedAfter = 'true';
      item.setAttribute('aria-label', `Open ${photo.label.toLowerCase()} photograph`);
      item.innerHTML = `<img loading="lazy" src="${photo.src}" alt="${photo.label}"><span class="gallery-tag">${photo.label}</span><span class="gallery-zoom" aria-hidden="true">＋</span>`;
      gallery.appendChild(item);
    });
  }

  const items = [...document.querySelectorAll('.gallery-item')];
  const lightbox = document.getElementById('projectLightbox');
  if (!items.length || !lightbox) return;

  const image = document.getElementById('lightboxImage');
  const caption = document.getElementById('lightboxCaption');
  const count = document.getElementById('lightboxCount');
  const closeButton = lightbox.querySelector('.lightbox-close');
  const prevButton = lightbox.querySelector('.lightbox-prev');
  const nextButton = lightbox.querySelector('.lightbox-next');
  let current = 0;
  let lastFocus = null;
  let touchStartX = 0;

  const show = (index) => {
    current = (index + items.length) % items.length;
    const item = items[current];
    const thumb = item.querySelector('img');
    image.src = item.href;
    image.alt = thumb.alt;
    caption.textContent = item.dataset.caption || thumb.alt;
    count.textContent = `${current + 1} of ${items.length}`;
  };

  const open = (index) => {
    lastFocus = document.activeElement;
    show(index);
    lightbox.hidden = false;
    document.body.classList.add('lightbox-open');
    closeButton.focus();
  };

  const close = () => {
    lightbox.hidden = true;
    document.body.classList.remove('lightbox-open');
    image.src = '';
    if (lastFocus) lastFocus.focus();
  };

  items.forEach((item, index) => item.addEventListener('click', (event) => {
    event.preventDefault();
    open(index);
  }));

  prevButton.addEventListener('click', () => show(current - 1));
  nextButton.addEventListener('click', () => show(current + 1));
  lightbox.querySelectorAll('[data-lightbox-close]').forEach((element) => element.addEventListener('click', close));

  document.addEventListener('keydown', (event) => {
    if (lightbox.hidden) return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });

  lightbox.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches[0].screenX;
  }, {passive:true});

  lightbox.addEventListener('touchend', (event) => {
    const distance = event.changedTouches[0].screenX - touchStartX;
    if (Math.abs(distance) < 45) return;
    show(distance > 0 ? current - 1 : current + 1);
  }, {passive:true});
})();
