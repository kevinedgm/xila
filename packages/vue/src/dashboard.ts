import {
  buildChart,
  buildKpi,
  legendPlugin,
  tooltipPlugin,
  type ChartConfig,
  type Condition,
  type DashboardConfig,
  type DataTable,
  type FiltroConfig,
  type PanelGrafico,
  type PanelKpi,
  type ValidationError,
} from '@xila/core';
import { computed, defineComponent, h, markRaw, shallowRef, type PropType, type VNode } from 'vue';
import { XilaChart } from './chart';

/**
 * Dashboard declarativo. Los filtros viven en un estado compartido (`conditions`) y cada
 * panel deriva lo suyo de `tabla + condiciones` con `buildChart` / `buildKpi` del núcleo,
 * así un filtro actualiza todos los paneles sin que se conozcan entre sí.
 *
 * Sin SFC ni CSS aparte: los componentes son funciones de render y el estilo mínimo se
 * inyecta una vez, para que el paquete sea un solo archivo JS.
 */

const STYLE_ID = 'xila-dashboard-style';
const CSS = `
.xila-dashboard{font-family:system-ui,sans-serif;color:var(--xila-text,#1f2933);background:var(--xila-bg,#f5f7fa);min-height:100vh;padding:16px 24px;box-sizing:border-box}
.xila-dashboard[data-theme=dark]{--xila-text:#e6e8eb;--xila-bg:#15191e;--xila-panel:#1f252c;--xila-border:#2c343d;--xila-muted:#9aa5b1}
.xila-dashboard h1{font-size:22px;margin:0 0 12px}
.xila-filters{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end;margin-bottom:16px}
.xila-filter{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--xila-muted,#52606d)}
.xila-filter input,.xila-filter select{font:inherit;padding:4px 6px;border:1px solid var(--xila-border,#cbd2d9);border-radius:4px;background:var(--xila-panel,#fff);color:inherit}
.xila-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}
.xila-panel{grid-column:span var(--span,12);background:var(--xila-panel,#fff);border:1px solid var(--xila-border,#e4e7eb);border-radius:8px;padding:12px 16px;box-sizing:border-box;min-width:0}
.xila-panel h2{font-size:14px;font-weight:600;margin:0 0 8px;color:var(--xila-muted,#52606d)}
.xila-panel-chart{height:320px}
.xila-kpi-value{font-size:28px;font-weight:700;line-height:1.2}
.xila-kpi-change{font-size:13px;margin-top:4px}
.xila-kpi-change[data-sign=up]{color:#0b8043}
.xila-kpi-change[data-sign=down]{color:#c5221f}
.xila-errors{background:#fde8e8;color:#8a1c1c;border:1px solid #f5b5b5;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:14px}
.xila-errors code{font-family:ui-monospace,monospace}
@media (max-width:720px){.xila-grid{grid-template-columns:1fr}.xila-panel{grid-column:span 1}.xila-dashboard{padding:12px}}
`;

function ensureStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/** Estado de un filtro: para fechas `[desde, hasta]` en ISO; para categorías, las elegidas. */
export type FilterState = Readonly<
  Record<number, { from?: string; to?: string; values?: string[] }>
>;

/** Traduce el estado de los filtros de la UI a condiciones del núcleo, por tabla. */
export function toConditions(
  filtros: readonly FiltroConfig[],
  state: FilterState,
): Readonly<Record<string, Condition[]>> {
  const out: Record<string, Condition[]> = {};
  filtros.forEach((f, i) => {
    const s = state[i];
    if (!s) return;
    const list = (out[f.datos] ??= []);
    if (f.tipo === 'fechas') {
      if (s.from || s.to) {
        const cond: { column: string; min?: string; max?: string } = { column: f.columna };
        if (s.from) cond.min = s.from;
        // `hasta` es inclusivo en días: se toma el final de ese día.
        if (s.to) cond.max = `${s.to}T23:59:59.999Z`;
        list.push(cond);
      }
    } else if (s.values && s.values.length > 0) {
      list.push({ column: f.columna, in: s.values });
    }
  });
  return out;
}

export const XilaKpi = defineComponent({
  name: 'XilaKpi',
  props: {
    panel: { type: Object as PropType<PanelKpi>, required: true },
    table: { type: Object as PropType<DataTable>, required: true },
    conditions: { type: Array as PropType<readonly Condition[]>, default: () => [] },
  },
  setup(props) {
    const result = computed(() => buildKpi(props.panel, props.table, props.conditions));
    return () =>
      h('div', { class: 'xila-kpi' }, [
        h('div', { class: 'xila-kpi-value' }, result.value.text),
        result.value.changeText !== null
          ? h(
              'div',
              {
                class: 'xila-kpi-change',
                'data-sign': (result.value.change ?? 0) >= 0 ? 'up' : 'down',
              },
              `${result.value.changeText} vs. periodo anterior`,
            )
          : null,
      ]);
  },
});

