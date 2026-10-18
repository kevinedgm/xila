import { originNeedsReset, toRelativeFloat32 } from './data/relative';
import { CanvasRenderer } from './renderer-canvas';
import type { Layer, PointStyle, Transform } from './renderer';

export type Backend = 'canvas' | 'webgl';

/**
 * Backend híbrido: ejes, texto, líneas y barras siguen en Canvas 2D; los puntos de la capa
 * `data` van a un canvas WebGL2 intercalado entre `data` y `overlay`.
 *
 * Por qué solo puntos: es el caso donde Canvas no escala (un `arc` por punto, 1M de arcos por
 * fotograma) y donde la GPU brilla: `x` e `y` se suben una vez a un buffer y cada fotograma
 * solo cambian cuatro números (desplazamiento y escala por eje) como uniforms. El shader de
 * vértices coloca los puntos en paralelo y el de fragmentos recorta un círculo.
 *
 * Precisión: la GPU trabaja en float32. Se sube `valor − origen` (ADR 0003) y el origen se
 * recalcula solo cuando el error de float32 en la ventana visible superaría un cuarto de píxel.
 *
 * Si WebGL2 no existe o el navegador pierde el contexto, los puntos se dibujan con Canvas 2D y
 * se avisa una vez en consola: el gráfico nunca queda en blanco.
 */
export class WebGLRenderer extends CanvasRenderer {
  /** `'webgl'` mientras la GPU esté disponible; `'canvas'` si se cayó al fallback. */
  backend: Backend = 'canvas';
  /** El gráfico lo fija para volver a dibujar cuando se pierde el contexto. */
  onFallback: (() => void) | null = null;

  private readonly glCanvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null | undefined> = {};
  private readonly buffers = new WeakMap<Float64Array, PointBuffer>();
  private scissor: [number, number, number, number] | null = null;
  private glWidth = 0;
  private glHeight = 0;
  private glDpr = 1;
  private warned = false;

  constructor(container: HTMLElement) {
    super(container);
    this.glCanvas = document.createElement('canvas');
    this.glCanvas.dataset['layer'] = 'gl';
    this.glCanvas.style.position = 'absolute';
    this.glCanvas.style.inset = '0';
    this.glCanvas.style.pointerEvents = 'none';
    const overlay = this.element.querySelector('canvas[data-layer="overlay"]');
    this.element.insertBefore(this.glCanvas, overlay);
    this.glCanvas.addEventListener('webglcontextlost', this.onContextLost);
    this.initGL();
  }

  override resize(width: number, height: number, dpr: number): void {
    super.resize(width, height, dpr);
    this.glWidth = width;
    this.glHeight = height;
    this.glDpr = dpr;
    this.glCanvas.width = Math.round(width * dpr);
    this.glCanvas.height = Math.round(height * dpr);
    this.glCanvas.style.width = `${width}px`;
    this.glCanvas.style.height = `${height}px`;
    this.gl?.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
    this.scissor = null;
  }

  override clear(layer: Layer): void {
    super.clear(layer);
    if (layer === 'data' && this.gl) {
      this.gl.disable(this.gl.SCISSOR_TEST);
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
      this.scissor = null;
    }
  }

  override clip(layer: Layer, x: number, y: number, width: number, height: number): void {
    super.clip(layer, x, y, width, height);
    if (layer === 'data') {
      // WebGL mide desde abajo a la izquierda, en píxeles físicos.
      const d = this.glDpr;
      this.scissor = [
        Math.round(x * d),
        Math.round((this.glHeight - y - height) * d),
        Math.round(width * d),
        Math.round(height * d),
      ];
    }
  }

