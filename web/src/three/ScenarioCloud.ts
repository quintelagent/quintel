import * as THREE from 'three';

export interface CloudPaths { id: string; paths: number[][] }

const MODEL_HEX: Record<string, number> = {
  gbm: 0x7ccbff, jump: 0xb8e6ff, bootstrap: 0x4fa3d9, garch: 0x9ad8ff, meanrev: 0x2b7fb8,
};
const RED = new THREE.Color(0xff4d5e);

/**
 * Three.js scenario cloud: every sampled path of the latest run as a glowing line,
 * fanning out from today's price; particles travel along the paths. Tail paths
 * (ending >15% below spot) are drawn in risk red.
 */
export class ScenarioCloud {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private group = new THREE.Group();
  private particles: THREE.Points | null = null;
  private pathPts: Float32Array[] = [];
  private phases: Float32Array = new Float32Array(0);
  private raf = 0;
  private scroll = 0;
  private t0 = performance.now();
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement, data: CloudPaths[], spot: number) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 0.4, 7.5);
    this.scene.add(this.group);
    this.scene.fog = new THREE.FogExp2(0x06080b, 0.06);
    this.build(data, spot);
    this.resize();
    window.addEventListener('resize', this.resize);
    this.loop();
  }

  private build(data: CloudPaths[], spot: number) {
    const all = data.flatMap((m) => m.paths.flat());
    const lo = Math.min(...all, spot * 0.7);
    const hi = Math.max(...all, spot * 1.3);
    const yOf = (p: number) => ((p - spot) / (hi - lo)) * 6; // spot at y=0
    const W = 8;
    const models = data.length || 1;
    const positions: number[] = [];
    const colors: number[] = [];
    data.forEach((m, mi) => {
      const base = new THREE.Color(MODEL_HEX[m.id] ?? 0x7ccbff);
      m.paths.forEach((p, pi) => {
        const tail = p[p.length - 1] < spot * 0.85;
        const c = tail ? RED : base;
        const zSpread = ((mi + 0.5) / models - 0.5) * 3 + (((pi * 7919) % 100) / 100 - 0.5) * 0.6;
        const pts = new Float32Array(p.length * 3);
        for (let d = 0; d < p.length; d++) {
          const x = (d / (p.length - 1)) * W - W / 2;
          const z = zSpread * (d / (p.length - 1));
          pts[d * 3] = x; pts[d * 3 + 1] = yOf(p[d]); pts[d * 3 + 2] = z;
          if (d > 0) {
            positions.push(pts[(d - 1) * 3], pts[(d - 1) * 3 + 1], pts[(d - 1) * 3 + 2], x, yOf(p[d]), z);
            const a = 0.25 + 0.75 * (d / p.length);
            colors.push(c.r * a, c.g * a, c.b * a, c.r * a, c.g * a, c.b * a);
          }
        }
        this.pathPts.push(pts);
      });
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    this.group.add(new THREE.LineSegments(g, mat));

    // origin glow
    const og = new THREE.BufferGeometry();
    og.setAttribute('position', new THREE.Float32BufferAttribute([-W / 2, 0, 0], 3));
    this.group.add(new THREE.Points(og, new THREE.PointsMaterial({ color: 0xb8e6ff, size: 0.35, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, map: dotTexture(), depthWrite: false })));

    // travelling particles (3 per path)
    const n = this.pathPts.length * 3;
    this.phases = new Float32Array(n);
    for (let i = 0; i < n; i++) this.phases[i] = ((i * 0.6180339) % 1);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.particles = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xb8e6ff, size: 0.07, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, map: dotTexture(), depthWrite: false }));
    this.group.add(this.particles);

    // faint grid floor
    const grid = new THREE.GridHelper(16, 32, 0x1a2330, 0x0f1620);
    grid.position.y = -3.4;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    this.scene.add(grid);
  }

  setScroll(k: number) { this.scroll = k; }

  private resize = () => {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private loop = () => {
    if (this.disposed) return;
    const t = (performance.now() - this.t0) / 1000;
    this.group.rotation.y = Math.sin(t * 0.08) * 0.35 - 0.25;
    this.group.rotation.x = 0.08 + Math.sin(t * 0.05) * 0.04;
    this.camera.position.z = 7.5 - this.scroll * 4.5;
    this.camera.position.y = 0.4 + this.scroll * 0.8;
    this.camera.lookAt(this.scroll * 1.5, 0, 0);
    if (this.particles) {
      const pos = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < this.phases.length; i++) {
        const pts = this.pathPts[Math.floor(i / 3)];
        const segs = pts.length / 3 - 1;
        const f = ((this.phases[i] + t * 0.06) % 1) * segs;
        const k = Math.floor(f), r = f - k;
        for (let a = 0; a < 3; a++) arr[i * 3 + a] = pts[k * 3 + a] + (pts[(k + 1) * 3 + a] - pts[k * 3 + a]) * r;
      }
      pos.needsUpdate = true;
    }
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
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
