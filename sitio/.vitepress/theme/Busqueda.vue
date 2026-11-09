<script setup lang="ts">
// Búsqueda modal de texto completo: el índice local de VitePress (`@localSearchIndex`, cargado con la primera
// búsqueda) y MiniSearch con las opciones del cuadro de VitePress (prefijo y difusa). Se abre con «Buscar» y ⌘K/Ctrl+K.
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vitepress';
import type MiniSearch from 'minisearch';
import Icono from './Icono.vue';
import { searchOptions, type SearchHit, type SearchOption } from './marco';

const MINISEARCH_OPTIONS = {
  fields: ['title', 'titles', 'text'],
  storeFields: ['title', 'titles'],
  searchOptions: { fuzzy: 0.2, prefix: true, boost: { title: 4, text: 2, titles: 1 } },
};

const props = defineProps<{ apple: boolean }>();
const router = useRouter();
const dialog = ref<HTMLDialogElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const query = ref('');
const loading = ref(false);
const options = shallowRef<SearchOption[]>([]);
const active = ref(0);
const opener = ref<HTMLElement | null>(null);
let engine: Promise<MiniSearch<SearchHit> | null> | null = null;
let seq = 0;

function load() {
  engine ??= Promise.all([import('@localSearchIndex'), import('minisearch')])
    .then(async ([idx, ms]) => {
      const loader = idx.default['root'];
      if (typeof loader !== 'function') return null;
      const json = (await loader()).default;
      return ms.default.loadJSON<SearchHit>(json, MINISEARCH_OPTIONS);
    })
    .catch(() => null);
  return engine;
}

watch(query, async (q) => {
  const my = ++seq;
  const text = q.trim();
  if (!text) {
    options.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  const ms = await load();
  if (my !== seq) return;
  loading.value = false;
  options.value = ms ? searchOptions(ms.search(text) as unknown as SearchHit[]) : [];
  active.value = 0;
});

const status = computed(() => {
  if (!query.value.trim()) return 'Escribe para buscar en toda la documentación.';
  if (loading.value) return 'Cargando el índice…';
  return options.value.length ? `${options.value.length} resultados` : 'Sin resultados.';
});

async function open() {
  opener.value = document.activeElement as HTMLElement | null;
  void load();
  dialog.value?.showModal();
  await nextTick();
  input.value?.focus();
  input.value?.select();
}
function close() {
  dialog.value?.close();
}
function onClose() {
  opener.value?.focus?.();
}
function choose(o: SearchOption, e?: MouseEvent | KeyboardEvent) {
  if (e && (e.ctrlKey || e.metaKey)) {
    window.open(o.href, '_blank', 'noopener');
    return;
  }
  close();
  router.go(o.href);
}
function onKey(e: KeyboardEvent) {
  const n = options.value.length;
  if (e.key === 'ArrowDown' && n) {
    e.preventDefault();
    active.value = (active.value + 1) % n;
  } else if (e.key === 'ArrowUp' && n) {
    e.preventDefault();
    active.value = (active.value - 1 + n) % n;
  } else if (e.key === 'Enter' && n) {
    e.preventDefault();
    choose(options.value[active.value]!, e);
  }
}
function onBackdrop(e: MouseEvent) {
  if (e.target === dialog.value) close();
}
defineExpose({ open });
</script>

<template>
  <dialog
    ref="dialog"
    class="x-search"
    aria-label="Buscar en la documentación"
    @close="onClose"
    @click="onBackdrop"
  >
    <form class="x-search__box" role="search" @submit.prevent>
      <div class="x-search__field">
        <Icono name="search" />
        <input
          ref="input"
          v-model="query"
          class="x-search__input"
          type="search"
          placeholder="Buscar en la documentación"
          aria-label="Buscar en la documentación"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="x-search-list"
          :aria-expanded="options.length > 0"
          :aria-activedescendant="options.length ? `x-search-opt-${active}` : undefined"
          autocomplete="off"
          @keydown="onKey"
        />
        <button class="x-search__close" type="button" aria-label="Cerrar" @click="close">
          <Icono name="x" />
        </button>
      </div>
      <p class="x-search__status" aria-live="polite">{{ status }}</p>
      <ul id="x-search-list" class="x-search__list" role="listbox" aria-label="Resultados">
        <li
          v-for="(o, i) in options"
          :id="`x-search-opt-${i}`"
          :key="o.href"
          class="x-search__opt"
          :class="{ 'is-active': i === active }"
          role="option"
          :aria-selected="i === active"
          @mousemove="active = i"
          @click="choose(o, $event)"
        >
          <span class="x-stitch" aria-hidden="true"></span>
          <span class="x-search__opt-text">
            <span class="x-search__opt-title">{{ o.label }}</span>
            <span v-if="o.path" class="x-search__opt-path">{{ o.path }}</span>
          </span>
        </li>
      </ul>
      <p class="x-search__hints" aria-hidden="true">
        <span
          ><kbd class="x-kbd"><Icono name="arrow-up" /></kbd
          ><kbd class="x-kbd"><Icono name="chevron-down" /></kbd> para moverte</span
        >
        <span
          ><kbd class="x-kbd"><Icono name="corner-down-left" /></kbd> para elegir</span
        >
        <span><kbd class="x-kbd">esc</kbd> para cerrar</span>
      </p>
    </form>
  </dialog>
</template>
