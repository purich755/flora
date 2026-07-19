/* ============================================================
   ФЛОРА — анимационная логика
   GSAP + ScrollTrigger + ScrollSmoother + SplitText
   Ядро: канвас-скраббинг видео (кадр = позиция скролла)
   ============================================================ */

document.documentElement.classList.add('js');

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText);

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = window.matchMedia('(hover: none)').matches;

/* ---------- Данные меню ---------- */
const MENU = [
  {
    id: 'cacao',
    name: 'Сосново-миндальный какао',
    desc: 'Горький шоколад, миндальное молоко, сливки, карамель и молодые сосновые шишки.',
    price: '350 ₽', vol: '250 мл',
    cat: 'drinks', catLabel: 'Напитки',
    img: 'assets/img/menu-cacao.webp'
  },
  {
    id: 'mandarin',
    name: 'Мандариновый десерт',
    desc: 'Нежный кокосовый крем и стабилизированный мандариновый сок.',
    price: '390 ₽', vol: '',
    cat: 'desserts', catLabel: 'Десерты',
    img: 'assets/img/menu-mandarin.webp'
  },
  {
    id: 'canele',
    name: 'Канеле',
    desc: 'Французская булочка: хрустящая карамельная корочка снаружи, влажная сердцевина внутри.',
    price: '110 ₽', vol: '',
    cat: 'bakery', catLabel: 'Выпечка',
    img: 'assets/img/menu-canele.webp'
  },
  {
    id: 'tartlet',
    name: 'Клубничная тарталетка',
    desc: 'Песочная тарталетка, сливочный крем с арахисовой пастой, мёдом и морской солью, свежая клубника.',
    price: '410 ₽', vol: '',
    cat: 'desserts', catLabel: 'Десерты',
    img: 'assets/img/menu-tartlet.webp'
  }
];

/* ---------- Кадры видео ---------- */
const FRAME_COUNT = 121;
const framePath = i => `assets/frames/frame_${String(i + 1).padStart(3, '0')}.webp`;
const frames = new Array(FRAME_COUNT).fill(null);
let framesLoaded = 0;

const canvas = document.getElementById('expCanvas');
const ctx = canvas.getContext('2d');
const expState = { frame: 0 };

function sizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { clientWidth: w, clientHeight: h } = canvas;
  if (!w || !h) return;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  drawFrame(expState.frame);
}

/* Рисуем ближайший загруженный кадр (cover) */
function drawFrame(index) {
  let i = Math.round(index);
  if (!frames[i]) {
    let found = -1;
    for (let d = 1; d < FRAME_COUNT; d++) {
      if (frames[i - d]) { found = i - d; break; }
      if (frames[i + d]) { found = i + d; break; }
    }
    if (found === -1) return;
    i = found;
  }
  const img = frames[i];
  const cw = canvas.width, ch = canvas.height;
  const scale = Math.max(cw / img.width, ch / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
}

/* ---------- Прелоадер: грузим кадры, шрифты и hero ---------- */
const CRITICAL_FRAMES = 90; // достаточно для старта, остальное дольёт фон
const counterEl = document.getElementById('preloaderCount');
const preloaderEl = document.getElementById('preloader');
let started = false;

function loadFrames() {
  return new Promise(resolve => {
    let inFlight = 0, next = 0;
    const pump = () => {
      while (inFlight < 10 && next < FRAME_COUNT) {
        const i = next++;
        inFlight++;
        const img = new Image();
        img.decoding = 'async';
        img.onload = img.onerror = () => {
          frames[i] = img.complete && img.naturalWidth ? img : frames[i];
          framesLoaded++;
          inFlight--;
          onProgress();
          if (framesLoaded >= CRITICAL_FRAMES) resolve();
          if (framesLoaded === FRAME_COUNT) drawFrame(expState.frame);
          pump();
        };
        img.src = framePath(i);
      }
    };
    pump();
  });
}

function onProgress() {
  const pct = Math.min(100, Math.round((framesLoaded / CRITICAL_FRAMES) * 100));
  if (counterEl) counterEl.textContent = pct;
}

const heroImg = document.querySelector('.hero__img');
const heroReady = heroImg && heroImg.decode ? heroImg.decode().catch(() => {}) : Promise.resolve();

Promise.all([loadFrames(), heroReady, document.fonts.ready]).then(() => {
  if (started) return;
  started = true;
  init();
});

/* Страховка: если что-то зависло, стартуем через 9 секунд */
setTimeout(() => { if (!started) { started = true; init(); } }, 9000);

/* ============================================================
   Инициализация сайта
   ============================================================ */
let smoother = null;

function init() {
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);

  buildMenu();
  initModals();
  initBurger();

  if (REDUCED) {
    preloaderEl.style.display = 'none';
    document.querySelectorAll('.split-lines').forEach(el => el.classList.add('is-split'));
    drawFrame(60);
    initAnchors();
    return;
  }

  smoother = ScrollSmoother.create({
    smooth: 1.2,
    effects: true,
    smoothTouch: false,
    normalizeScroll: false
  });

  initAnchors();
  initNavState();
  initExperience();
  initSplitReveals();
  initParallaxTouches();
  exitPreloader();
}

