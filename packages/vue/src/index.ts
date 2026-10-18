import { Chart } from '@xila/core';
import { defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue';

/** Envoltorio delgado: traduce el ciclo de vida de Vue al de Chart. */
export const XilaChart = defineComponent({
  name: 'XilaChart',
  setup() {
    const el = ref<HTMLDivElement | null>(null);
    let chart: Chart | null = null;

    onMounted(() => {
      if (el.value) chart = new Chart({ container: el.value });
    });
    onBeforeUnmount(() => {
      chart?.destroy();
      chart = null;
    });

    return () => h('div', { ref: el, class: 'xila-chart' });
  },
});
