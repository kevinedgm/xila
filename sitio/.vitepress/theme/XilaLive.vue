<script setup lang="ts">
// Ficha interactiva: «el código es el control». El gráfico real del tipo sobre la tela, y a su lado la configuración
// como código donde cada valor enumerado es un botón que cicla (Mayús + clic o las flechas, hacia atrás) y cada
// booleano una casilla. «Copiar» omite lo que está por defecto. Tema de la vista (página, claro u oscuro) y ancho
// (libre o teléfono). Los controles salen de live/controles.ts y los valores por defecto de DEFAULTS de xilaplot.
import { Chart, DEFAULTS, themes, type ChartConfig, type ChartType } from 'xilaplot';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useData } from 'vitepress';
import { CONTROLES, PALETA, type Control } from '../../live/controles';

const props = defineProps<{ chart: ChartType }>();
const { isDark } = useData();
const ficha = CONTROLES[props.chart];
const grupo = ficha.grupo;

// Base del ejemplo: live/<tipo>.ts, cargado solo en el cliente.
const bases = import.meta.glob<{ default: () => ChartConfig | Promise<ChartConfig> }>([
  '../../live/*.ts',
  '!../../live/controles.ts',
]);

type Valor = string | number | boolean | null;
const defaults = (DEFAULTS as Record<string, Record<string, unknown>>)[grupo] ?? {};
const values = reactive<Record<string, Valor>>({});
for (const c of ficha.controles) values[c.key] = (defaults[c.key] as Valor) ?? c.values[0]!;

const host = ref<HTMLDivElement | null>(null);
const error = ref('');
const listo = ref(false);
const vista = ref<'pagina' | 'light' | 'dark'>('pagina');
const ancho = ref<'libre' | 'telefono'>('libre');
const copiado = ref(false);
let instancia: Chart | null = null;
let base: ChartConfig | null = null;

const temaVista = computed(() =>
  vista.value === 'pagina' ? (isDark.value ? 'dark' : 'light') : vista.value,
);
const tema = computed(() => themes[temaVista.value]);
const isDefault = (c: Control) => values[c.key] === defaults[c.key];
const fmt = (v: Valor) => (typeof v === 'string' ? `'${v}'` : String(v));

function grupoActual(): Record<string, Valor> {
  const out: Record<string, Valor> = {};
  const baseGrupo =
    (base as unknown as Record<string, Record<string, Valor> | undefined>)?.[grupo] ?? {};
  Object.assign(out, baseGrupo);
  for (const c of ficha.controles) out[c.key] = values[c.key]!;
  return out;
}
function redibujar() {
  if (!instancia) return;
  instancia.update({ [grupo]: grupoActual(), theme: temaVista.value } as Partial<ChartConfig>);
}

function cycle(c: Control, dir: 1 | -1) {
  const i = c.values.indexOf(values[c.key]!);
  const n = c.values.length;
  values[c.key] = c.values[(i + dir + n) % n]!;
}
function onClick(e: MouseEvent, c: Control) {
  cycle(c, e.shiftKey ? -1 : 1);
}
function onKey(e: KeyboardEvent, c: Control) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    cycle(c, 1);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    cycle(c, -1);
  }
}
function reset() {
  for (const c of ficha.controles) values[c.key] = (defaults[c.key] as Valor) ?? c.values[0]!;
}

/** El código a copiar: solo lo que no está por defecto. */
const codigo = computed(() => {
  const cambios = ficha.controles.filter((c) => !isDefault(c));
  const lineas = [`  type: '${props.chart}',`, '  data,', '  series,'];
  if (cambios.length) {
    lineas.push(`  ${grupo}: {`);
    for (const c of cambios) lineas.push(`    ${c.key}: ${fmt(values[c.key]!)},`);
    lineas.push('  },');
  }
  return `const chart = new Chart(el, {\n${lineas.join('\n')}\n});`;
});
async function copiar() {
  try {
    await navigator.clipboard.writeText(codigo.value);
    copiado.value = true;
    setTimeout(() => (copiado.value = false), 1500);
  } catch {
    /* sin portapapeles: el código sigue a la vista */
  }
}

watch([values, temaVista], redibujar, { deep: true });

