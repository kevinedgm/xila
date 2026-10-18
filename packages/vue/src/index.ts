import { Chart, type ChartConfig } from '@xila/core';
import {
  defineComponent,
  h,
  markRaw,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch,
  type PropType,
} from 'vue';

/**
 * Envoltorio delgado: traduce el ciclo de vida de Vue al de `Chart`. Toda la lógica vive
 * en `@xila/core`. La configuración se trata con `markRaw` para que Vue no envuelva los
 * `Float64Array` en proxies reactivos, lo que arruinaría el rendimiento.
 */
export const XilaChart = defineComponent({
  name: 'XilaChart',
  props: {
    config: { type: Object as PropType<ChartConfig>, required: true },
  },
  emits: {
    ready: (chart: Chart) => chart instanceof Chart,
  },
  setup(props, { emit }) {
    const el = shallowRef<HTMLDivElement | null>(null);
    let chart: Chart | null = null;

    onMounted(() => {
      if (!el.value) return;
      chart = markRaw(new Chart(el.value, markRaw(props.config)));
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

    return () => h('div', { ref: el, class: 'xila-chart', style: 'width:100%;height:100%' });
  },
});

export type { Chart, ChartConfig };
