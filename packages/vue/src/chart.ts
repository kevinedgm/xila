import { Chart, type ChartConfig } from 'xilaplot';
import {
  defineComponent,
  h,
  markRaw,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type PropType,
} from 'vue';

const STYLE_ID = 'xila-chart-style';
const CSS = `
.xila-chart-host{position:relative;width:100%;height:100%}
.xila-chart{width:100%;height:100%}
.xila-skeleton{position:absolute;inset:0;border-radius:6px;background:linear-gradient(90deg,rgba(128,128,128,.12) 25%,rgba(128,128,128,.22) 37%,rgba(128,128,128,.12) 63%);background-size:400% 100%;animation:xila-shimmer 1.4s ease infinite;pointer-events:none}
@keyframes xila-shimmer{0%{background-position:100% 50%}100%{background-position:0 50%}}
@media (prefers-reduced-motion:reduce){.xila-skeleton{animation:none}}
`;

function injectStyle(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/**
 * Envoltorio delgado: traduce el ciclo de vida de Vue al de `Chart`. Toda la lógica vive
 * en `xilaplot`. La configuración se trata con `markRaw` para que Vue no envuelva los
 * `Float64Array` en proxies reactivos, lo que arruinaría el rendimiento.
 *
 * Mientras el gráfico no se ha dibujado (datos cargando, o fuera de pantalla con render
 * diferido) se muestra una silueta gris del tamaño final, así la página no salta al aparecer.
 */
export const XilaChart = defineComponent({
  name: 'XilaChart',
  props: {
    config: { type: Object as PropType<ChartConfig>, required: true },
    /** `false` quita la silueta de carga. */
    skeleton: { type: Boolean, default: true },
  },
  emits: {
    ready: (chart: Chart) => chart instanceof Chart,
    draw: (first: boolean) => typeof first === 'boolean',
  },
  setup(props, { emit }) {
    const el = shallowRef<HTMLDivElement | null>(null);
    const drawn = ref(false);
    let chart: Chart | null = null;

    onMounted(() => {
      if (!el.value) return;
      injectStyle();
      chart = markRaw(new Chart(el.value, markRaw(props.config)));
      chart.events.on('draw', ({ first }) => {
        if (first) drawn.value = true;
        emit('draw', first);
      });
      emit('ready', chart);
    });

    watch(
      () => props.config,
      (next) => chart?.update(markRaw(next)),
    );

    onBeforeUnmount(() => {
      chart?.destroy();
      chart = null;
    });

    return () =>
      h('div', { class: 'xila-chart-host' }, [
        h('div', { ref: el, class: 'xila-chart' }),
        props.skeleton && !drawn.value
          ? h('div', { class: 'xila-skeleton', 'aria-hidden': 'true' })
          : null,
      ]);
  },
});

export type { Chart, ChartConfig };
