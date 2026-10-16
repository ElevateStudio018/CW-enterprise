// Gemensamt beteende för alla sidor: header, meny, scroll-avslöjanden, formulär och 3D-scener.
document.documentElement.classList.remove('no-js');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Header: solid efter scroll, göms vid nedåtscroll */
const header = document.querySelector('[data-header]');
let lastY = window.scrollY;
function onScroll() {
  const y = window.scrollY;
  if (!header) return;
  header.classList.toggle('is-solid', y > 24);
  const open = document.body.classList.contains('nav-open');
  header.classList.toggle('is-hidden', !open && y > 400 && y > lastY + 4);
  if (y < lastY - 4 || y < 400) header.classList.remove('is-hidden');
  lastY = y;
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* Mobilmeny */
const toggle = document.querySelector('[data-nav-toggle]');
const list = document.querySelector('[data-nav-list]');
if (toggle && list) {
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    list.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
    header.classList.toggle('nav-is-open', open);
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  window.matchMedia('(min-width: 981px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
}

/* Rubriker som glider upp rad för rad */
document.querySelectorAll('[data-split]').forEach((el) => {
  const lines = el.innerHTML.split(/<br\s*\/?>/i);
  el.innerHTML = lines.map((l) => `<span class="split-line"><span>${l.trim()}</span></span>`).join('');
  el.classList.add('reveal-lines');
});

/* Avslöjande vid scroll */
const revealTargets = document.querySelectorAll('.reveal, .reveal-lines');
if ('IntersectionObserver' in window && !reduceMotion) {
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  revealTargets.forEach((el) => io.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add('is-in'));
}

/* Kontaktformulär: ingen server — sammanställer ett e-postmeddelande i användarens e-postprogram */
const form = document.querySelector('[data-contact-form]');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const status = form.querySelector('[data-form-status]');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const areas = data.getAll('omrade').join(', ') || 'Ej angivet';
    const subject = `Förfrågan via webbplatsen – ${areas}`;
    const body = [
      `Namn: ${data.get('namn')}`,
      `Företag/organisation: ${data.get('foretag') || '–'}`,
      `E-post: ${data.get('epost')}`,
      `Telefon: ${data.get('telefon') || '–'}`,
      `Område: ${areas}`,
      `Önskad start: ${data.get('start') || '–'}`,
      '',
      String(data.get('meddelande') || ''),
    ].join('\n');
    window.location.href = `mailto:info@cwenterprise.se?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (status) status.textContent = 'Ert e-postprogram öppnas med meddelandet ifyllt. Skicka det därifrån, så återkommer vi.';
  });
}

/* 3D-scener laddas bara om sidan har någon och webbläsaren klarar WebGL */
const sceneEls = document.querySelectorAll('[data-scene]');
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}
if (sceneEls.length && hasWebGL()) {
  import('./scenes.js')
    .then(({ mount }) => sceneEls.forEach((el) => mount(el, { reduceMotion })))
    .catch((err) => console.warn('3D-scen kunde inte laddas', err));
}
