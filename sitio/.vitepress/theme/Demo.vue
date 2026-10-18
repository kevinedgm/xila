<script setup lang="ts">
import { Chart, type ChartConfig } from '@xila/core';
import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * Ejemplo en vivo: recibe una función que devuelve la configuración (puede ser asíncrona, por
 * ejemplo si descarga un CSV) y monta un `Chart` en cuanto el componente está en el DOM.
 * Se usa una función y no un objeto para que Vue no envuelva los Float64Array en proxies.
 */
const props = defineProps<{
  cargar: () => ChartConfig | Promise<ChartConfig>;
  alto?: number;
}>();

const host = ref<HTMLDivElement | null>(null);
const error = ref('');
const listo = ref(false);
let chart: Chart | null = null;

onMounted(async () => {
  try {
    const config = await props.cargar();
    if (!host.value) return;
    chart = new Chart(host.value, config);
    listo.value = true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
});

onBeforeUnmount(() => {
  chart?.destroy();
  chart = null;
});
</script>

<template>
  <div class="demo" :style="{ height: `${alto ?? 320}px` }">
    <div v-if="error" class="demo-error">{{ error }}</div>
    <div v-else-if="!listo" class="demo-cargando">Cargando datos…</div>
    <div ref="host" class="demo-host"></div>
  </div>
</template>

<style scoped>
.demo {
  position: relative;
  margin: 16px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  overflow: hidden;
}
.demo-host {
  width: 100%;
  height: 100%;
}
.demo-cargando,
.demo-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.demo-error {
  color: var(--vp-c-danger-1);
  padding: 16px;
}
</style>
