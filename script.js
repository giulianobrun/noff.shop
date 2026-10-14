document.addEventListener('DOMContentLoaded', () => {
  const videoSlides = document.querySelectorAll('.video-slide');
  const menuToggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('menu');

  let audioActive = false; // Stato audio globale
  let currentVideo = null; // Video della slide attualmente a schermo

  /* ---------- Video: play/pausa in base alla slide visibile ---------- */
  const options = {
    root: null,
    rootMargin: '0px',
    threshold: 0.5
  };

  const callback = (entries) => {
    entries.forEach(entry => {
      const video = entry.target.querySelector('video');
      if (!video) return;

      if (entry.isIntersecting) {
        currentVideo = video;
        video.muted = !audioActive;
        const playing = video.play();
        if (playing) {
          // Se il browser blocca la riproduzione con audio, riparte muto
          playing.catch(() => {
            video.muted = true;
            video.play().catch(() => {});
          });
        }
      } else {
        video.pause();
        video.currentTime = 0;
        if (currentVideo === video) currentVideo = null;
      }
    });
  };

  const observer = new IntersectionObserver(callback, options);

  videoSlides.forEach(slide => {
    observer.observe(slide);
    const video = slide.querySelector('video');
    if (video) {
      video.preload = 'auto';
      video.muted = true; // TUTTI i video partono in mute
    }
  });

  /* ---------- Audio: tocco sul video per attivare/disattivare ---------- */
  document.body.addEventListener('click', (e) => {
    // Bottoni, link, menu e carosello prodotti non devono toccare l'audio
    if (e.target.closest('button, a, #menu, .info-carousel')) return;

    audioActive = !audioActive;
    if (currentVideo) currentVideo.muted = !audioActive;
  });

  /* ---------- Menu hamburger ---------- */
  const setMenu = (open) => {
    document.body.classList.toggle('menu-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
  };

  menuToggle.addEventListener('click', () => {
    setMenu(!document.body.classList.contains('menu-open'));
  });

  // Cliccando un link il menu si chiude
  menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => setMenu(false));
  });

  // Tasto Esc chiude il menu
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMenu(false);
  });

  /* ---------- Pre-loader ---------- */
  const preLoader = document.getElementById('pre-loader');
  const hideLoader = () => preLoader.classList.add('hidden');

  // Dopo il caricamento resta ancora 1,5 secondi, poi sfuma
  window.addEventListener('load', () => setTimeout(hideLoader, 1500));
  // Sicurezza: si chiude comunque dopo 8 secondi
  setTimeout(hideLoader, 8000);
});
