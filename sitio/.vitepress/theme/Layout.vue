<script setup lang="ts">
// Marco del sitio de documentación de Xila: banda superior (marca, secciones, búsqueda, tema), índice izquierdo con
// filtro y números, barra local (< 80rem: «Menú» + «En esta página» plegada), documento y columna «En esta página».
// Hecho con la API pública de VitePress (Content, useData, useRoute, useRouter, onContentUpdated, withBase) y el
// índice de la búsqueda local. La portada (layout: home) es Portada.vue con los datos del README.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  Content,
  inBrowser,
  onContentUpdated,
  useData,
  useRoute,
  useRouter,
  withBase,
} from 'vitepress';
import siteData from '../../src/.site-data.json';
import wordmark from '@marca/xila.svg?raw';
import Icono from './Icono.vue';
import Indice from './Indice.vue';
import PaginaIndice from './PaginaIndice.vue';
import Busqueda from './Busqueda.vue';
import Portada from './Portada.vue';
import {
  navCurrent,
  pageSections,
  plainClick,
  routeId,
  type IndexGroup,
  type NavItem,
  type Section,
} from './marco';

const { page, frontmatter, site, isDark } = useData();
const route = useRoute();
const router = useRouter();

const nav = siteData.nav as NavItem[];
const groups = siteData.sidebar as IndexGroup[];

// ---------- Página ----------
const base = computed(() => site.value.base);
const currentId = computed(() => routeId(route.path, base.value));
const isHome = computed(() => frontmatter.value['layout'] === 'home');
const navId = computed(() => navCurrent(nav, currentId.value));
const sections = ref<Section[]>([]);
const codes = ref<Record<string, string>>({});
const active = ref<string | null>(null);
const nb = (n: { text: string; link: string } | undefined) =>
  n ? { text: n.text, href: withBase(n.link) } : null;
const prev = computed(() => nb(frontmatter.value['prev']));
const next = computed(() => nb(frontmatter.value['next']));

// ---------- Estado del marco (cliente) ----------
const mounted = ref(false);
const wide = ref(true); // ≥ 60rem: el índice es una columna; por debajo, un cajón
const drawer = ref<HTMLDialogElement | null>(null);
const menu = ref(false);
const indice = ref<InstanceType<typeof Indice> | null>(null);
const search = ref<InstanceType<typeof Busqueda> | null>(null);
const apple = ref(false);
const homeHref = computed(() => withBase('/'));

// Tema: dos estados. `isDark` de VitePress persiste la preferencia (clave `vitepress-theme-appearance`);
// aquí solo se refleja en `data-theme`, que leen los tokens del sitio y de los gráficos.
const dark = computed(() => mounted.value && isDark.value);
function toggleTheme() {
  isDark.value = !isDark.value;
}
if (inBrowser) {
  watch(isDark, (d) => document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'), {
    immediate: true,
  });
}

function go(href: string) {
  menu.value = false;
  closeDrawer();
  router.go(href);
}
function onNav(e: MouseEvent, it: NavItem) {
  if (it.external || !plainClick(e)) return;
  e.preventDefault();
  go(withBase(it.href));
}
function openDrawer() {
  drawer.value?.showModal();
}
function closeDrawer() {
  if (drawer.value?.open) drawer.value.close();
}
function onDrawerClick(e: MouseEvent) {
  if (e.target === drawer.value) closeDrawer();
}
function openSearch() {
  menu.value = false;
  search.value?.open();
}
async function focusFilter() {
  if (!wide.value) {
    openDrawer();
    await nextTick();
  }
  indice.value?.focusFilter();
}

// ---------- Teclado: ⌘K/Ctrl+K a la búsqueda (también desde un campo) y `/` al filtro (en la portada, a la búsqueda) ----------
function onKey(e: KeyboardEvent) {
  if (e.defaultPrevented || e.isComposing) return;
  if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
    e.preventDefault();
    openSearch();
    return;
  }
  const t = e.target as HTMLElement | null;
  const editable = t?.closest?.(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
  );
  if (e.key === '/' && !editable && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    if (isHome.value) openSearch();
    else void focusFilter();
  }
}

