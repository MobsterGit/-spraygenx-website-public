(() => {
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
