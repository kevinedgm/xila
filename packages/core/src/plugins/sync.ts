import type { ChartPlugin, PluginContext } from '../plugin';
import type { HoverPayload } from '../events';

export interface SyncOptions {
  /** Nombre del grupo: los gráficos con el mismo nombre se mueven juntos. */
  readonly group: string;
  /** Compartir la línea del cursor (y el tooltip) en la misma X. */
  readonly cursor?: boolean;
  /** Compartir el rango de zoom/pan en X. */
  readonly zoom?: boolean;
}

interface Member {
  /** Se renueva en cada layout: el contexto captura el área de dibujo por valor. */
  ctx: PluginContext;
  readonly cursor: boolean;
  readonly zoom: boolean;
}

interface Group {
  readonly members: Set<Member>;
  /** Mientras se propaga un evento, los que provoca en los demás no se vuelven a propagar. */
  busy: boolean;
}

const groups = new Map<string, Group>();

function groupFor(name: string): Group {
  let g = groups.get(name);
  if (!g) {
    g = { members: new Set(), busy: false };
    groups.set(name, g);
  }
  return g;
}

/** Cuántos gráficos hay en un grupo (para pruebas y depuración). */
export function syncGroupSize(name: string): number {
  return groups.get(name)?.members.size ?? 0;
}

/**
 * Sincroniza varios gráficos con el mismo eje X: el cursor marca el mismo instante en todos y
 * el zoom de uno se aplica a los demás. Funciona en valores de datos, no en píxeles, así que
 * los gráficos pueden tener distinto tamaño o márgenes.
 */
export function syncPlugin(options: SyncOptions): ChartPlugin {
  const name = options.group;
  let member: Member | null = null;
  const offs: (() => void)[] = [];

  /** Ejecuta `fn` en los demás miembros sin que sus eventos reboten. */
  const broadcast = (fn: (other: Member) => void): void => {
    const g = groupFor(name);
    if (g.busy || !member) return;
    g.busy = true;
    try {
      for (const other of g.members) if (other !== member) fn(other);
    } finally {
      g.busy = false;
    }
  };

  const onHover = (payload: HoverPayload | null): void => {
    if (!member?.cursor) return;
    const scales = member.ctx.getScales();
    if (!scales || scales.x.kind === 'band') return;
    // Valor de X bajo el cursor: el del dato marcado si lo hay, si no el del píxel.
    const xValue = payload
      ? payload.hits[0]
        ? payload.hits[0].x
        : scales.x.toValue(payload.px)
      : null;
    broadcast((other) => {
      if (!other.cursor) return;
      if (xValue === null) return other.ctx.clearHover();
      const s = other.ctx.getScales();
      if (!s || s.x.kind === 'band') return;
      const area = other.ctx.layout.plotArea;
      other.ctx.hoverAt(s.x.toPixel(xValue), area.y + area.height / 2);
    });
  };

  const onZoom = (): void => {
    if (!member?.zoom) return;
    const view = member.ctx.getViewDomain('x');
    broadcast((other) => {
      if (other.zoom) other.ctx.setViewDomain('x', view);
    });
  };

  return {
    id: 'sync',
    install(ctx) {
      member = { ctx, cursor: options.cursor !== false, zoom: options.zoom !== false };
      groupFor(name).members.add(member);
      offs.push(ctx.events.on('hover', onHover), ctx.events.on('zoom', onZoom));
    },
    afterLayout(_layout, ctx) {
      if (member) member.ctx = ctx;
    },
    uninstall() {
      for (const off of offs) off();
      offs.length = 0;
      const g = groups.get(name);
      if (member && g) {
        g.members.delete(member);
        if (g.members.size === 0) groups.delete(name);
      }
      member = null;
    },
  };
}
