import * as THREE from 'three';

export interface CloudPaths { id: string; paths: number[][] }

const MODEL_HEX: Record<string, number> = {
  gbm: 0x7ccbff, jump: 0xb8e6ff, bootstrap: 0x4fa3d9, garch: 0x9ad8ff, meanrev: 0x2b7fb8,
};
const RED = new THREE.Color(0xff4d5e);
const W = 8; // world width of the 21-day axis

/**
 * Three.js scenario cloud: paths of the latest run as glowing lines fanning out
 * from today's price; particles travel along them. Tail paths (ending >15% below
 * spot) are risk red. Rendering pauses whenever the canvas is off screen or the
 * tab is hidden.
 */
export class ScenarioCloud {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private root = new THREE.Group();
  private layer: THREE.Group | null = null;
  private lineMat: THREE.LineBasicMaterial | null = null;
  private particles: THREE.Points | null = null;
  private pathPts: Float32Array[] = [];
  private phases = new Float32Array(0);
  private raf = 0;
  private running = false;
  private onScreen = true;
  private scroll = 0;
  private fade = 1;
  private t0 = performance.now();
  private io: IntersectionObserver;
  private spot: number;
  private range: { lo: number; hi: number } | null = null;

  constructor(private canvas: HTMLCanvasElement, data: CloudPaths[], spot: number) {
    this.spot = spot;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio));
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 0.4, 7.5);
    this.root.position.x = 1.6; // keep the fan's origin clear of the headline
    this.scene.add(this.root);
    this.scene.fog = new THREE.FogExp2(0x06080b, 0.06);

    const grid = new THREE.GridHelper(16, 32, 0x1a2330, 0x0f1620);
    grid.position.y = -3.4;
    const gm = grid.material as THREE.Material;
    gm.transparent = true;
    gm.opacity = 0.5;
    this.scene.add(grid);

    const og = new THREE.BufferGeometry();
    og.setAttribute('position', new THREE.Float32BufferAttribute([-W / 2, 0, 0], 3));
    this.root.add(new THREE.Points(og, new THREE.PointsMaterial({ color: 0xb8e6ff, size: 0.35, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, map: dotTexture(), depthWrite: false })));

    this.setPaths(data, false);
    this.resize();
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.sync);
    this.io = new IntersectionObserver(([e]) => { this.onScreen = e.isIntersecting; this.sync(); });
    this.io.observe(canvas);
    this.sync();
  }

  /** Replace the path set (e.g. the dense browser-generated sample); fades the new set in. */
  setPaths(data: CloudPaths[], fadeIn = true, newSpot?: number) {
    if (newSpot && newSpot !== this.spot) { this.spot = newSpot; this.range = null; }
    if (this.layer) {
      this.root.remove(this.layer);
      this.layer.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
    }
    // fixed vertical scale across swaps so the cloud doesn't jump
    if (!this.range) {
      // scale from the 2nd–98th percentile of terminal prices so a few extreme paths
      // don't squash the fan; outliers simply run past the frame
      const ends: number[] = [];
      for (const m of data) for (const p of m.paths) ends.push(p[p.length - 1]);
      ends.sort((a, b) => a - b);
      const q = (f: number) => ends[Math.min(ends.length - 1, Math.floor(f * ends.length))];
      const lo = Math.min(this.spot * 0.85, q(0.02) * 0.97);
      const hi = Math.max(this.spot * 1.15, q(0.98) * 1.03);
      this.range = { lo, hi };
    }
    const { lo, hi } = this.range;
    const spot = this.spot;
    const yOf = (p: number) => ((p - spot) / (hi - lo)) * 6;
    const models = data.length || 1;
    let segs = 0;
    for (const m of data) for (const p of m.paths) segs += p.length - 1;
    const positions = new Float32Array(segs * 6);
    const colors = new Float32Array(segs * 6);
    this.pathPts = [];
    let o = 0;
    data.forEach((m, mi) => {
      const base = new THREE.Color(MODEL_HEX[m.id] ?? 0x7ccbff);
      m.paths.forEach((p, pi) => {
        const c = p[p.length - 1] < spot * 0.85 ? RED : base;
        const zSpread = ((mi + 0.5) / models - 0.5) * 3 + (((pi * 7919) % 100) / 100 - 0.5) * 0.6;
        const n = p.length;
        const pts = new Float32Array(n * 3);
        for (let d = 0; d < n; d++) {
          const f = d / (n - 1);
          pts[d * 3] = f * W - W / 2;
          pts[d * 3 + 1] = yOf(p[d]);
          pts[d * 3 + 2] = zSpread * f;
          if (d > 0) {
            positions.set(pts.subarray((d - 1) * 3, d * 3 + 3), o);
            const a = 0.25 + 0.75 * (d / n);
            colors[o] = colors[o + 3] = c.r * a;
            colors[o + 1] = colors[o + 4] = c.g * a;
            colors[o + 2] = colors[o + 5] = c.b * a;
            o += 6;
          }
        }
        this.pathPts.push(pts);
      });
    });
    const dense = this.pathPts.length > 600;
    const layer = new THREE.Group();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: dense ? 0.16 : 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    layer.add(new THREE.LineSegments(g, this.lineMat));

    // one travelling particle per path (capped) keeps the per-frame CPU cost small
    const n = Math.min(this.pathPts.length, 1500);
    this.phases = new Float32Array(n);
    for (let i = 0; i < n; i++) this.phases[i] = (i * 0.6180339) % 1;
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.particles = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xb8e6ff, size: 0.07, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, map: dotTexture(), depthWrite: false }));
    layer.add(this.particles);
    this.root.add(layer);
    this.layer = layer;
    this.fade = fadeIn ? 0 : 1;
  }

  setScroll(k: number) { this.scroll = k; }

  private sync = () => {
    const should = this.onScreen && document.visibilityState === 'visible';
    if (should && !this.running) { this.running = true; this.raf = requestAnimationFrame(this.loop); }
    else if (!should && this.running) { this.running = false; cancelAnimationFrame(this.raf); }
  };

  private resize = () => {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private loop = () => {
    if (!this.running) return;
    const t = (performance.now() - this.t0) / 1000;
    this.root.rotation.y = Math.sin(t * 0.08) * 0.35 - 0.25;
    this.root.rotation.x = 0.08 + Math.sin(t * 0.05) * 0.04;
    this.camera.position.z = 7.5 - this.scroll * 4.5;
    this.camera.position.y = 0.4 + this.scroll * 0.8;
    this.camera.lookAt(this.scroll * 1.5, 0, 0);
    if (this.fade < 1 && this.lineMat) {
      this.fade = Math.min(1, this.fade + 0.02);
      const target = this.pathPts.length > 600 ? 0.16 : 0.5;
      this.lineMat.opacity = target * this.fade;
    }
    if (this.particles) {
      const pos = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const n = this.phases.length;
      const stride = this.pathPts.length / n;
      for (let i = 0; i < n; i++) {
        const pts = this.pathPts[Math.floor(i * stride)];
        const segs = pts.length / 3 - 1;
        const f = ((this.phases[i] + t * 0.06) % 1) * segs;
        const k = Math.floor(f), r = f - k;
        const a = k * 3, b = a + 3;
        arr[i * 3] = pts[a] + (pts[b] - pts[a]) * r;
        arr[i * 3 + 1] = pts[a + 1] + (pts[b + 1] - pts[a + 1]) * r;
        arr[i * 3 + 2] = pts[a + 2] + (pts[b + 2] - pts[a + 2]) * r;
      }
      pos.needsUpdate = true;
    }
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.io.disconnect();
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.sync);
    // free every GPU buffer/material we created (renderer.dispose() alone does not)
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
    this.renderer.dispose();
  }
}

let tex: THREE.Texture | null = null;
function dotTexture() {
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(184,230,255,0.6)');
  grd.addColorStop(1, 'rgba(184,230,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  tex = new THREE.CanvasTexture(c);
  return tex;
}
