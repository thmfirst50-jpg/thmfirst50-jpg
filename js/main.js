/* ==================================================================
   MAIN APPLICATION JAVASCRIPT
   Features:
   - Text scramble animation on headings
   - Dynamic project filtering with live counters
   - Mobile navigation & scroll lock
   - 1-click clipboard copy with toast notifications
   - IntersectionObserver scroll reveal
   - Interactive contact messaging
================================================================== */

(function () {
  'use strict';

  var $ = function (selector, context) {
    return (context || document).querySelector(selector);
  };
  var $$ = function (selector, context) {
    return Array.prototype.slice.call((context || document).querySelectorAll(selector));
  };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------------
     0. Missing-Image Fallback
     Handles project images before local files are placed in assets/
  ---------------------------------------------------------------- */
  window.mediaFallback = function (img) {
    if (!img || img.getAttribute('data-placeholder') === 'true') return;
    img.onerror = null;
    img.setAttribute('data-placeholder', 'true');
    var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    var label = esc(img.getAttribute('data-label') || 'PREVIEW');
    var path  = esc(img.getAttribute('data-path') || '');
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340" viewBox="0 0 600 340">' +
        '<rect width="600" height="340" fill="#111111"/>' +
        '<rect x="12" y="12" width="576" height="316" fill="none" stroke="#FFFFFF" stroke-opacity=".2" stroke-width="1.5" stroke-dasharray="6 6"/>' +
        '<circle cx="300" cy="140" r="28" fill="#181818" stroke="#333" stroke-width="1.5"/>' +
        '<path d="M290 148 L296 138 L304 144 L310 134" stroke="#FFF" stroke-width="1.5" fill="none"/>' +
        '<circle cx="305" cy="132" r="2" fill="#FFF"/>' +
        '<text x="300" y="195" fill="#FFFFFF" text-anchor="middle" font-size="13" font-weight="700" letter-spacing="2" font-family="ui-monospace,Menlo,monospace">' + label + '</text>' +
        '<text x="300" y="218" fill="#777777" text-anchor="middle" font-size="11" font-family="ui-monospace,Menlo,monospace">' + path + '</text>' +
      '</svg>';
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  function sweepImages() {
    $$('img[data-label]').forEach(function (img) {
      if (img.getAttribute('data-placeholder') === 'true') return;
      if (img.complete && img.naturalWidth === 0) window.mediaFallback(img);
    });
  }
  sweepImages();
  window.addEventListener('load', sweepImages);

  /* ----------------------------------------------------------------
     1. Scroll Lock Utility
  ---------------------------------------------------------------- */
  var lockCount = 0;
  function lockScroll() {
    if (lockCount++ > 0) return;
    var sbw = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty('--sbw', (sbw > 0 ? sbw : 0) + 'px');
    document.documentElement.classList.add('locked');
  }

  function unlockScroll() {
    if (lockCount === 0) return;
    if (--lockCount > 0) return;
    document.documentElement.classList.remove('locked');
    document.documentElement.style.setProperty('--sbw', '0px');
  }

  /* ----------------------------------------------------------------
     2. Navigation & Mobile Drawer
  ---------------------------------------------------------------- */
  var nav = $('#nav');
  var navMenu = $('#navMenu');
  var navToggle = $('#navToggle');
  var menuOpen = false;

  function setMenu(open) {
    if (!navMenu || !navToggle || open === menuOpen) return;
    menuOpen = open;
    navMenu.setAttribute('data-open', open ? 'true' : 'false');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    if (open) lockScroll(); else unlockScroll();
  }

  if (navToggle) {
    navToggle.addEventListener('click', function () {
      setMenu(!menuOpen);
    });

    document.addEventListener('click', function (e) {
      if (menuOpen && !e.target.closest('#navMenu') && !e.target.closest('#navToggle')) {
        setMenu(false);
      }
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (window.innerWidth > 768 && menuOpen) setMenu(false);
      }, 100);
    });
  }

  if (nav) {
    var ticking = false;
    var onScroll = function () {
      nav.classList.toggle('scrolled', window.scrollY > 16);
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(onScroll);
      }
    }, { passive: true });
    onScroll();
  }

  /* ----------------------------------------------------------------
     3. Interactive Hero Name Shimmer & Glow
  ---------------------------------------------------------------- */
  var heroTitle = $('.hero__name');
  if (heroTitle && !reduceMotion) {
    heroTitle.addEventListener('mousemove', function (e) {
      var rect = heroTitle.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width) * 100;
      var y = ((e.clientY - rect.top) / rect.height) * 100;
      heroTitle.style.setProperty('--mouse-x', x + '%');
      heroTitle.style.setProperty('--mouse-y', y + '%');
    });
  }

  /* ----------------------------------------------------------------
     4. Project Filtering System
  ---------------------------------------------------------------- */
  var filters = $$('.filter');
  var projectCards = $$('#projectGrid .card');
  var countEl = $('#filterCount');

  if (filters.length && projectCards.length) {
    var applyFilter = function (key) {
      var count = 0;
      projectCards.forEach(function (card) {
        var categories = (card.getAttribute('data-category') || '').split(/\s+/);
        var match = (key === 'all') || categories.indexOf(key) !== -1;
        card.hidden = !match;
        if (match) count++;
      });

      filters.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-filter') === key ? 'true' : 'false');
      });

      if (countEl) {
        countEl.textContent = 'Showing ' + count + ' of ' + projectCards.length + ' projects';
      }
    };

    filters.forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyFilter(btn.getAttribute('data-filter'));
      });
    });

    applyFilter('all');
  }

  /* ----------------------------------------------------------------
     4.5 In-Card Image Carousels
  ---------------------------------------------------------------- */
  $$('[data-gallery]').forEach(function (g) {
    var imgs = $$('.gallery__img', g);
    if (!imgs.length) return;
    var prev = $('.gal-prev', g), next = $('.gal-next', g);
    var cap = $('.gallery__cap', g), count = $('.gallery__count', g), dots = $('.gallery__dots', g);
    var i = 0;

    function show(n) {
      i = (n % imgs.length + imgs.length) % imgs.length;
      imgs.forEach(function (im, k) {
        im.classList.toggle('is-active', k === i);
        im.setAttribute('tabindex', k === i ? '0' : '-1');
        im.setAttribute('role', 'button');
      });
      if (cap) cap.textContent = imgs[i].getAttribute('data-cap') || '';
      if (count) count.textContent = (i + 1) + ' / ' + imgs.length;
      if (dots) $$('.gal-dot', dots).forEach(function (d, k) {
        d.setAttribute('aria-selected', k === i ? 'true' : 'false');
      });
    }

    if (imgs.length < 2) {
      [prev, next, count, dots].forEach(function (el) { if (el) el.hidden = true; });
    } else if (dots) {
      dots.innerHTML = '';
      imgs.forEach(function (im, k) {
        var d = document.createElement('button');
        d.type = 'button';
        d.className = 'gal-dot';
        d.setAttribute('aria-label', 'Show slide ' + (k + 1) + ' of ' + imgs.length);
        d.addEventListener('click', function (e) {
          e.stopPropagation();
          show(k);
        });
        dots.appendChild(d);
      });
    }

    if (prev) prev.addEventListener('click', function (e) {
      e.stopPropagation();
      show(i - 1);
    });
    if (next) next.addEventListener('click', function (e) {
      e.stopPropagation();
      show(i + 1);
    });

    var x0 = null;
    g.addEventListener('touchstart', function (e) { x0 = e.changedTouches[0].clientX; }, { passive: true });
    g.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1));
    }, { passive: true });

    show(0);
  });

  /* ----------------------------------------------------------------
     4.6 Fullscreen Lightbox
  ---------------------------------------------------------------- */
  var lb = $('#lightbox');
  if (lb) {
    var lbImg = $('#lbImg'), lbCap = $('#lbCap');
    var lbClose = $('#lbClose'), lbPrev = $('#lbPrev'), lbNext = $('#lbNext');
    var group = [], index = 0, lastTrigger = null;

    var render = function () {
      var img = group[index];
      if (!img) return;
      lbImg.src = img.currentSrc || img.src;
      lbImg.alt = img.alt || '';
      lbCap.textContent = (img.getAttribute('data-cap') || '') +
        (group.length > 1 ? ' (' + (index + 1) + ' / ' + group.length + ')' : '');
    };
    var open = function (img) {
      var g = img.closest('[data-gallery]');
      group = g ? $$('.gallery__img', g) : [img];
      index = group.indexOf(img);
      if (index < 0) { group = [img]; index = 0; }
      lastTrigger = img;
      if (lbPrev && lbNext) lbPrev.hidden = lbNext.hidden = group.length < 2;
      render();
      lb.hidden = false;
      lockScroll();
      if (lbClose) lbClose.focus();
    };
    var close = function () {
      if (lb.hidden) return;
      lb.hidden = true;
      lbImg.removeAttribute('src');
      unlockScroll();
      if (lastTrigger) { lastTrigger.focus(); lastTrigger = null; }
    };
    var step = function (d) {
      if (group.length < 2) return;
      index = (index + d + group.length) % group.length;
      render();
    };
    var canOpen = function (img) {
      return img && img.classList.contains('is-active');
    };

    document.addEventListener('click', function (e) {
      var img = e.target.closest('.gallery__img');
      if (canOpen(img)) open(img);
      if (e.target.hasAttribute('data-close')) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !lb.hidden) { close(); return; }
      if (!lb.hidden) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      }
    });

    if (lbPrev) lbPrev.addEventListener('click', function () { step(-1); });
    if (lbNext) lbNext.addEventListener('click', function () { step(1); });
  }

  /* ----------------------------------------------------------------
     4.7 Video Facade Handler (YouTube embed on click)
  ---------------------------------------------------------------- */
  $$('[data-video]').forEach(function (box) {
    var play = $('.video__play', box);
    if (!play) return;
    play.addEventListener('click', function (e) {
      e.stopPropagation();
      var id = (box.getAttribute('data-video') || '').trim();
      if (!id) return;

      var f = document.createElement('iframe');
      f.src = 'https://www.youtube.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0&playsinline=1';
      f.title = 'OpenPark Demo Video';
      f.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      f.setAttribute('allowfullscreen', '');
      f.allowFullscreen = true;
      box.innerHTML = '';
      box.appendChild(f);
    });
  });

  /* ----------------------------------------------------------------
     5. Toast Notification System & Copy-to-Clipboard
  ---------------------------------------------------------------- */
  var toastTimer;
  function showToast(message) {
    var toast = $('#toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, 2800);
  }

  $$('[data-copy]').forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      var textToCopy = item.getAttribute('data-copy');
      if (!textToCopy) return;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(function () {
          showToast('Copied: ' + textToCopy);
        }).catch(function () {
          fallbackCopy(textToCopy);
        });
      } else {
        fallbackCopy(textToCopy);
      }
    });
  });

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast('Copied: ' + text);
    } catch (err) {
      showToast('Failed to copy');
    }
    document.body.removeChild(ta);
  }

  /* ----------------------------------------------------------------
     6. Scroll Reveal Observer
  ---------------------------------------------------------------- */
  var revealables = $$('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('is-visible');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------------
     7. Contact Form Simulation (Retired - direct email channels active)
  ---------------------------------------------------------------- */

  /* ----------------------------------------------------------------
     8. Footer Dynamic Year
  ---------------------------------------------------------------- */
  var yearEl = $('#year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

})();
