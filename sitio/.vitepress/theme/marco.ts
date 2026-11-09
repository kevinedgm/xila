// Funciones puras del marco: ruta actual sin `base`, enlace actual de la barra, secciones de la página y opciones
// de la búsqueda. Sin `window` ni `location`: sirven igual en el servidor.

export interface NavItem {
  id: string;
  label: string;
  href: string;
  match?: string;
  external?: boolean;
}
export interface IndexItem {
  id: string;
  label: string;
  href: string;
  code?: string;
  keywords?: string[];
  external?: string;
}
export interface IndexGroup {
  id: string;
  label: string;
  items: IndexItem[];
}
export interface Section {
  id: string;
  label: string;
  level: number;
}
export interface SearchHit {
  id: string;
  title: string;
  titles: string[];
  score?: number;
}
export interface SearchOption {
  href: string;
  label: string;
  path: string;
}

/** Ruta de VitePress (`/xila/guia/tipos.html`) → ruta del sitio sin `base` (`/guia/tipos`). */
export function routeId(path: string, base = '/'): string {
  let p = decodeURI(String(path).split('#')[0]!.split('?')[0]!);
  if (base !== '/' && p.startsWith(base)) p = p.slice(base.length);
  p = p
    .replace(/^\/+/, '')
    .replace(/\.html$/, '')
    .replace(/(^|\/)index$/, '$1');
  return '/' + p;
}

/** El enlace de la barra que contiene la ruta actual, por su expresión `match`. */
export function navCurrent(items: NavItem[], id: string): string | null {
  for (const it of items) if (it.match && new RegExp(it.match).test(id)) return it.id;
  return null;
}

/** `page.headers` de VitePress (anidados, niveles 2 y 3) → secciones planas. */
export function pageSections(
  headers: ReadonlyArray<{
    level: number;
    slug: string;
    title: string;
    children?: readonly unknown[];
  }>,
): Section[] {
  const out: Section[] = [];
  const walk = (
    list: ReadonlyArray<{
      level: number;
      slug: string;
      title: string;
      children?: readonly unknown[];
    }>,
  ) => {
    for (const h of list) {
      if ((h.level === 2 || h.level === 3) && h.slug)
        out.push({ id: h.slug, label: h.title, level: h.level });
      if (h.children?.length) walk(h.children as typeof list);
    }
  };
  walk(headers);
  return out;
}

/** Filtra los grupos del índice por el texto: etiqueta, palabras clave y número. Vacío → todo. */
export function filterGroups(groups: IndexGroup[], query: string): IndexGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const nq = norm(q);
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) =>
        [it.label, it.code ?? '', ...(it.keywords ?? [])].some((t) => norm(t).includes(nq)),
      ),
    }))
    .filter((g) => g.items.length);
}

/** Resultados de MiniSearch → opciones: la sección, su ruta de títulos («Página › Sección») y el destino. */
export function searchOptions(results: SearchHit[], limit = 20): SearchOption[] {
  const out: SearchOption[] = [];
  for (const r of results) {
    if (out.length >= limit) break;
    const titles = (r.titles || []).filter(Boolean);
    out.push({
      href: String(r.id),
      label: String(r.title || titles[titles.length - 1] || ''),
      path: titles.join(' › '),
    });
  }
  return out;
}

/** Un clic «normal» (botón principal, sin modificadores): el router puede llevarlo. */
export function plainClick(e: MouseEvent): boolean {
  return e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;
}
