// Meny, kontaktformulär och 3D-modeller.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const toggle = document.querySelector('[data-nav-toggle]');
const list = document.querySelector('[data-nav-list]');
if (toggle && list) {
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Stäng' : 'Meny';
    list.classList.toggle('is-open', open);
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  window.matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
}

// Kontaktformuläret har ingen server. Det öppnar besökarens e-postprogram med meddelandet ifyllt.
const form = document.querySelector('[data-contact-form]');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = new FormData(form);
    const areas = data.getAll('omrade').join(', ') || 'Ej angivet';
    const body = [
      `Namn: ${data.get('namn')}`,
      `Företag: ${data.get('foretag') || '–'}`,
      `E-post: ${data.get('epost')}`,
      `Telefon: ${data.get('telefon') || '–'}`,
      `Gäller: ${areas}`,
      '',
      String(data.get('meddelande') || ''),
    ].join('\n');
    window.location.href = `mailto:info@cwenterprise.se?subject=${encodeURIComponent(`Förfrågan: ${areas}`)}&body=${encodeURIComponent(body)}`;
    form.querySelector('[data-form-status]').textContent = 'Ert e-postprogram bör nu öppnas med meddelandet ifyllt. Om inget händer, skriv till info@cwenterprise.se.';
  });
}

const models = document.querySelectorAll('[data-model]');
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}
if (models.length && hasWebGL()) {
  import('./scenes.js')
    .then(({ mount }) => models.forEach((el) => mount(el, { reduceMotion })))
    .catch((err) => console.warn('3D-modellen kunde inte laddas', err));
}