/* ---------- Выход из прелоадера + интро hero ---------- */
function exitPreloader() {
  const tl = gsap.timeline();
  tl.to('.preloader__count, .preloader__hint', { opacity: 0, y: -20, duration: 0.5, ease: 'power2.in' })
    .to('.preloader__mark', { scale: 1.6, opacity: 0, duration: 0.55, ease: 'power2.in' }, '<0.05')
    .to(preloaderEl, {
      clipPath: 'inset(0% 0% 100% 0%)',
      duration: 1.05,
      ease: 'power4.inOut',
      onComplete: () => { preloaderEl.style.display = 'none'; }
    }, '-=0.15');

  /* Интро hero: изображение «прибывает», строки поднимаются */
  const title = new SplitText('.hero__title', { type: 'lines', mask: 'lines' });
  tl.from('.hero__img', { scale: 1.18, duration: 2.2, ease: 'power3.out' }, '-=0.75')
    .from(title.lines, { yPercent: 115, duration: 1.15, stagger: 0.12, ease: 'power4.out' }, '<0.15')
    .from('.hero__eyebrow', { opacity: 0, y: 18, duration: 0.7, ease: 'power2.out' }, '<0.35')
    .from('.hero__sub', { opacity: 0, y: 24, duration: 0.8, ease: 'power2.out' }, '<0.1')
    .from('.hero__cta .btn', { opacity: 0, y: 24, duration: 0.7, stagger: 0.1, ease: 'power2.out' }, '<0.15')
    .from('.nav', { opacity: 0, y: -16, duration: 0.8, ease: 'power2.out' }, '<');
}

/* ---------- Плавные якоря ---------- */
function initAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      closeMobnav();
      if (smoother) smoother.scrollTo(target, true, 'top 70px');
      else target.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

/* ---------- Стеклянная шапка после старта скролла ---------- */
function initNavState() {
  ScrollTrigger.create({
    start: 50,
    onEnter: () => document.getElementById('nav').classList.add('nav--scrolled'),
    onLeaveBack: () => document.getElementById('nav').classList.remove('nav--scrolled')
  });
}