// ---------- Secciones y la activa (una sola medición para las dos instancias de «En esta página») ----------
let headings: { id: string; el: HTMLElement }[] = [];
function collect() {
  sections.value = isHome.value || page.value.isNotFound ? [] : pageSections(page.value.headers);
  const found: Record<string, string> = {};
  headings = sections.value
    .map((s) => ({ id: s.id, el: document.getElementById(s.id) as HTMLElement | null }))
    .filter((h): h is { id: string; el: HTMLElement } => !!h.el);
  for (const h of headings) {
    const n = h.el.getAttribute('data-n');
    if (n) found[h.id] = n;
  }
  codes.value = found;
  syncActive();
}
function syncActive() {
  if (!headings.length) {
    active.value = null;
    return;
  }
  const line = 64 + 48 + 24; // banda + barra local + margen
  let current: string | null = null;
  for (const h of headings) {
    if (h.el.getBoundingClientRect().top <= line) current = h.id;
    else break;
  }
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2)
    current = headings[headings.length - 1]!.id;
  active.value = current;
}

// ---------- Portada «arriba del todo»: data-top en <html> mientras scrollY === 0 ----------
function syncTop() {
  document.documentElement.toggleAttribute('data-top', isHome.value && window.scrollY === 0);
}
function onScroll() {
  syncTop();
  syncActive();
}

