/**
 * analytics-tracking.js
 * Tracking comportamento utente + CTR per bottone + funnel di conversione
 * per pagina, per Umami Analytics.
 * Richiede che lo script Umami sia già caricato nel <head> (window.umami disponibile).
 * Ogni evento include "page" = window.location.pathname per confrontare pagine diverse.
 */
(function () {
  if (typeof window.umami === 'undefined') {
    console.warn('[analytics-tracking] Umami non trovato: nessun evento verrà inviato.');
    return;
  }

  var page = window.location.pathname;

  function track(name, data) {
    umami.track(name, Object.assign({ page: page }, data || {}));
  }

  // ---------------------------------------------------------------------
  // A) TEMPO SPESO SULLA PAGINA
  // ---------------------------------------------------------------------
  var activeSeconds = 0;
  var isVisible = document.visibilityState === 'visible';
  var lastTick = Date.now();
  var SEND_INTERVAL_MS = 20000;

  function tick() {
    if (isVisible) {
      var now = Date.now();
      activeSeconds += (now - lastTick) / 1000;
      lastTick = now;
    }
  }
  var tickInterval = setInterval(tick, 1000);

  var lastSentSeconds = 0;
  var sendInterval = setInterval(function () {
    var delta = Math.round(activeSeconds - lastSentSeconds);
    if (delta > 0) {
      track('time_on_page', { seconds: Math.round(activeSeconds) });
      lastSentSeconds = activeSeconds;
    }
  }, SEND_INTERVAL_MS);

  function flushTimeOnPage() {
    tick();
    var delta = Math.round(activeSeconds - lastSentSeconds);
    if (delta > 0) {
      track('time_on_page', { seconds: Math.round(activeSeconds) });
      lastSentSeconds = activeSeconds;
    }
  }

  document.addEventListener('visibilitychange', function () {
    tick();
    isVisible = document.visibilityState === 'visible';
    lastTick = Date.now();
    if (document.visibilityState === 'hidden') {
      flushTimeOnPage();
    }
  });

  // ---------------------------------------------------------------------
  // B) NUMERO DI SCROLL
  // ---------------------------------------------------------------------
  var scrollCount = 0;
  var scrollDebounceTimer = null;
  var SCROLL_DEBOUNCE_MS = 150;

  window.addEventListener('scroll', function () {
    if (scrollDebounceTimer) return;
    scrollDebounceTimer = setTimeout(function () {
      scrollDebounceTimer = null;
    }, SCROLL_DEBOUNCE_MS);
    scrollCount++;
    checkScrollDepth();
  }, { passive: true });

  // ---------------------------------------------------------------------
  // C) PERCENTUALE DI COMPLETAMENTO PAGINA
  // ---------------------------------------------------------------------
  var depthThresholds = [25, 50, 75, 100];
  var depthReached = {};

  function checkScrollDepth() {
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return;
    var percent = Math.min(100, Math.round((scrollTop / docHeight) * 100));

    depthThresholds.forEach(function (threshold) {
      if (percent >= threshold && !depthReached[threshold]) {
        depthReached[threshold] = true;
        track('scroll_depth', { depth: threshold });
      }
    });
  }

  // ---------------------------------------------------------------------
  // D) IMPRESSION PER SINGOLO PRODOTTO (base per il CTR per prodotto)
  // ---------------------------------------------------------------------
  var viewedSlides = new Set();

  function initImpressionTracking() {
    var slides = document.querySelectorAll('.video-slide');
    if (!slides.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var slide = entry.target;
        var btn = slide.querySelector('.amazon-btn');
        var buttonId = btn ? btn.getAttribute('data-bottone') : slide.getAttribute('data-link');
        if (!buttonId || viewedSlides.has(buttonId)) return;
        viewedSlides.add(buttonId);
        track('product_view', { button_id: buttonId });
      });
    }, { root: null, threshold: 0.5 });

    slides.forEach(function (slide) {
      observer.observe(slide);
    });
  }

  // ---------------------------------------------------------------------
  // E) CLICK SUL SINGOLO BOTTONE (CTR per prodotto = click / product_view)
  //    + F) FUNNEL DI CONVERSIONE PER PAGINA (una volta per visita/pagina)
  //
  //    Il bottone "Download App" viene trattato come categoria separata dai
  //    bottoni prodotto Amazon, così puoi leggere nel report Events:
  //      - funnel_product_click  -> % visitatori che hanno cliccato almeno
  //                                  un prodotto (dividi per i "Visitors"
  //                                  della pagina nel report Pages)
  //      - funnel_download_app_click -> % visitatori che hanno cliccato
  //                                  "Scarica l'app"
  //
  //    Sostituisce l'handler inline gtag/umami che avevi in index.html:
  //    rimuovi da index.html il vecchio <script> con
  //    document.querySelectorAll('.amazon-btn').forEach(...) per evitare
  //    doppio conteggio dei click.
  // ---------------------------------------------------------------------
  var DOWNLOAD_APP_ID = 'Download App';

  function funnelKey(name) {
    return 'analytics_' + name + '_' + page;
  }

  function trackFunnelOnce(name) {
    var key = funnelKey(name);
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    track(name, {});
  }

  function initButtonTracking() {
    document.querySelectorAll('.amazon-btn').forEach(function (button) {
      button.addEventListener('click', function (e) {
        e.preventDefault();
        var numBtn = button.getAttribute('data-bottone');
        var linkAmazon = button.getAttribute('data-link');

        // Evento per CTR dettagliato per singolo prodotto
        track('button_click', { button_id: numBtn, button_link: linkAmazon });

        // Evento per funnel di pagina, una sola volta per visita
        if (numBtn === DOWNLOAD_APP_ID) {
          trackFunnelOnce('funnel_download_app_click');
        } else {
          trackFunnelOnce('funnel_product_click');
        }

        setTimeout(function () {
          window.location.href = linkAmazon;
        }, 150);
      });
    });
  }

  function initOnReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  initOnReady(initImpressionTracking);
  initOnReady(initButtonTracking);

  // ---------------------------------------------------------------------
  // Invio finale al termine della sessione sulla pagina
  // ---------------------------------------------------------------------
  var alreadyFlushed = false;
  function flushOnExit() {
    if (alreadyFlushed) return;
    alreadyFlushed = true;
    flushTimeOnPage();
    if (scrollCount > 0) {
      track('scroll_count', { count: scrollCount });
    }
    clearInterval(tickInterval);
    clearInterval(sendInterval);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushOnExit();
  });
  window.addEventListener('pagehide', flushOnExit);
  window.addEventListener('beforeunload', flushOnExit);
})();