export const XilaPanelChart = defineComponent({
  name: 'XilaPanelChart',
  props: {
    panel: { type: Object as PropType<PanelGrafico>, required: true },
    table: { type: Object as PropType<DataTable>, required: true },
    conditions: { type: Array as PropType<readonly Condition[]>, default: () => [] },
    theme: { type: String as PropType<'light' | 'dark'>, default: 'light' },
  },
  setup(props) {
    const config = computed<ChartConfig>(() => {
      const base = buildChart(props.panel, props.table, props.conditions);
      const plugins = [tooltipPlugin(), ...(base.series.length > 1 ? [legendPlugin()] : [])];
      return markRaw({ ...base, plugins, theme: props.theme });
    });
    return () => h('div', { class: 'xila-panel-chart' }, [h(XilaChart, { config: config.value })]);
  },
});

export const XilaFilters = defineComponent({
  name: 'XilaFilters',
  props: {
    filtros: { type: Array as PropType<readonly FiltroConfig[]>, required: true },
    tables: { type: Object as PropType<Readonly<Record<string, DataTable>>>, required: true },
    modelValue: { type: Object as PropType<FilterState>, required: true },
  },
  emits: {
    'update:modelValue': (value: FilterState) => typeof value === 'object',
  },
  setup(props, { emit }) {
    const set = (i: number, patch: { from?: string; to?: string; values?: string[] }): void => {
      emit('update:modelValue', { ...props.modelValue, [i]: { ...props.modelValue[i], ...patch } });
    };
    const categoriesOf = (f: FiltroConfig): readonly string[] => {
      const c = props.tables[f.datos]?.column(f.columna);
      return c?.kind === 'category' ? c.categories : [];
    };
    return () =>
      h(
        'div',
        { class: 'xila-filters' },
        props.filtros.map((f, i): VNode => {
          const s = props.modelValue[i] ?? {};
          if (f.tipo === 'fechas') {
            return h('label', { class: 'xila-filter', 'data-filter': i }, [
              f.etiqueta ?? f.columna,
              h('span', [
                h('input', {
                  type: 'date',
                  value: s.from ?? '',
                  'aria-label': 'desde',
                  onChange: (e: Event) => set(i, { from: (e.target as HTMLInputElement).value }),
                }),
                ' – ',
                h('input', {
                  type: 'date',
                  value: s.to ?? '',
                  'aria-label': 'hasta',
                  onChange: (e: Event) => set(i, { to: (e.target as HTMLInputElement).value }),
                }),
              ]),
            ]);
          }
          const multiple = f.multiple ?? false;
          return h('label', { class: 'xila-filter', 'data-filter': i }, [
            f.etiqueta ?? f.columna,
            h(
              'select',
              {
                multiple,
                onChange: (e: Event) => {
                  const el = e.target as HTMLSelectElement;
                  const values = Array.from(el.selectedOptions, (o) => o.value).filter(
                    (v) => v !== '',
                  );
                  set(i, { values });
                },
              },
              [
                multiple ? null : h('option', { value: '', selected: !s.values?.length }, 'Todas'),
                ...categoriesOf(f).map((c) =>
                  h('option', { value: c, selected: s.values?.includes(c) ?? false }, c),
                ),
              ],
            ),
          ]);
        }),
      );
  },
});

export const XilaDashboard = defineComponent({
  name: 'XilaDashboard',
  props: {
    config: { type: Object as PropType<DashboardConfig>, required: true },
    tables: { type: Object as PropType<Readonly<Record<string, DataTable>>>, required: true },
    errors: { type: Array as PropType<readonly ValidationError[]>, default: () => [] },
  },
  setup(props) {
    ensureStyles();
    const state = shallowRef<FilterState>({});
    const conditions = computed(() => toConditions(props.config.filtros ?? [], state.value));
    const theme = computed(() => props.config.tema ?? 'light');

    return () =>
      h('div', { class: 'xila-dashboard', 'data-theme': theme.value }, [
        h('h1', props.config.titulo),
        props.errors.length > 0
          ? h('div', { class: 'xila-errors', role: 'alert' }, [
              h('strong', 'Revisa dashboard.json:'),
              h(
                'ul',
                props.errors.map((e) => h('li', [h('code', e.path), ` · ${e.message}`])),
              ),
            ])
          : null,
        props.config.filtros?.length
          ? h(XilaFilters, {
              filtros: props.config.filtros,
              tables: props.tables,
              modelValue: state.value,
              'onUpdate:modelValue': (v: FilterState) => (state.value = v),
            })
          : null,
        h(
          'div',
          { class: 'xila-grid' },
          props.config.paneles.map((panel, i) => {
            const table = props.tables[panel.datos];
            const span = panel.ancho ?? (panel.tipo === 'kpi' ? 3 : 12);
            const conds = conditions.value[panel.datos] ?? [];
            const broken = props.errors.some((e) => e.path.startsWith(`paneles[${i}]`));
            return h(
              'section',
              { class: 'xila-panel', 'data-panel': i, style: { '--span': String(span) } },
              [
                panel.titulo ? h('h2', panel.titulo) : null,
                !table || broken
                  ? h(
                      'p',
                      { class: 'xila-panel-error' },
                      'Este panel tiene errores de configuración.',
                    )
                  : panel.tipo === 'kpi'
                    ? h(XilaKpi, { panel, table, conditions: conds })
                    : h(XilaPanelChart, { panel, table, conditions: conds, theme: theme.value }),
              ],
            );
          }),
        ),
      ]);
  },
});
