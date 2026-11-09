<script setup lang="ts">
// Índice izquierdo: grupos de páginas con filtro (`/`) y número estable al final de la fila en galería y decisiones.
// La página actual lleva la puntada en cobalto: en la greca de la marca, la última puntada en color es el último valor.
import { computed, ref } from 'vue';
import { withBase } from 'vitepress';
import Icono from './Icono.vue';
import { filterGroups, plainClick, type IndexGroup, type IndexItem } from './marco';

const props = defineProps<{ groups: IndexGroup[]; current: string; apple: boolean }>();
const emit = defineEmits<{ navigate: [href: string] }>();

const query = ref('');
const input = ref<HTMLInputElement | null>(null);
const visible = computed(() => filterGroups(props.groups, query.value));
const count = computed(() => visible.value.reduce((n, g) => n + g.items.length, 0));
const total = computed(() => props.groups.reduce((n, g) => n + g.items.length, 0));
const href = (it: IndexItem) => withBase(it.href);
const isCurrent = (it: IndexItem) => it.id === props.current;

function onClick(e: MouseEvent, it: IndexItem) {
  if (it.external || !plainClick(e)) return;
  e.preventDefault();
  emit('navigate', href(it));
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && query.value) {
    e.preventDefault();
    query.value = '';
  }
}
defineExpose({
  focusFilter: () => input.value?.focus(),
});
</script>

<template>
  <nav class="x-index" aria-label="Índice de la documentación">
    <div class="x-index__filter">
      <Icono name="search" />
      <input
        ref="input"
        v-model="query"
        class="x-index__input"
        type="search"
        placeholder="Filtrar"
        aria-label="Filtrar el índice"
        aria-keyshortcuts="/"
        autocomplete="off"
        @keydown="onKey"
      />
      <kbd v-if="!query" class="x-kbd" aria-hidden="true">/</kbd>
      <span class="x-sr" aria-live="polite">{{ query ? `${count} de ${total} páginas` : '' }}</span>
    </div>
    <p v-if="query && !count" class="x-index__none">Nada coincide con «{{ query }}».</p>
    <div v-for="g in visible" :key="g.id" class="x-index__group">
      <p class="x-index__title">{{ g.label }}</p>
      <ul class="x-index__list">
        <li v-for="it in g.items" :key="it.id">
          <a
            class="x-index__link"
            :class="{ 'is-current': isCurrent(it) }"
            :href="it.external ? it.href : href(it)"
            :target="it.external === 'self' ? '_self' : undefined"
            :aria-current="isCurrent(it) ? 'page' : undefined"
            @click="onClick($event, it)"
          >
            <span class="x-stitch" aria-hidden="true"></span>
            <span class="x-index__label">{{ it.label }}</span>
            <code v-if="it.code" class="x-index__code" aria-label="">{{ it.code }}</code>
          </a>
        </li>
      </ul>
    </div>
  </nav>
</template>
