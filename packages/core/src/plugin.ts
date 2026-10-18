import type { ChartConfig, ResolvedChartConfig } from './config';
import type { ChartEventMap, Emitter } from './events';
import type { Renderer } from './renderer';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Layout {
  readonly width: number;
  readonly height: number;
  /** Área donde se dibujan los datos, ya descontados ejes y márgenes. */
  readonly plotArea: Rect;
}

/** Lo que un plugin recibe en cada hook. */
export interface PluginContext {
  readonly config: ResolvedChartConfig;
  readonly renderer: Renderer;
  readonly layout: Layout;
  readonly events: Emitter;
  /** Pide un redibujo en el siguiente fotograma. */
  readonly requestDraw: () => void;
}

/**
 * Contrato de extensión. Todos los hooks son opcionales y corren en este orden fijo,
 * documentado en `PLUGIN_HOOK_ORDER`, para que dos plugins que dependen uno del otro
 * (por ejemplo, tooltip sobre anotación) tengan un resultado predecible.
 */
export interface ChartPlugin {
  readonly id: string;
  /** Al registrarse. Aquí se crean nodos del DOM o listeners propios. */
  install?(ctx: PluginContext): void;
  /** Antes de resolver una configuración nueva. Puede devolver una modificada. */
  beforeUpdate?(config: ChartConfig, ctx: PluginContext): ChartConfig | void;
  /** Cuando ya se conoce el área de dibujo. */
  afterLayout?(layout: Layout, ctx: PluginContext): void;
  beforeDraw?(ctx: PluginContext): void;
  afterDraw?(ctx: PluginContext): void;
  onEvent?<K extends keyof ChartEventMap>(
    name: K,
    payload: ChartEventMap[K],
    ctx: PluginContext,
  ): void;
  /** Debe deshacer todo lo que creó `install`. */
  uninstall?(ctx: PluginContext): void;
}

export const PLUGIN_HOOK_ORDER = [
  'install',
  'beforeUpdate',
  'afterLayout',
  'beforeDraw',
  'afterDraw',
  'onEvent',
  'uninstall',
] as const;

export type PluginHook = (typeof PLUGIN_HOOK_ORDER)[number];

/** Ejecuta los hooks de una lista de plugins en orden de registro. */
export class PluginRegistry {
  private readonly plugins: ChartPlugin[] = [];

  constructor(plugins: readonly ChartPlugin[] = []) {
    for (const p of plugins) this.add(p);
  }

  add(plugin: ChartPlugin): void {
    if (this.plugins.some((p) => p.id === plugin.id)) {
      throw new RangeError(`Ya hay un plugin con el id "${plugin.id}"`);
    }
    this.plugins.push(plugin);
  }

  list(): readonly ChartPlugin[] {
    return this.plugins;
  }

  install(ctx: PluginContext): void {
    for (const p of this.plugins) p.install?.(ctx);
  }

  beforeUpdate(config: ChartConfig, ctx: PluginContext): ChartConfig {
    let current = config;
    for (const p of this.plugins) current = p.beforeUpdate?.(current, ctx) ?? current;
    return current;
  }

  afterLayout(layout: Layout, ctx: PluginContext): void {
    for (const p of this.plugins) p.afterLayout?.(layout, ctx);
  }

  beforeDraw(ctx: PluginContext): void {
    for (const p of this.plugins) p.beforeDraw?.(ctx);
  }

  afterDraw(ctx: PluginContext): void {
    for (const p of this.plugins) p.afterDraw?.(ctx);
  }

  onEvent<K extends keyof ChartEventMap>(
    name: K,
    payload: ChartEventMap[K],
    ctx: PluginContext,
  ): void {
    for (const p of this.plugins) p.onEvent?.(name, payload, ctx);
  }

  /** Desinstala en orden inverso, para que lo que se instaló al final se quite primero. */
  uninstall(ctx: PluginContext): void {
    for (let i = this.plugins.length - 1; i >= 0; i--) this.plugins[i]?.uninstall?.(ctx);
    this.plugins.length = 0;
  }
}
