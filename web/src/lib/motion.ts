export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isMobile = () =>
  typeof window !== 'undefined' && (window.innerWidth < 768 || (navigator as any).deviceMemory < 4 || navigator.hardwareConcurrency <= 4);

/** Lenis smooth scroll + GSAP ScrollTrigger reveals (lazy loaded, skipped for reduced motion). */
export async function initMotion() {
  if (reducedMotion()) {
    document.querySelectorAll<HTMLElement>('.reveal').forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none'; });
    return;
  }
  const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([
    import('lenis'),
    import('gsap'),
    import('gsap/ScrollTrigger'),
  ]);
  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  (window as any).__lenis = lenis;

  const bind = () => {
    document.querySelectorAll<HTMLElement>('.reveal:not([data-rv])').forEach((el) => {
      el.dataset.rv = '1';
      const delay = Number(el.dataset.delay || 0);
      gsap.to(el, {
        opacity: 1, y: 0, duration: 0.9, delay, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });
  };
  bind();
  // new content (data arriving) gets bound too
  new MutationObserver(() => bind()).observe(document.body, { childList: true, subtree: true });
}

export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const lenis = (window as any).__lenis;
  if (lenis) lenis.scrollTo(el, { offset: -64 });
  else el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
}