/* ---------- Ядро: scroll experience ---------- */
function initExperience() {
  const msgs = gsap.utils.toArray('.exp__msg');

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '.exp',
      start: 'top top',
      end: '+=420%',
      pin: true,
      scrub: 0.6,
      anticipatePin: 1
    }
  });

  /* Кадры: позиция скролла напрямую управляет видео */
  tl.to(expState, {
    frame: FRAME_COUNT - 1,
    ease: 'none',
    duration: 10,
    onUpdate: () => drawFrame(expState.frame)
  }, 0);

  /* Лёгкое «дыхание» сцены */
  tl.fromTo('.exp__canvas', { scale: 1.06 }, { scale: 1, ease: 'none', duration: 10 }, 0);

  /* Сообщения: появление и уход с blur-reveal */
  const beats = [
    { el: msgs[0], in: 0.4, out: 2.0 },
    { el: msgs[1], in: 2.4, out: 4.0 },
    { el: msgs[2], in: 4.4, out: 6.0 },
    { el: msgs[3], in: 6.4, out: 7.9 },
    { el: msgs[4], in: 8.4, out: null }
  ];
  beats.forEach(({ el, in: tIn, out }) => {
    tl.fromTo(el,
      { opacity: 0, y: 46, filter: 'blur(14px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.65, ease: 'power2.out' }, tIn);
    if (out !== null) {
      tl.to(el, { opacity: 0, y: -40, filter: 'blur(12px)', duration: 0.55, ease: 'power2.in' }, out);
    }
  });
}

/* ---------- Реveal-анимации по секциям ---------- */
function initSplitReveals() {
  document.querySelectorAll('.split-lines').forEach(el => {
    const split = new SplitText(el, { type: 'lines', mask: 'lines' });
    el.classList.add('is-split');
    gsap.from(split.lines, {
      yPercent: 118,
      duration: 1.1,
      stagger: 0.09,
      ease: 'power4.out',
      scrollTrigger: { trigger: el, start: 'top 84%', once: true }
    });
  });

  /* Карточки и текст: мягкий подъём партиями */
  const rise = (targets, trigger, extra = {}) => {
    gsap.from(targets, {
      opacity: 0,
      y: 46,
      duration: 1,
      stagger: 0.08,
      ease: 'power3.out',
      scrollTrigger: { trigger, start: 'top 80%', once: true },
      ...extra
    });
  };

  rise('.about__text, .about__facts', '.about__grid');
  rise('.gcard', '.gallery__grid', { stagger: 0.06 });
  rise('.wcard', '.why__grid', { stagger: 0.07 });
  rise('.mcard', '.menu__grid', { stagger: 0.08 });
  rise('.menu__filters .chip', '.menu__filters', { y: 20, stagger: 0.05 });
  rise('.rcard', '.reviews__grid');
  rise('.visit__row, .visit__info .btn', '.visit__grid', { y: 30 });
  rise('.visit__map', '.visit__grid', { y: 60 });

  gsap.from('.final__mark', {
    scale: 0, rotate: -120, duration: 0.9, ease: 'back.out(1.7)',
    scrollTrigger: { trigger: '.final', start: 'top 60%', once: true }
  });
}

/* ---------- Параллакс-акценты ---------- */
function initParallaxTouches() {
  /* Галерея: соседние карточки плывут с разной скоростью */
  ['.gcard:nth-child(2)', '.gcard:nth-child(5)', '.gcard:nth-child(7)'].forEach(sel => {
    gsap.fromTo(sel, { yPercent: 5 }, {
      yPercent: -5, ease: 'none',
      scrollTrigger: { trigger: '.gallery__grid', start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });

  /* Зелёная пауза: масштаб фотографии тает при прокрутке */
  gsap.fromTo('.plants__img', { scale: 1.28 }, {
    scale: 1, ease: 'none',
    scrollTrigger: { trigger: '.plants', start: 'top bottom', end: 'bottom top', scrub: true }
  });

  /* Мышиный параллакс размытых пятен в hero */
  if (!TOUCH) {
    const xa = gsap.quickTo('.hero__blob--a', 'x', { duration: 1.4, ease: 'power3' });
    const ya = gsap.quickTo('.hero__blob--a', 'y', { duration: 1.4, ease: 'power3' });
    const xb = gsap.quickTo('.hero__blob--b', 'x', { duration: 1.8, ease: 'power3' });
    const yb = gsap.quickTo('.hero__blob--b', 'y', { duration: 1.8, ease: 'power3' });
    window.addEventListener('pointermove', e => {
      const nx = (e.clientX / window.innerWidth - 0.5);
      const ny = (e.clientY / window.innerHeight - 0.5);
      xa(nx * -40); ya(ny * -30);
      xb(nx * 28); yb(ny * 22);
    });
  }
}

/* ---------- Меню: рендер и фильтры ---------- */
function buildMenu() {
  const grid = document.getElementById('menuGrid');
  grid.innerHTML = MENU.map(item => `
    <button class="mcard" data-cat="${item.cat}" data-id="${item.id}" aria-haspopup="dialog">
      <span class="mcard__photo"><img src="${item.img}" alt="${item.name}" loading="lazy"></span>
      <span class="mcard__body">
        <h3>${item.name}</h3>
        <p>${item.desc}</p>
        <span class="mcard__price">${item.price}${item.vol ? ` <em>${item.vol}</em>` : ''}</span>
      </span>
    </button>
  `).join('');

  const chips = document.querySelectorAll('.chip');
  chips.forEach(chip => chip.addEventListener('click', () => {
    if (chip.classList.contains('is-active')) return;
    chips.forEach(c => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    const f = chip.dataset.filter;
    const cards = gsap.utils.toArray('.mcard');

    gsap.to(cards, {
      opacity: 0, y: 18, scale: 0.97, duration: 0.28, ease: 'power2.in', stagger: 0.03,
      onComplete: () => {
        cards.forEach(card => {
          card.style.display = (f === 'all' || card.dataset.cat === f) ? '' : 'none';
        });
        const visible = cards.filter(c => c.style.display !== 'none');
        gsap.fromTo(visible,
          { opacity: 0, y: 24, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out', stagger: 0.06 });
        ScrollTrigger.refresh();
      }
    });
  }));

  grid.addEventListener('click', e => {
    const card = e.target.closest('.mcard');
    if (card) openDish(card.dataset.id);
  });
}

/* ---------- Модалки: блюдо и лайтбокс ---------- */
let lastFocus = null;

function lockScroll(lock) {
  if (smoother) smoother.paused(lock);
  document.body.style.overflow = lock ? 'hidden' : '';
}

function openDish(id) {
  const item = MENU.find(m => m.id === id);
  if (!item) return;
  lastFocus = document.activeElement;
  document.getElementById('dishImg').src = item.img;
  document.getElementById('dishImg').alt = item.name;
  document.getElementById('dishCat').textContent = item.catLabel;
  document.getElementById('dishName').textContent = item.name;
  document.getElementById('dishDesc').textContent = item.desc;
  document.getElementById('dishPrice').textContent = item.price;
  document.getElementById('dishVol').textContent = item.vol;

  const dish = document.getElementById('dish');
  dish.classList.add('is-open');
  dish.setAttribute('aria-hidden', 'false');
  lockScroll(true);

  gsap.timeline()
    .fromTo('#dishBackdrop', { opacity: 0 }, { opacity: 1, duration: 0.4 })
    .fromTo('.dish__card',
      { opacity: 0, y: 56, scale: 0.94 },
      { opacity: 1, y: 0, scale: 1, duration: 0.65, ease: 'power4.out' }, '<0.05')
    .fromTo('.dish__info > *',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power2.out' }, '<0.2');

  document.getElementById('dishClose').focus();
}

function closeDish() {
  const dish = document.getElementById('dish');
  gsap.timeline({
    onComplete: () => {
      dish.classList.remove('is-open');
      dish.setAttribute('aria-hidden', 'true');
      lockScroll(false);
      if (lastFocus) lastFocus.focus();
    }
  })
    .to('.dish__card', { opacity: 0, y: 40, scale: 0.96, duration: 0.35, ease: 'power2.in' })
    .to('#dishBackdrop', { opacity: 0, duration: 0.3 }, '<0.1');
}

function openLightbox(src, cap, alt) {
  lastFocus = document.activeElement;
  const lb = document.getElementById('lightbox');
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightboxImg').alt = alt || '';
  document.getElementById('lightboxCap').textContent = cap || '';
  lb.classList.add('is-open');
  lb.setAttribute('aria-hidden', 'false');
  lockScroll(true);
  gsap.fromTo('.lightbox__body', { opacity: 0, scale: 0.94, y: 24 },
    { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: 'power4.out' });
  document.getElementById('lightboxClose').focus();
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  gsap.to('.lightbox__body', {
    opacity: 0, scale: 0.96, duration: 0.3, ease: 'power2.in',
    onComplete: () => {
      lb.classList.remove('is-open');
      lb.setAttribute('aria-hidden', 'true');
      lockScroll(false);
      if (lastFocus) lastFocus.focus();
    }
  });
}

function initModals() {
  document.querySelectorAll('.gcard').forEach(fig => {
    fig.addEventListener('click', () => {
      const img = fig.querySelector('img');
      openLightbox(img.currentSrc || img.src, fig.dataset.cap, img.alt);
    });
  });
  document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
  document.getElementById('lightbox').addEventListener('click', e => {
    if (e.target.id === 'lightbox') closeLightbox();
  });
  document.getElementById('dishClose').addEventListener('click', closeDish);
  document.getElementById('dishBackdrop').addEventListener('click', closeDish);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('lightbox').classList.contains('is-open')) closeLightbox();
    if (document.getElementById('dish').classList.contains('is-open')) closeDish();
  });
}

/* ---------- Мобильное меню ---------- */
function initBurger() {
  const burger = document.getElementById('burger');
  const mobnav = document.getElementById('mobnav');
  burger.addEventListener('click', () => {
    const open = !mobnav.classList.contains('is-open');
    mobnav.classList.toggle('is-open', open);
    burger.classList.toggle('is-open', open);
    document.getElementById('nav').classList.toggle('nav--menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    mobnav.setAttribute('aria-hidden', String(!open));
    lockScroll(open);
    if (open) {
      gsap.fromTo('.mobnav__links a, .mobnav__phone',
        { opacity: 0, y: 34 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.07, ease: 'power3.out', delay: 0.15 });
    }
  });
}

function closeMobnav() {
  const mobnav = document.getElementById('mobnav');
  if (!mobnav.classList.contains('is-open')) return;
  mobnav.classList.remove('is-open');
  document.getElementById('burger').classList.remove('is-open');
  document.getElementById('nav').classList.remove('nav--menu-open');
  document.getElementById('burger').setAttribute('aria-expanded', 'false');
  mobnav.setAttribute('aria-hidden', 'true');
  lockScroll(false);
}
