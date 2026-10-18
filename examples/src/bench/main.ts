import { decimatedCanvas, naiveCanvas, uplotRenderer, type BenchRenderer } from './renderers';
import { generateSeries, toObjects } from './synthetic';

declare global {
  interface Window {
    bench: {
      loadMemory(mode: 'objects' | 'columns', n: number): number;
      traverse(): number;
      setupRenderer(kind: string, n: number): void;
      firstRender(): { ms: number; vertices: number };
      pan(frames: number): Promise<PanStats>;
    };
  }
}

interface PanStats {
  workMedian: number;
  workP95: number;
  intervalMedian: number;
  intervalP95: number;
  vertices: number;
}

let held: unknown = null;
let renderer: BenchRenderer | null = null;
let domain: [number, number] = [0, 1];

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? NaN;
}

window.bench = {
  loadMemory(mode, n) {
    const s = generateSeries(n);
    held = mode === 'objects' ? toObjects(s) : s;
    return n;
  },

  traverse() {
    const t = performance.now();
    let min = Infinity;
    let max = -Infinity;
    if (Array.isArray(held)) {
      for (const p of held as { y: number }[]) {
        if (p.y < min) min = p.y;
        if (p.y > max) max = p.y;
      }
    } else {
      for (const v of (held as { y: Float64Array }).y) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (!(max >= min)) throw new Error('recorrido inválido');
    return performance.now() - t;
  },

  setupRenderer(kind, n) {
    const host = document.getElementById('host');
    if (!host) throw new Error('falta #host');
    host.innerHTML = '';
    const s = generateSeries(n);
    domain = [s.x[0] as number, s.x[n - 1] as number];
    renderer =
      kind === 'naive'
        ? naiveCanvas(host, s)
        : kind === 'decimated'
          ? decimatedCanvas(host, s)
          : uplotRenderer(host, s);
  },

  firstRender() {
    if (!renderer) throw new Error('renderer no inicializado');
    const t = performance.now();
    const vertices = renderer.draw(domain[0], domain[1]);
    renderer.flush();
    return { ms: performance.now() - t, vertices };
  },

  pan(frames) {
    const r = renderer;
    if (!r) throw new Error('renderer no inicializado');
    // Pan sobre la vista completa: cada fotograma desplaza 0.2 % del rango.
    const span = domain[1] - domain[0];
    const step = span * 0.002;
    const work: number[] = [];
    const intervals: number[] = [];
    let vertices = 0;
    let offset = 0;
    let last = 0;
    return new Promise((resolve) => {
      const tick = (now: number) => {
        if (last) intervals.push(now - last);
        last = now;
        offset += step;
        const t = performance.now();
        vertices = r.draw(domain[0] - span * 0.1 + offset, domain[1] - span * 0.1 + offset);
        r.flush();
        work.push(performance.now() - t);
        if (work.length < frames) requestAnimationFrame(tick);
        else
          resolve({
            workMedian: percentile(work, 50),
            workP95: percentile(work, 95),
            intervalMedian: percentile(intervals, 50),
            intervalP95: percentile(intervals, 95),
            vertices,
          });
      };
      requestAnimationFrame(tick);
    });
  },
};