  override drawPointSeries(
    layer: Layer,
    x: Float64Array,
    y: Float64Array,
    from: number,
    to: number,
    style: PointStyle,
    t: Transform,
    radii?: Float64Array,
  ): void {
    const gl = this.gl;
    // Radios por punto y capas que no son `data` (el marcador de hover) siguen en Canvas.
    if (!gl || !this.program || layer !== 'data' || radii || to <= from) {
      super.drawPointSeries(layer, x, y, from, to, style, t, radii);
      return;
    }
    const buf = this.upload(gl, x, y, from, to, t);
    if (!buf) {
      super.drawPointSeries(layer, x, y, from, to, style, t, radii);
      return;
    }

    gl.useProgram(this.program);
    if (this.scissor) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(...this.scissor);
    } else {
      gl.disable(gl.SCISSOR_TEST);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.vbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string): WebGLUniformLocation | null => this.uniforms[name] ?? null;
    const d = this.glDpr;
    // px = base + (v − offset)·scale, con v relativo al origen: offset también se hace relativo.
    gl.uniform2f(u('offset'), t.x.offset - buf.originX, t.y.offset - buf.originY);
    gl.uniform2f(u('scale'), t.x.scale * d, t.y.scale * d);
    gl.uniform2f(u('base'), t.x.base * d, t.y.base * d);
    gl.uniform2f(u('resolution'), this.glCanvas.width, this.glCanvas.height);
    gl.uniform1f(u('size'), style.radius * 2 * d);
    const [r, g, b, a] = parseColor(style.fill, this.parseContext());
    gl.uniform4f(u('color'), r, g, b, a * (style.opacity ?? 1));
    gl.drawArrays(gl.POINTS, from - buf.from, to - from);
  }

  override toDataURL(type = 'image/png'): string {
    // La imagen compuesta de Canvas no conoce el canvas WebGL; aquí se compone en orden del DOM.
    if (!this.gl || this.backend !== 'webgl') return super.toDataURL(type);
    const out = document.createElement('canvas');
    out.width = this.glCanvas.width;
    out.height = this.glCanvas.height;
    const ctx = out.getContext('2d');
    if (!ctx) return super.toDataURL(type);
    const layers = this.element.querySelectorAll<HTMLCanvasElement>('canvas');
    ctx.fillStyle = this.currentBackground();
    ctx.fillRect(0, 0, out.width, out.height);
    for (const c of layers) ctx.drawImage(c, 0, 0);
    return out.toDataURL(type);
  }

  override destroy(): void {
    this.glCanvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.gl = null;
    super.destroy();
  }

  private initGL(): void {
    let gl: WebGL2RenderingContext | null;
    try {
      gl = this.glCanvas.getContext('webgl2', {
        antialias: true,
        premultipliedAlpha: true,
        // Necesario para que `toDataURL` y las capturas lean el canvas después de dibujar.
        preserveDrawingBuffer: true,
      });
    } catch {
      gl = null;
    }
    if (!gl) {
      this.fallback('WebGL2 no está disponible');
      return;
    }
    const program = buildProgram(gl);
    if (!program) {
      this.fallback('no se pudo compilar el shader');
      return;
    }
    this.gl = gl;
    this.program = program;
    for (const name of ['offset', 'scale', 'base', 'resolution', 'size', 'color']) {
      this.uniforms[name] = gl.getUniformLocation(program, `u_${name}`);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.backend = 'webgl';
  }

  private readonly onContextLost = (e: Event): void => {
    e.preventDefault();
    this.gl = null;
    this.program = null;
    this.fallback('el navegador perdió el contexto WebGL');
    this.onFallback?.();
  };

  private parseContext(): CanvasRenderingContext2D {
    return this.ctx('overlay');
  }

  private fallback(reason: string): void {
    this.backend = 'canvas';
    this.glCanvas.style.display = 'none';
    if (!this.warned) {
      this.warned = true;
      console.warn(`Xila: ${reason}; los puntos se dibujan con Canvas 2D.`);
    }
  }

  /**
   * Sube `[from, to)` de la serie si no está ya en la GPU. El buffer se reutiliza mientras
   * cubra el rango pedido y su origen siga dando precisión de un cuarto de píxel.
   */
  private upload(
    gl: WebGL2RenderingContext,
    x: Float64Array,
    y: Float64Array,
    from: number,
    to: number,
    t: Transform,
  ): PointBuffer | null {
    const existing = this.buffers.get(y);
    // Tolerancia: un cuarto de píxel CSS en unidades de datos.
    const tolX = Math.abs(0.25 / t.x.scale);
    const tolY = Math.abs(0.25 / t.y.scale);
    const xDomain: [number, number] = [x[from] as number, x[to - 1] as number];
    if (
      existing &&
      existing.x === x &&
      existing.from <= from &&
      existing.to >= to &&
      !originNeedsReset(existing.originX, xDomain, tolX) &&
      !originNeedsReset(existing.originY, existing.yDomain, tolY)
    ) {
      return existing;
    }
    // Se sube la serie entera: el pan después solo cambia uniforms (ADR 0002 y 0003).
    const n = x.length;
    const originX = x[from] as number;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let i = 0; i < n; i++) {
      const v = y[i] as number;
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }
    const originY = yMin === Infinity ? 0 : (yMin + yMax) / 2;
    const data = new Float32Array(n * 2);
    const rx = toRelativeFloat32(x, originX);
    const ry = toRelativeFloat32(y, originY);
    for (let i = 0; i < n; i++) {
      data[i * 2] = rx[i] as number;
      data[i * 2 + 1] = ry[i] as number;
    }
    const vbo = existing?.vbo ?? gl.createBuffer();
    if (!vbo) return null;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const buf: PointBuffer = {
      vbo,
      x,
      from: 0,
      to: n,
      originX,
      originY,
      yDomain: yMin === Infinity ? [0, 0] : [yMin, yMax],
    };
    this.buffers.set(y, buf);
    return buf;
  }
}

