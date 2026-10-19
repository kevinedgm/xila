import type { ChartPlugin, PluginContext } from '../plugin';
import { displayFont } from '../theme';

export interface TitleOptions {
  /** Título: en la anatomía editorial es el hallazgo, una frase, no el nombre de la variable. */
  readonly title: string;
  /** Línea secundaria: qué se mide, unidades y periodo. */
  readonly subtitle?: string;
  /** Alineación del bloque (`'left'`). */
  readonly align?: 'left' | 'center';
}

/**
 * Título y subtítulo en HTML sobre el gráfico. Reserva arriba su propio alto, como la leyenda;
 * si también hay `legendPlugin` arriba, la leyenda se coloca debajo del título.
 * El título va en tinta, en la fuente de título del tema, peso 600 a 1,4 veces el tamaño base; el subtítulo en el color de
 * los ejes, para que la jerarquía se lea sin tamaños extremos.
 */
export function titlePlugin(options: TitleOptions): ChartPlugin {
  let el: HTMLDivElement | null = null;

  const render = (ctx: PluginContext): void => {
    if (!el) return;
    const { theme } = ctx.config;
    el.innerHTML = '';
    el.style.textAlign = options.align ?? 'left';
    const h = document.createElement('div');
    h.className = 'xila-title-text';
    h.textContent = options.title;
    Object.assign(h.style, {
      // El hallazgo va en la fuente de título de la marca (Fraunces), un poco más grande.
      font: `600 ${Math.round(theme.fontSize * 1.4)}px/1.25 ${displayFont(theme)}`,
      color: theme.text,
    });
    el.appendChild(h);
    if (options.subtitle) {
      const s = document.createElement('div');
      s.className = 'xila-title-sub';
      s.textContent = options.subtitle;
      Object.assign(s.style, {
        font: `${theme.fontSize}px/1.4 ${theme.fontFamily}`,
        color: theme.axis,
        marginTop: '2px',
      });
      el.appendChild(s);
    }
  };

  return {
    id: 'title',
    install(ctx) {
      el = document.createElement('div');
      el.className = 'xila-title';
      el.setAttribute('role', 'heading');
      el.setAttribute('aria-level', '3');
      Object.assign(el.style, {
        position: 'absolute',
        left: '0',
        right: '0',
        top: '0',
        padding: '6px 8px 8px',
        pointerEvents: 'none',
      });
      // Va antes que cualquier otro bloque (la leyenda lo busca como hermano anterior).
      ctx.renderer.element.prepend(el);
      render(ctx);
    },
    afterLayout(_layout, ctx) {
      render(ctx);
    },
    reserveSpace() {
      return { top: el?.offsetHeight ?? 0 };
    },
    uninstall() {
      el?.remove();
      el = null;
    },
  };
}
