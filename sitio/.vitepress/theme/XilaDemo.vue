<script setup lang="ts">
// Ejemplo vivo: recibe la función del módulo generado desde la valla ```ts demo (puede ser asíncrona: descarga el CSV)
// y monta un `Chart` real en cuanto está en el DOM. Es una función y no un objeto para que Vue no envuelva los
// Float64Array en proxies. El gráfico sigue al tema del sitio (claro/oscuro) salvo que el ejemplo fije el suyo.
import { Chart, type ChartConfig } from 'xilaplot';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useData } from 'vitepress';

const props = defineProps<{
  cargar: () => ChartConfig | Promise<ChartConfig>;
  height?: number;
  label?: string;
}>();

const { isDark } = useData();
const host = ref<HTMLDivElement | null>(null);
const error = ref('');
const listo = ref(false);
let chart: Chart | null = null;
let ownTheme = false;

onMounted(async () => {
  try {
    const config = await props.cargar();
    if (!host.value) return;
    ownTheme = config.theme !== undefined;
    chart = new Chart(
      host.value,
      ownTheme ? config : { ...config, theme: isDark.value ? 'dark' : 'light' },
    );
    listo.value = true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
});

watch(isDark, (dark) => {
  if (chart && !ownTheme) chart.update({ theme: dark ? 'dark' : 'light' });
});

onBeforeUnmount(() => {
  chart?.destroy();
  chart = null;
});
</script>

<template>
  <figure class="x-demo" :aria-label="label ?? 'Ejemplo vivo'">
    <div class="x-demo__stage" :style="{ height: `${height ?? 320}px` }">
      <p v-if="error" class="x-demo__error" role="alert">{{ error }}</p>
      <p v-else-if="!listo" class="x-demo__loading">Cargando datos…</p>
      <div ref="host" class="x-demo__host"></div>
    </div>
  </figure>
</template>