onMounted(async () => {
  try {
    const mod = bases[`../../live/${props.chart}.ts`];
    if (!mod)
      throw new Error(`Sin base para la ficha «${props.chart}» (sitio/live/${props.chart}.ts)`);
    base = await (await mod()).default();
    if (!host.value) return;
    instancia = new Chart(host.value, {
      ...base,
      [grupo]: grupoActual(),
      theme: temaVista.value,
    } as ChartConfig);
    listo.value = true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
});
onBeforeUnmount(() => {
  instancia?.destroy();
  instancia = null;
});
</script>

<template>
  <section class="x-live" :aria-label="`Prueba en vivo: ${chart}`">
    <div class="x-live__bar">
      <p class="x-live__title">
        Prueba en vivo <code>type: '{{ chart }}'</code>
      </p>
      <div class="x-live__view" role="group" aria-label="Tema de la vista">
        <button
          type="button"
          class="x-chip"
          :aria-pressed="vista === 'pagina'"
          @click="vista = 'pagina'"
        >
          Página
        </button>
        <button
          type="button"
          class="x-chip"
          :aria-pressed="vista === 'light'"
          @click="vista = 'light'"
        >
          Claro
        </button>
        <button
          type="button"
          class="x-chip"
          :aria-pressed="vista === 'dark'"
          @click="vista = 'dark'"
        >
          Oscuro
        </button>
      </div>
      <div class="x-live__view" role="group" aria-label="Ancho de la vista">
        <button
          type="button"
          class="x-chip"
          :aria-pressed="ancho === 'libre'"
          @click="ancho = 'libre'"
        >
          Libre
        </button>
        <button
          type="button"
          class="x-chip"
          :aria-pressed="ancho === 'telefono'"
          @click="ancho = 'telefono'"
        >
          Teléfono
        </button>
      </div>
    </div>
    <div class="x-live__body">
      <div
        class="x-live__stage"
        :data-theme="temaVista"
        :class="{ 'is-phone': ancho === 'telefono' }"
      >
        <div class="x-live__frame">
          <p v-if="error" class="x-demo__error" role="alert">{{ error }}</p>
          <p v-else-if="!listo" class="x-demo__loading">Cargando datos…</p>
          <div ref="host" class="x-live__host"></div>
        </div>
      </div>
      <div class="x-live__code">
        <pre class="x-live__pre"><code>const chart = new Chart(el, {
  type: <span class="x-live__const">'{{ chart }}'</span>,
  data, series, <span class="x-live__comment">// los del ejemplo</span>
  {{ grupo }}: {
<template v-for="c in ficha.controles" :key="c.key">    <template v-if="c.kind === 'boolean'"><button type="button" class="x-live__bool" :aria-pressed="values[c.key] === true" :class="{ 'is-default': isDefault(c) }" @click="values[c.key] = !values[c.key]">[{{ values[c.key] ? 'x' : ' ' }}] {{ c.key }}</button></template><template v-else>{{ c.key }}: <button type="button" class="x-live__val" :class="{ 'is-default': isDefault(c) }" :aria-label="`${c.key}: ${fmt(values[c.key]!)}. Siguiente valor`" :title="`${c.values.map(fmt).join(' · ')} (Mayús + clic: anterior)`" @click="onClick($event, c)" @keydown="onKey($event, c)">{{ fmt(values[c.key]!) }}</button>,</template>
</template>  },
});</code></pre>
        <div class="x-live__actions">
          <button type="button" class="x-chip" @click="copiar">
            {{ copiado ? 'Copiado' : 'Copiar sin los valores por defecto' }}
          </button>
          <button type="button" class="x-chip" @click="reset">
            Volver a los valores por defecto
          </button>
        </div>
        <dl class="x-live__theme" aria-label="Qué lee del tema">
          <div class="x-live__theme-row">
            <dt>Paleta</dt>
            <dd>
              <span
                v-for="(c, i) in tema.palette"
                :key="c"
                class="x-live__swatch"
                :style="{ background: c }"
                :title="`${PALETA[i] ?? ''} ${c}`"
              ></span>
            </dd>
          </div>
          <div class="x-live__theme-row">
            <dt>Superficie</dt>
            <dd>
              <code>{{ tema.background }}</code>
            </dd>
          </div>
          <div class="x-live__theme-row">
            <dt>Tinta</dt>
            <dd>
              <code>{{ tema.text }}</code> · ejes <code>{{ tema.axis }}</code> · rejilla
              <code>{{ tema.grid }}</code>
            </dd>
          </div>
          <div class="x-live__theme-row">
            <dt>Letra</dt>
            <dd>
              Instrument Sans {{ tema.fontSize }} px · cifras JetBrains Mono · hallazgo Fraunces
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>
