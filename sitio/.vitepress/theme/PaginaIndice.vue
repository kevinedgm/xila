<script setup lang="ts">
// «En esta página»: la columna de la derecha (≥ 80rem) o, plegada, en la barra local. Las dos instancias reciben la
// misma sección activa del Layout. La activa lleva la puntada; la columna se sigue sola para tenerla a la vista.
import { nextTick, ref, watch } from 'vue';
import Icono from './Icono.vue';
import type { Section } from './marco';

const props = defineProps<{
  items: Section[];
  active: string | null;
  fold?: boolean;
  codes?: Record<string, string>;
}>();
const open = ref(false);
const root = ref<HTMLElement | null>(null);

function go(e: MouseEvent, s: Section) {
  const el = document.getElementById(s.id);
  if (!el) return;
  e.preventDefault();
  history.pushState(null, '', `#${s.id}`);
  el.scrollIntoView({ block: 'start' });
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
  open.value = false;
}
function top(e: MouseEvent) {
  e.preventDefault();
  window.scrollTo({ top: 0 });
  history.replaceState(null, '', location.pathname + location.search);
  const h1 = document.querySelector<HTMLElement>('main h1');
  if (h1) {
    if (!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1');
    h1.focus({ preventScroll: true });
  }
  open.value = false;
}
const label = (s: Section) => (props.codes?.[s.id] ? `${props.codes[s.id]} ${s.label}` : s.label);
const current = () => props.items.find((s) => s.id === props.active);

// La columna se sigue sola: la sección activa queda a la vista dentro de la lista (no mueve la página).
watch(
  () => props.active,
  async () => {
    if (props.fold) return;
    await nextTick();
    const el = root.value?.querySelector<HTMLElement>('.x-toc__link.is-active');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  },
);
function onFocusOut(e: FocusEvent) {
  if (!root.value?.contains(e.relatedTarget as Node | null)) open.value = false;
}
</script>

<template>
  <nav
    ref="root"
    class="x-toc"
    :class="{ 'x-toc--fold': fold, 'is-open': open }"
    aria-label="En esta página"
    @focusout="onFocusOut"
  >
    <button
      v-if="fold"
      class="x-toc__fold"
      type="button"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="x-toc__fold-label">En esta página</span>
      <span v-if="current()" class="x-toc__fold-current">· {{ current()!.label }}</span>
      <Icono name="chevron-down" />
    </button>
    <p v-else class="x-toc__title">En esta página</p>
    <div class="x-toc__panel">
      <ul class="x-toc__list">
        <li v-for="s in items" :key="s.id" :class="`x-toc__item--${s.level}`">
          <a
            class="x-toc__link"
            :class="{ 'is-active': s.id === active }"
            :href="`#${s.id}`"
            :aria-current="s.id === active ? 'true' : undefined"
            @click="go($event, s)"
          >
            <span class="x-stitch" aria-hidden="true"></span>
            <span class="x-toc__text">{{ label(s) }}</span>
          </a>
        </li>
      </ul>
      <a class="x-toc__top" href="#" @click="top"><Icono name="arrow-up" /> Volver arriba</a>
    </div>
  </nav>
</template>