interface PointBuffer {
  readonly vbo: WebGLBuffer;
  readonly x: Float64Array;
  readonly from: number;
  readonly to: number;
  readonly originX: number;
  readonly originY: number;
  readonly yDomain: readonly [number, number];
}

const VERTEX = `#version 300 es
layout(location = 0) in vec2 a_pos;
uniform vec2 u_offset;
uniform vec2 u_scale;
uniform vec2 u_base;
uniform vec2 u_resolution;
uniform float u_size;
void main() {
  if (isnan(a_pos.y) || isnan(a_pos.x)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // fuera del área visible
    gl_PointSize = 0.0;
    return;
  }
  vec2 px = u_base + (a_pos - u_offset) * u_scale;
  vec2 clip = px / u_resolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = u_size + 2.0;
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec4 u_color;
uniform float u_size;
out vec4 outColor;
void main() {
  // Círculo con borde suavizado de un píxel; el punto se dibuja 2 px más grande para el borde.
  float d = length(gl_PointCoord - 0.5) * (u_size + 2.0);
  float alpha = clamp((u_size / 2.0 + 0.5) - d, 0.0, 1.0) * u_color.a;
  if (alpha <= 0.0) discard;
  outColor = vec4(u_color.rgb * alpha, alpha);
}`;

function buildProgram(gl: WebGL2RenderingContext): WebGLProgram | null {
  const compile = (type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('Xila: error de shader', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };
  const vs = compile(gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('Xila: error al enlazar el shader', gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

const colorCache = new Map<string, readonly [number, number, number, number]>();

/**
 * Color CSS → `[r, g, b, a]` en 0–1. Acepta `#rgb`, `#rrggbb`, `#rrggbbaa` y `rgb()/rgba()`;
 * cualquier otro nombre se normaliza con un contexto 2D (`fillStyle` devuelve hex o rgba).
 */
export function parseColor(
  color: string,
  ctx?: CanvasRenderingContext2D | null,
): readonly [number, number, number, number] {
  const cached = colorCache.get(color);
  if (cached) return cached;
  let parsed = parseHex(color) ?? parseRgb(color);
  if (!parsed && ctx) {
    ctx.fillStyle = color;
    const norm = ctx.fillStyle;
    if (typeof norm === 'string') parsed = parseHex(norm) ?? parseRgb(norm);
  }
  const result = parsed ?? ([0, 0, 0, 1] as const);
  colorCache.set(color, result);
  return result;
}

function parseHex(s: string): [number, number, number, number] | null {
  const m = /^#([0-9a-f]{3,8})$/i.exec(s.trim());
  if (!m) return null;
  const h = m[1] as string;
  if (h.length === 3 || h.length === 4) {
    const v = [...h].map((c) => parseInt(c + c, 16) / 255);
    return [v[0] as number, v[1] as number, v[2] as number, h.length === 4 ? (v[3] as number) : 1];
  }
  if (h.length === 6 || h.length === 8) {
    const v = [0, 2, 4, 6].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    return [v[0] as number, v[1] as number, v[2] as number, h.length === 8 ? (v[3] as number) : 1];
  }
  return null;
}

function parseRgb(s: string): [number, number, number, number] | null {
  const m =
    /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/i.exec(
      s.trim(),
    );
  if (!m) return null;
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255, a];
}