// ---------- Foco al cambiar de ruta: al h1 tras el contenido nuevo; no en la primera carga ni con #ancla ----------
let pendingFocus = false;
watch(
  () => route.path,
  () => {
    pendingFocus = true;
    menu.value = false;
    closeDrawer();
    nextTick(syncTop);
  },
);
onContentUpdated(() => {
  collect();
  if (!pendingFocus) return;
  pendingFocus = false;
  nextTick(() => {
    const hash = decodeURIComponent(location.hash.slice(1));
    const target =
      (hash && document.getElementById(hash)) || document.querySelector<HTMLElement>('main h1');
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
});

let mq: MediaQueryList | null = null;
const onMq = () => {
  wide.value = !!mq?.matches;
  if (wide.value) closeDrawer();
};
onMounted(() => {
  mounted.value = true;
  apple.value = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
  mq = matchMedia('(min-width: 60rem)');
  onMq();
  mq.addEventListener('change', onMq);
  document.addEventListener('keydown', onKey);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', syncActive, { passive: true });
  syncTop();
  collect();
});
onBeforeUnmount(() => {
  mq?.removeEventListener('change', onMq);
  document.removeEventListener('keydown', onKey);
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', syncActive);
});
</script>

<template>
  <div class="x-shell" :class="{ 'is-home': isHome, 'is-menu': menu }">
    <a class="x-skip" href="#contenido">Saltar al contenido</a>

    <header class="x-band">
      <a
        class="x-brand"
        :href="homeHref"
        aria-label="Xila, inicio"
        @click="plainClick($event) && ($event.preventDefault(), go(homeHref))"
      >
        <span class="x-brand__mark" aria-hidden="true" v-html="wordmark"></span>
      </a>
      <nav class="x-nav" aria-label="Secciones">
        <ul class="x-nav__list">
          <li v-for="it in nav" :key="it.id">
            <a
              class="x-nav__link"
              :class="{ 'is-current': it.id === navId }"
              :href="it.external ? it.href : withBase(it.href)"
              :aria-current="it.id === navId ? 'page' : undefined"
              :rel="it.external ? 'noopener' : undefined"
              @click="onNav($event, it)"
            >
              {{ it.label }}<Icono v-if="it.external" name="arrow-up-right" />
            </a>
          </li>
        </ul>
      </nav>
      <div class="x-band__tools">
        <button
          class="x-search-btn"
          type="button"
          aria-label="Buscar en la documentación"
          aria-haspopup="dialog"
          aria-keyshortcuts="Control+K Meta+K"
          @click="openSearch"
        >
          <Icono name="search" />
          <span class="x-search-btn__text">Buscar</span>
          <span class="x-search-btn__keys" aria-hidden="true"
            ><kbd class="x-kbd">{{ apple ? '⌘' : 'Ctrl' }}</kbd
            ><kbd class="x-kbd">K</kbd></span
          >
        </button>
        <button
          class="x-theme"
          type="button"
          :aria-label="dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
          :aria-pressed="dark"
          @click="toggleTheme"
        >
          <Icono :name="dark ? 'moon' : 'sun'" />
        </button>
        <button
          class="x-burger"
          type="button"
          aria-label="Menú de secciones"
          :aria-expanded="menu"
          aria-controls="x-menu"
          @click="menu = !menu"
        >
          <Icono :name="menu ? 'x' : 'menu'" />
        </button>
      </div>
    </header>

    <!-- Pantalla de menú (< 48rem): las secciones y el tema -->
    <div v-show="menu" id="x-menu" class="x-menu">
      <ul class="x-menu__list">
        <li v-for="it in nav" :key="it.id">
          <a
            class="x-menu__link"
            :href="it.external ? it.href : withBase(it.href)"
            :aria-current="it.id === navId ? 'page' : undefined"
            @click="onNav($event, it)"
            >{{ it.label }}</a
          >
        </li>
      </ul>
      <div class="x-menu__row">
        <span>Apariencia</span>
        <button
          class="x-theme"
          type="button"
          :aria-label="dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
          :aria-pressed="dark"
          @click="toggleTheme"
        >
          <Icono :name="dark ? 'moon' : 'sun'" />
        </button>
      </div>
    </div>

    <div class="x-body">
      <aside v-if="!isHome && wide" class="x-side">
        <Indice ref="indice" :groups="groups" :current="currentId" :apple="apple" @navigate="go" />
      </aside>
      <dialog
        v-if="!isHome"
        ref="drawer"
        class="x-drawer"
        aria-label="Índice de la documentación"
        @click="onDrawerClick"
      >
        <div class="x-drawer__panel">
          <button
            class="x-drawer__close"
            type="button"
            aria-label="Cerrar el índice"
            @click="closeDrawer"
          >
            <Icono name="x" />
          </button>
          <Indice
            v-if="!wide"
            ref="indice"
            :groups="groups"
            :current="currentId"
            :apple="apple"
            @navigate="go"
          />
        </div>
      </dialog>

      <main id="contenido" class="x-main" tabindex="-1">
        <template v-if="isHome">
          <Portada :data="frontmatter['home']">
            <template #muestra><Content class="vp-doc x-home__body" /></template>
          </Portada>
        </template>
        <template v-else>
          <div class="x-local">
            <button
              v-if="!wide"
              class="x-local__menu"
              type="button"
              aria-haspopup="dialog"
              @click="openDrawer"
            >
              <Icono name="align-left" /> Menú
            </button>
            <PaginaIndice
              v-if="sections.length"
              class="x-local__toc"
              :items="sections"
              :active="active"
              :codes="codes"
              fold
            />
          </div>
          <div class="x-doc">
            <article class="x-content">
              <Content class="vp-doc" />
              <nav v-if="prev || next" class="x-pager" aria-label="Páginas vecinas">
                <a
                  v-if="prev"
                  class="x-pager__card"
                  :href="prev.href"
                  @click="plainClick($event) && ($event.preventDefault(), go(prev!.href))"
                >
                  <span class="x-pager__label">Anterior</span
                  ><span class="x-pager__title">{{ prev.text }}</span>
                </a>
                <a
                  v-if="next"
                  class="x-pager__card is-next"
                  :href="next.href"
                  @click="plainClick($event) && ($event.preventDefault(), go(next!.href))"
                >
                  <span class="x-pager__label">Siguiente</span
                  ><span class="x-pager__title">{{ next.text }}</span>
                </a>
              </nav>
            </article>
            <aside v-if="sections.length" class="x-aside">
              <PaginaIndice :items="sections" :active="active" :codes="codes" />
            </aside>
          </div>
        </template>
      </main>
    </div>

    <footer v-if="isHome" class="x-footer">
      <p>Xila · Licencia MIT · <a href="https://github.com/kevinedgm/xila">Código en GitHub</a></p>
    </footer>

    <Busqueda ref="search" :apple="apple" />
  </div>
</template>
