import type { ChartConfig, ResolvedChartConfig } from './config';
import type { ChartEventMap, Emitter } from './events';
import type { Renderer } from './renderer';
import type { ChartScales } from './chart';
import type { BoxStats } from './data/box';
import type { ResolvedSeries } from './data/series';
import type { Domain } from './scales/linear';

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
  /** Series ocultas por la leyenda u otro plugin. */
  readonly hiddenSeries: ReadonlySet<string>;
  readonly toggleSeries: (seriesId: string, hidden?: boolean) => void;
  /** Escalas del último dibujo; `null` antes del primero. */
  readonly getScales: () => ChartScales | null;
  /** Series resueltas a arreglos tipados (todas, incluidas las ocultas). */
  readonly getSeries: () => readonly ResolvedSeries[];
  /** Box plot: estadísticos por serie y categoría; vacío en otros tipos de gráfico. */
  readonly getBoxStats?: () => readonly (readonly BoxStats[])[];
  /** Simula el cursor en un píxel: marca el dato más cercano y publica `hover`. */
  readonly hoverAt: (px: number, py: number) => void;
  readonly clearHover: () => void;
  /** Rango de los datos visibles en ese eje (sin zoom). */
  readonly getDataDomain: (axis: 'x' | 'y') => Domain;
  /** Rango que se está mostrando, o `null` si es el automático. */
  readonly getViewDomain: (axis: 'x' | 'y') => Domain | null;
  /** Fija (o quita, con `null`) el rango mostrado: es lo que usan zoom y pan. */
  readonly setViewDomain: (axis: 'x' | 'y', domain: Domain | null) => void;
}

/** Espacio que un plugin pide alrededor del área de dibujo, en píxeles CSS. */
export type ReservedSpace = Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;

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
  /** Antes de calcular el layout: cuánto espacio necesita el plugin (leyenda, título). */
  reserveSpace?(ctx: PluginContext): ReservedSpace | void;
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
  'reserveSpace',
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

  reserveSpace(ctx: PluginContext): Required<ReservedSpace> {
    const total = { top: 0, right: 0, bottom: 0, left: 0 };
    for (const p of this.plugins) {
      const space = p.reserveSpace?.(ctx);
      if (!space) continue;
      total.top += space.top ?? 0;
      total.right += space.right ?? 0;
      total.bottom += space.bottom ?? 0;
      total.left += space.left ?? 0;
    }
    return total;
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
