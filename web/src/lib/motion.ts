export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isMobile = () =>
  typeof window !== 'undefined' && (window.innerWidth < 768 || (navigator as any).deviceMemory < 4 || navigator.hardwareConcurrency <= 4);

/** Run after first paint, when the main thread is idle (falls back to a timeout). */
export function whenIdle(fn: () => void, timeout = 1500) {
  const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: { timeout: number }) => number);
  const go = () => (ric ? ric(fn, { timeout }) : setTimeout(fn, 200));
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}

/* ---------------- reveals ----------------
 * `.reveal` elements fade/slide in once when they enter the viewport.
 * Pure CSS transitions on opacity/transform (compositor-only) driven by one
 * IntersectionObserver. New elements are picked up by a MutationObserver that
 * only looks at added nodes (no page-wide rescans).
 */
let io: IntersectionObserver | null = null;

function observe(el: Element) {
  const h = el as HTMLElement;
  if (h.dataset.rv) return;
  h.dataset.rv = '1';
  const d = Number(h.dataset.delay || 0);
  if (d) h.style.transitionDelay = `${d}s`;
  io!.observe(h);
}

function scan(root: ParentNode) {
  if (root instanceof Element && root.classList.contains('reveal')) observe(root);
  root.querySelectorAll?.('.reveal:not([data-rv])').forEach(observe);
}

export function initReveals() {
  if (reducedMotion() || !('IntersectionObserver' in window)) {
    document.documentElement.classList.add('no-reveal');
    return;
  }
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io!.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
  );
  scan(document);
  new MutationObserver((muts) => {
    for (const m of muts) m.addedNodes.forEach((n) => n.nodeType === 1 && scan(n as Element));
  }).observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true });
}

/* ---------------- smooth scroll + scroll-linked motion ---------------- */
export async function initSmoothScroll() {
  if (reducedMotion()) return;
  const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([
    import('lenis'),
    import('gsap'),
    import('gsap/ScrollTrigger'),
  ]);
  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  (window as any).__lenis = lenis;

  // Hero copy drifts up and fades as you scroll into the cloud (scrubbed, GPU-only).
  const hero = document.querySelector('[data-hero-copy]');
  if (hero) {
    gsap.to(hero, {
      yPercent: -12, opacity: 0.15, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 },
    });
  }
}

export function initMotion() {
  initReveals();
  whenIdle(() => { initSmoothScroll(); }, 2500);
}

export function scrollToId(id: string, tries = 30) {
  const el = document.getElementById(id);
  // the target may live in the lazily loaded part of the page — wait briefly for it
  if (!el) { if (tries > 0) setTimeout(() => scrollToId(id, tries - 1), 100); return; }
  const lenis = (window as any).__lenis;
  if (lenis) lenis.scrollTo(el, { offset: -64 });
  else el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
}
