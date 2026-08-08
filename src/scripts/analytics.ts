/**
 * AnalyticsToggle — Privacy-first opt-in toggle for the landing-page footer.
 *
 * Storage key: `querydrop:analytics:opt-in` → "1" (opt-in) or "0" (opt-out).
 * Default state: opt-OUT. The user must explicitly click the toggle to
 * enable any analytics. When opted in, a Plausible script tag is injected
 * dynamically (data-domain attribute kept blank for self-hosters; replace
 * with your Plausible domain before flipping the toggle in production).
 *
 * No cookies. No PII. No cross-site tracking. The toggle is a pure DOM
 * read/write — no React state, no re-render — to keep the landing page
 * free of unnecessary JS.
 */
export function AnalyticsToggle() {
  if (typeof document === 'undefined') return;

  const KEY = 'querydrop:analytics:opt-in';
  const isOptedIn = localStorage.getItem(KEY) === '1';

  const label = document.createElement('label');
  label.className =
    'flex items-center gap-2 text-[11px] text-text-tertiary hover:text-text-secondary cursor-pointer select-none';
  label.innerHTML = `
    <span>Help improve QueryDrop</span>
    <span class="relative inline-block w-8 h-4 transition-colors ${isOptedIn ? 'bg-accent-brand' : 'bg-bg-1 border border-border-subtle'}" data-track>
      <span class="absolute top-0.5 ${isOptedIn ? 'left-4' : 'left-0.5'} w-3 h-3 transition-all ${isOptedIn ? 'bg-text-primary' : 'bg-text-tertiary'}" data-knob></span>
    </span>
  `;
  label.setAttribute('role', 'switch');
  label.setAttribute('aria-checked', isOptedIn ? 'true' : 'false');
  label.setAttribute('tabindex', '0');

  const track = label.querySelector<HTMLElement>('[data-track]')!;
  const knob = label.querySelector<HTMLElement>('[data-knob]')!;
  
  const toggle = (e: Event) => {
    e.preventDefault();
    const next = localStorage.getItem(KEY) !== '1';
    localStorage.setItem(KEY, next ? '1' : '0');
    track.className = `relative inline-block w-8 h-4 transition-colors ${next ? 'bg-accent-brand' : 'bg-bg-1 border border-border-subtle'}`;
    knob.className = `absolute top-0.5 ${next ? 'left-4' : 'left-0.5'} w-3 h-3 transition-all ${next ? 'bg-text-primary' : 'bg-text-tertiary'}`;
    label.setAttribute('aria-checked', next ? 'true' : 'false');
    if (next) injectPlausible();
    else stripPlausible();
  };

  label.addEventListener('click', toggle);
  label.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      toggle(e);
    }
  });

  const mount = document.getElementById('analytics-toggle-mount');
  if (mount) mount.appendChild(label);

  if (isOptedIn) injectPlausible();
}

function injectPlausible() {
  if (document.getElementById('plausible-script')) return;
  const s = document.createElement('script');
  s.id = 'plausible-script';
  s.defer = true;
  s.src = 'https://plausible.io/js/script.tagged-events.js';
  // Replace `data-domain` with your Plausible domain before going live.
  s.setAttribute('data-domain', 'querydrop.com');
  document.head.appendChild(s);
}

function stripPlausible() {
  document.getElementById('plausible-script')?.remove();
}
