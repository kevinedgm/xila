/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

// Índice de la búsqueda local de VitePress: por idioma, una función que carga el JSON de MiniSearch.
declare module '@localSearchIndex' {
  const index: Record<string, () => Promise<{ default: string }>>;
  export default index;
}
