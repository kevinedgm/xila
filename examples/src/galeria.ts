import 'xilaplot/fuentes/xila.css';
import logoClaro from '../../marca/xila.svg?url';
import logoOscuro from '../../marca/xila-oscuro.svg?url';
import {
  categoryColumn,
  Chart,
  chartToCsv,
  chartToPng,
  chartToSvg,
  DataTable,
  downloadFile,
  fetchCsv,
  filterRows,
  focusPlugin,
  legendPlugin,
  nowPlugin,
  numberColumn,
  pivot,
  referencePlugin,
  slugify,
  titlePlugin,
  tooltipPlugin,
  trendPlugin,
  type ChartConfig,
  type ChartPlugin,
  type Column,
  type SeriesSpec,
  type ThemeName,
} from 'xilaplot';

/**
 * Galería interactiva: una entrada por pregunta del lector, con la forma clásica y las
 * alternativas de Xila sobre los mismos datos. Las opciones serializables (tipo, ejes, opciones
 * del tipo) se editan como JSON en la página; datos, series y plugins los arma el código de cada
 * forma porque llevan funciones. Cada cambio destruye y vuelve a crear el gráfico: así lo que se
 * ve es exactamente lo que produce el código mostrado. `window.galeria` sirve a las pruebas.
 */

// ── Datos ────────────────────────────────────────────────────────────────────────────────────
const { table: co2 } = await fetchCsv('/co2/data/co2.csv');
const fechas = co2.numeric('fecha');
const PAISES = ['Estados Unidos', 'Alemania', 'España', 'China', 'México', 'Brasil', 'India'];
const t1 = (v: number): string => v.toFixed(1);

/** Tabla ancha fecha × país de t por persona desde el año dado. */
function anchoDesde(año: number): DataTable {
  const desde = filterRows(co2, (i) => (fechas[i] as number) >= Date.UTC(año, 0, 1));
  return pivot(desde, { index: 'fecha', columns: 'pais', values: 'co2_t_por_persona' });
}

/** Una fila por país en el año dado, ordenada de mayor a menor por persona. */
function paisesEn(año: number): DataTable {
  const del = filterRows(co2, (i) => (fechas[i] as number) === Date.UTC(año, 0, 1));
  const pais = del.column('pais');
  const nombres = pais.kind === 'category' ? pais.categories : [];
  const codigo = (i: number): number => (pais.kind === 'category' ? (pais.codes[i] as number) : 0);
  const pp = del.numeric('co2_t_por_persona');
  const mt = del.numeric('co2_mt');
  const pib = del.numeric('pib_per_capita');
  const orden = Array.from({ length: del.length }, (_, i) => i).sort(
    (a, b) => (pp[b] as number) - (pp[a] as number),
  );
  return new DataTable({
    pais: categoryColumn(orden.map((i) => nombres[codigo(i)] ?? '')),
    co2_t_por_persona: numberColumn(orden.map((i) => pp[i] as number)),
    co2_mt: numberColumn(orden.map((i) => mt[i] as number)),
    pib_per_capita: numberColumn(orden.map((i) => pib[i] as number)),
  });
}

/** Tabla ancha con un par de columnas `pib <país>` / `co2 <país>` por país, solo en ese año. */
function relacionEn(año: number): DataTable {
  const del = paisesEn(año);
  const pais = del.column('pais');
  const nombres = pais.kind === 'category' ? pais.categories : [];
  const columnas: Record<string, Column> = {};
  nombres.forEach((p, i) => {
    columnas[`pib ${p}`] = numberColumn([del.numeric('pib_per_capita')[i] as number]);
    columnas[`co2 ${p}`] = numberColumn([del.numeric('co2_t_por_persona')[i] as number]);
  });
  return new DataTable(columnas);
}

/** La tabla larga con una columna categórica `anio` ("1950", …) para usarla de eje X. */
function conAnio(desde: number): DataTable {
  const t = filterRows(co2, (i) => (fechas[i] as number) >= Date.UTC(desde, 0, 1));
  const columnas: Record<string, Column> = {};
  for (const n of t.names()) columnas[n] = t.column(n);
  columnas['anio'] = categoryColumn(
    Array.from(t.numeric('fecha'), (ms) => String(new Date(ms).getUTCFullYear())),
  );
  return new DataTable(columnas);
}

const seriesPorPais: SeriesSpec[] = PAISES.map((p) => ({ id: p, name: p, x: 'fecha', y: p }));
const CODIGO_SERIES_PAIS = "paises.map((p) => ({ id: p, name: p, x: 'fecha', y: p }))";

// ── Modelo de la galería ─────────────────────────────────────────────────────────────────────
type Params = Record<string, string>;
type Opciones = Record<string, unknown>;

interface Control {
  readonly id: string;
  readonly etiqueta: string;
  readonly valores: readonly string[];
  readonly inicial: string;
}

interface Forma {
  readonly id: string;
  readonly nombre: string;
  readonly clasica?: boolean;
  /** Qué responde esta forma, en una frase; admite `código` entre comillas invertidas. */
  readonly nota: string;
  /** Controles de la entrada que esta forma usa (los demás se ocultan). */
  readonly usa?: readonly string[];
  /** Alto del gráfico en px si la forma necesita más que los 420 de base. */
  readonly alto?: number;
  readonly datos: (p: Params) => { tabla: DataTable; codigo: string };
  readonly series: (p: Params) => { lista: SeriesSpec[]; codigo: string };
  /** La parte JSON de la configuración: lo que se edita en la página. */
  readonly opciones: (p: Params) => Opciones;
  readonly plugins: (p: Params) => { lista: ChartPlugin[]; codigo: string[] };
}

interface Entrada {
  readonly id: string;
  readonly tarea: string;
  readonly pregunta: string;
  readonly controles: readonly Control[];
  readonly formas: readonly Forma[];
}

const titulo = (title: string, subtitle: string): { p: ChartPlugin; c: string } => ({
  p: titlePlugin({ title, subtitle }),
  c: `titlePlugin({ title: ${JSON.stringify(title)}, subtitle: ${JSON.stringify(subtitle)} })`,
});

const DESDE: Control = {
  id: 'desde',
  etiqueta: 'Desde',
  valores: ['1950', '1970', '1990', '2005'],
  inicial: '1970',
};
const PAIS: Control = { id: 'pais', etiqueta: 'País', valores: PAISES, inicial: 'México' };
const AÑO: Control = {
  id: 'año',
  etiqueta: 'Año',
  valores: ['1990', '2000', '2010', '2022'],
  inicial: '2022',
};

const lineaPorPais = {
  datos: (p: Params) => ({
    tabla: anchoDesde(Number(p['desde'])),
    codigo: `pivot(desde${p['desde']}, { index: 'fecha', columns: 'pais', values: 'co2_t_por_persona' })`,
  }),
  series: () => ({ lista: seriesPorPais, codigo: CODIGO_SERIES_PAIS }),
};

const ENTRADAS: Entrada[] = [
  {
    id: 'hoy-y-de-donde-viene',
    tarea: 'Tendencia',
    pregunta: '¿Dónde está hoy cada país y de dónde viene?',
    controles: [DESDE, PAIS],
    formas: [
      {
        id: 'lineas',
        nombre: 'Líneas',
        clasica: true,
        nota: 'Siete líneas con leyenda: hay que cruzar colores con nombres para saber quién es quién.',
        usa: ['desde'],
        ...lineaPorPais,
        opciones: () => ({ type: 'line', axes: { y: { title: 't de CO₂ por persona' } } }),
        plugins: () => ({
          lista: [legendPlugin(), tooltipPlugin()],
          codigo: ['legendPlugin()', 'tooltipPlugin()'],
        }),
      },
      {
        id: 'ahora',
        nombre: 'Ahora con estela',
        alto: 620,
        nota: '`nowPlugin`: la cifra actual de cada país, su cambio y la estela de los últimos años, arriba del gráfico.',
        usa: ['desde'],
        ...lineaPorPais,
        opciones: () => ({ type: 'line', axes: { y: { title: 't de CO₂ por persona' } } }),
        plugins: () => ({
          lista: [
            tooltipPlugin(),
            nowPlugin({
              position: 'top',
              format: t1,
              lookback: 10,
              labels: { ago: 'en {n} años' },
            }),
          ],
          codigo: [
            'tooltipPlugin()',
            "nowPlugin({ position: 'top', format: (v) => v.toFixed(1), lookback: 10, labels: { ago: 'en {n} años' } })",
          ],
        }),
      },
      {
        id: 'protagonista',
        nombre: 'Protagonista y contexto',
        nota: '`focusPlugin`: un país en color y los demás en gris como contexto; los botones cambian de protagonista.',
        usa: ['desde', 'pais'],
        ...lineaPorPais,
        opciones: () => ({ type: 'line', axes: { y: { title: 't de CO₂ por persona' } } }),
        plugins: (p) => {
          const t = titulo(
            `${p['pais']} frente a los otros seis`,
            'Toneladas de CO₂ por persona y año',
          );
          return {
            lista: [t.p, tooltipPlugin(), focusPlugin({ series: p['pais'] as string, format: t1 })],
            codigo: [
              t.c,
              'tooltipPlugin()',
              `focusPlugin({ series: ${JSON.stringify(p['pais'])}, format: (v) => v.toFixed(1) })`,
            ],
          };
        },
      },
    ],
  },
  {
    id: 'cuanto-mas-que-el-promedio',
    tarea: 'Comparar',
    pregunta: '¿Cuánto más que el promedio, o que la meta, emite cada país?',
    controles: [
      AÑO,
      {
        id: 'ref',
        etiqueta: 'Referencia',
        valores: ['promedio', 'mediana', 'meta 2,3 t'],
        inicial: 'promedio',
      },
    ],
    formas: [
      {
        id: 'barras',
        nombre: 'Barras',
        clasica: true,
        nota: 'Barras desde cero: comparan bien magnitudes, pero la distancia a la referencia hay que calcularla de cabeza.',
        usa: ['año'],
        datos: (p) => ({ tabla: paisesEn(Number(p['año'])), codigo: `paisesEn(${p['año']})` }),
        series: () => ({
          lista: [{ id: 'pc', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
          codigo: "[{ id: 'pc', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }]",
        }),
        opciones: (p) => ({
          type: 'bar',
          axes: { y: { title: `t de CO₂ por persona, ${p['año']}` } },
        }),
        plugins: () => ({ lista: [tooltipPlugin()], codigo: ['tooltipPlugin()'] }),
      },
      {
        id: 'puntos',
        nombre: 'Puntos con referencia',
        nota: "`bar.mark: 'dot'` + `referencePlugin`: cada país es un punto y la línea de referencia dice cuánto se aleja.",
        usa: ['año', 'ref'],
        datos: (p) => ({ tabla: paisesEn(Number(p['año'])), codigo: `paisesEn(${p['año']})` }),
        series: () => ({
          lista: [{ id: 'pc', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
          codigo: "[{ id: 'pc', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }]",
        }),
        opciones: (p) => ({
          type: 'bar',
          bar: { mark: 'dot' },
          axes: { y: { title: `t de CO₂ por persona, ${p['año']}` } },
        }),
        plugins: (p) => {
          const ref = p['ref'];
          const value = ref === 'mediana' ? 'median' : ref === 'promedio' ? 'mean' : 2.3;
          const extra = typeof value === 'number' ? { label: 'meta 2,3 t' } : {};
          return {
            lista: [tooltipPlugin(), referencePlugin({ value, format: t1, ...extra })],
            codigo: [
              'tooltipPlugin()',
              `referencePlugin({ value: ${JSON.stringify(value)}, format: (v) => v.toFixed(1)${
                typeof value === 'number' ? ", label: 'meta 2,3 t'" : ''
              } })`,
            ],
          };
        },
      },
    ],
  },
  {
    id: 'hoy-frente-a-su-historia',
    tarea: 'Reparto',
    pregunta: '¿Dónde cae hoy cada país dentro de su propia historia?',
    controles: [],
    formas: [
      {
        id: 'caja',
        nombre: 'Box plot',
        clasica: true,
        nota: 'Mediana, cuartiles y bigotes de 75 años: resume el reparto, pero no dice dónde está el país hoy.',
        datos: () => ({ tabla: co2, codigo: 'co2' }),
        series: () => ({
          lista: [{ id: 'tpp', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
          codigo: "[{ id: 'tpp', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }]",
        }),
        opciones: () => ({
          type: 'box',
          axes: { y: { title: 't de CO₂ por persona, un valor por año' } },
        }),
        plugins: () => ({ lista: [tooltipPlugin()], codigo: ['tooltipPlugin()'] }),
      },
      {
        id: 'puntos-por-año',
        nombre: 'Un punto por año',
        nota: "`box.mark: 'dots'` + `shade` + `now`: cada año es un punto, más oscuro cuanto más reciente.",
        datos: () => ({ tabla: co2, codigo: 'co2' }),
        series: () => ({
          lista: [{ id: 'tpp', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
          codigo: "[{ id: 'tpp', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }]",
        }),
        opciones: () => ({
          type: 'box',
          box: { mark: 'dots', shade: 'fecha', now: 'last' },
          axes: { y: { title: 't de CO₂ por persona, un valor por año' } },
        }),
        plugins: () => ({ lista: [tooltipPlugin()], codigo: ['tooltipPlugin()'] }),
      },
      {
        id: 'hoy',
        nombre: 'Hoy frente a su historia',
        nota: "`box.mark: 'range'` + `now: 'last'`: bandas del percentil 10 al 90 y del 25 al 75, y el punto de 2024.",
        datos: () => ({ tabla: co2, codigo: 'co2' }),
        series: () => ({
          lista: [{ id: 'tpp', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
          codigo: "[{ id: 'tpp', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }]",
        }),
        opciones: () => ({
          type: 'box',
          box: { mark: 'range', now: 'last' },
          axes: { y: { title: 't de CO₂ por persona, un valor por año' } },
        }),
        plugins: () => {
          const t = titulo(
            'Alemania está hoy en lo más bajo de su historia; China e India, en su máximo',
            'Bandas del percentil 10 al 90 y del 25 al 75; el punto es 2024',
          );
          return { lista: [t.p, tooltipPlugin()], codigo: [t.c, 'tooltipPlugin()'] };
        },
      },
    ],
  },
  {
    id: 'quien-se-sale-del-patron',
    tarea: 'Relación',
    pregunta: '¿Quién emite más, o menos, de lo que su riqueza predice?',
    controles: [AÑO],
    formas: [
      {
        id: 'dispersion',
        nombre: 'Dispersión',
        clasica: true,
        nota: 'Un punto por país: se ve la relación, pero "más de lo esperado" queda a ojo.',
        usa: ['año'],
        datos: (p) => ({ tabla: relacionEn(Number(p['año'])), codigo: `relacionEn(${p['año']})` }),
        series: () => ({
          lista: PAISES.map((p) => ({ id: p, name: p, x: `pib ${p}`, y: `co2 ${p}` })),
          codigo: 'paises.map((p) => ({ id: p, name: p, x: `pib ${p}`, y: `co2 ${p}` }))',
        }),
        opciones: () => ({
          type: 'scatter',
          scatter: { radius: 5 },
          scales: { x: { type: 'log' } },
          axes: { x: { title: 'PIB por persona, $ (log)' }, y: { title: 't de CO₂ por persona' } },
        }),
        plugins: () => ({
          lista: [legendPlugin(), tooltipPlugin()],
          codigo: ['legendPlugin()', 'tooltipPlugin()'],
        }),
      },
      {
        id: 'contra-lo-esperado',
        nombre: 'Contra lo esperado',
        nota: '`trendPlugin`: la tendencia entre los siete, un tallo de cada país a la línea y el ranking de quién se aleja más.',
        usa: ['año'],
        datos: (p) => ({ tabla: relacionEn(Number(p['año'])), codigo: `relacionEn(${p['año']})` }),
        series: () => ({
          lista: PAISES.map((p) => ({ id: p, name: p, x: `pib ${p}`, y: `co2 ${p}` })),
          codigo: 'paises.map((p) => ({ id: p, name: p, x: `pib ${p}`, y: `co2 ${p}` }))',
        }),
        opciones: () => ({
          type: 'scatter',
          scatter: { radius: 5 },
          scales: { x: { type: 'log' } },
          axes: { x: { title: 'PIB por persona, $ (log)' }, y: { title: 't de CO₂ por persona' } },
        }),
        plugins: () => ({
          lista: [
            tooltipPlugin(),
            trendPlugin({ label: 'tendencia de estos siete', format: (v) => `${v.toFixed(1)} t` }),
          ],
          codigo: [
            'tooltipPlugin()',
            "trendPlugin({ label: 'tendencia de estos siete', format: (v) => `${v.toFixed(1)} t` })",
          ],
        }),
      },
    ],
  },
  {
    id: 'cuando-cambio-cada-uno',
    tarea: 'Matriz',
    pregunta: '¿Cuándo cambió cada país?',
    controles: [DESDE],
    formas: [
      {
        id: 'calor',
        nombre: 'Mapa de calor',
        clasica: true,
        nota: 'Una escala para todos: Estados Unidos satura el color y los cambios de India o Brasil no se ven.',
        usa: ['desde'],
        datos: (p) => ({
          tabla: conAnio(Number(p['desde'])),
          codigo: `conAnio(desde${p['desde']})`,
        }),
        series: () => ({
          lista: [
            { id: 'tpp', name: 't por persona', x: 'anio', y: 'pais', value: 'co2_t_por_persona' },
          ],
          codigo:
            "[{ id: 'tpp', name: 't por persona', x: 'anio', y: 'pais', value: 'co2_t_por_persona' }]",
        }),
        opciones: () => ({ type: 'heatmap' }),
        plugins: () => ({ lista: [tooltipPlugin()], codigo: ['tooltipPlugin()'] }),
      },
      {
        id: 'cada-fila',
        nombre: 'Cada fila contra sí misma',
        nota: "`heatmap.scale: 'row'` + `rowLabels: 'max'`: cada país contra su propia mediana, azul por debajo, naranja por encima.",
        usa: ['desde'],
        datos: (p) => ({
          tabla: conAnio(Number(p['desde'])),
          codigo: `conAnio(desde${p['desde']})`,
        }),
        series: () => ({
          lista: [
            { id: 'tpp', name: 't por persona', x: 'anio', y: 'pais', value: 'co2_t_por_persona' },
          ],
          codigo:
            "[{ id: 'tpp', name: 't por persona', x: 'anio', y: 'pais', value: 'co2_t_por_persona' }]",
        }),
        opciones: () => ({ type: 'heatmap', heatmap: { scale: 'row', rowLabels: 'max' } }),
        plugins: () => ({ lista: [tooltipPlugin()], codigo: ['tooltipPlugin()'] }),
      },
    ],
  },
];

// ── Página ───────────────────────────────────────────────────────────────────────────────────
let tema: ThemeName = 'light';
const vivas: Array<() => void> = [];
const graficos: Record<string, Chart> = {};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text) e.textContent = text;
  return e;
}

/** `texto con \`código\`` → nodos con <code>. */
function conCodigo(destino: HTMLElement, texto: string): void {
  texto.split(/(`[^`]+`)/).forEach((parte) => {
    if (parte.startsWith('`')) destino.append(el('code', {}, parte.slice(1, -1)));
    else if (parte) destino.append(parte);
  });
}

/** Código TypeScript completo de la forma con las opciones actuales. */
function codigoCompleto(forma: Forma, p: Params, opciones: Opciones): string {
  const cuerpo = JSON.stringify(opciones, null, 2)
    .split('\n')
    .slice(1, -1)
    .map((l) => l.replace(/^(\s*)"([A-Za-z_$][\w$]*)":/, '$1$2:'))
    .join('\n');
  const plugins = forma.plugins(p).codigo;
  const nombres = new Set(['Chart', ...plugins.map((c) => c.slice(0, c.indexOf('(')))]);
  return [
    `import { ${[...nombres].join(', ')} } from 'xilaplot';`,
    '',
    'new Chart(contenedor, {',
    `  data: ${forma.datos(p).codigo},`,
    `  series: ${forma.series(p).codigo},`,
    `${cuerpo},`,
    '  plugins: [',
    ...plugins.map((c) => `    ${c},`),
    '  ],',
    '});',
  ].join('\n');
}

function montarEntrada(entrada: Entrada, destino: HTMLElement): void {
  const sec = el('section', { class: 'entrada', id: entrada.id, 'data-tarea': entrada.tarea });
  sec.append(el('p', { class: 'tarea' }, entrada.tarea), el('h2', {}, entrada.pregunta));

  const barra = el('div', { class: 'barra' });
  const formas = el('div', { class: 'formas', role: 'group', 'aria-label': 'Forma' });
  barra.append(formas);
  const params: Params = Object.fromEntries(entrada.controles.map((c) => [c.id, c.inicial]));
  const etiquetas: Record<string, HTMLElement> = {};
  for (const c of entrada.controles) {
    const label = el('label', { class: 'control' }, c.etiqueta);
    const select = el('select', { 'data-control': c.id });
    for (const v of c.valores) select.append(el('option', { value: v }, v));
    select.value = c.inicial;
    select.addEventListener('change', () => {
      params[c.id] = select.value;
      dibujar(true);
    });
    label.append(select);
    etiquetas[c.id] = label;
    barra.append(label);
  }
  const nota = el('p', { class: 'nota' });

  const cuerpo = el('div', { class: 'cuerpo' });
  const izq = el('div');
  const caja = el('div', { class: 'chart' });
  const acciones = el('div', { class: 'acciones' });
  izq.append(caja, acciones);

  const panel = el('div', { class: 'panel' });
  const cab = el('div', { class: 'titulo-panel' });
  const restablecer = el('button', { type: 'button' }, 'Restablecer');
  cab.append(el('span', {}, 'Opciones · JSON editable'), restablecer);
  const editor = el('textarea', {
    spellcheck: 'false',
    'aria-label': 'Opciones del gráfico en JSON',
  });
  const error = el('p', { class: 'error', role: 'status' });
  const detalles = el('details');
  const summary = el('summary', {}, 'Código completo');
  const pre = el('pre');
  const copiar = el('button', { type: 'button', class: 'chip' }, 'Copiar código');
  detalles.append(summary, pre, copiar);
  panel.append(cab, editor, error, detalles);
  cuerpo.append(izq, panel);
  sec.append(barra, nota, cuerpo);
  destino.append(sec);

  let forma = entrada.formas.find((f) => !f.clasica) ?? (entrada.formas[0] as Forma);
  let chart: Chart | null = null;
  let opciones: Opciones = {};

  const botones = entrada.formas.map((f) => {
    const b = el(
      'button',
      { type: 'button', ...(f.clasica ? { class: 'clasica' } : {}) },
      f.nombre,
    );
    if (f.clasica) b.title = 'Forma clásica';
    b.addEventListener('click', () => {
      forma = f;
      dibujar(true);
    });
    formas.append(b);
    return { f, b };
  });

  function crear(): void {
    chart?.destroy();
    caja.style.height = `${forma.alto ?? 420}px`;
    const config = {
      ...opciones,
      lazy: false,
      theme: tema,
      data: forma.datos(params).tabla,
      series: forma.series(params).lista,
      plugins: forma.plugins(params).lista,
    } as unknown as ChartConfig;
    chart = new Chart(caja, config);
    graficos[entrada.id] = chart;
    pre.textContent = codigoCompleto(forma, params, opciones);
  }

  /** `reiniciar` vuelve las opciones JSON a las de la forma (se pierde lo editado a mano). */
  function dibujar(reiniciar: boolean): void {
    for (const { f, b } of botones) b.setAttribute('aria-pressed', String(f === forma));
    for (const [id, label] of Object.entries(etiquetas)) {
      label.hidden = forma.usa !== undefined && !forma.usa.includes(id);
    }
    nota.replaceChildren();
    conCodigo(nota, forma.nota);
    if (reiniciar) {
      opciones = forma.opciones(params);
      editor.value = JSON.stringify(opciones, null, 2);
      editor.removeAttribute('aria-invalid');
      error.textContent = '';
    }
    try {
      crear();
    } catch (e) {
      error.textContent = `No se pudo dibujar: ${(e as Error).message}`;
    }
  }

  let espera = 0;
  editor.addEventListener('input', () => {
    clearTimeout(espera);
    espera = window.setTimeout(() => {
      try {
        const nuevo = JSON.parse(editor.value) as unknown;
        if (typeof nuevo !== 'object' || nuevo === null || Array.isArray(nuevo)) {
          throw new Error('las opciones deben ser un objeto { … }');
        }
        opciones = nuevo as Opciones;
        editor.removeAttribute('aria-invalid');
        error.textContent = '';
        crear();
      } catch (e) {
        editor.setAttribute('aria-invalid', 'true');
        error.textContent = (e as Error).message;
      }
    }, 350);
  });
  restablecer.addEventListener('click', () => dibujar(true));
  copiar.addEventListener('click', () => {
    void navigator.clipboard?.writeText(pre.textContent ?? '');
    copiar.textContent = 'Copiado';
    setTimeout(() => (copiar.textContent = 'Copiar código'), 1200);
  });

  const nombreArchivo = (): string => slugify(`${entrada.pregunta} ${forma.nombre}`);
  const exportar: Array<[string, (c: Chart) => Promise<void>]> = [
    ['PNG', async (c) => downloadFile(`${nombreArchivo()}.png`, await chartToPng(c))],
    [
      'SVG',
      async (c) =>
        downloadFile(
          `${nombreArchivo()}.svg`,
          await chartToSvg(c, { title: entrada.pregunta }),
          'image/svg+xml',
        ),
    ],
    ['CSV', async (c) => downloadFile(`${nombreArchivo()}.csv`, chartToCsv(c), 'text/csv')],
  ];
  for (const [nombre, fn] of exportar) {
    const b = el('button', { type: 'button' }, nombre);
    b.addEventListener('click', () => {
      if (chart) void fn(chart);
    });
    acciones.append(b);
  }

  vivas.push(() => dibujar(false));
  dibujar(true);
}

// Filtro por tarea.
const nav = document.getElementById('tareas') as HTMLElement;
const tareas = ['Todas', ...new Set(ENTRADAS.map((e) => e.tarea))];
const chips = tareas.map((t) => {
  const b = el(
    'button',
    { type: 'button', class: 'chip', 'aria-pressed': String(t === 'Todas') },
    t,
  );
  b.addEventListener('click', () => {
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    document.querySelectorAll<HTMLElement>('.entrada').forEach((s) => {
      s.hidden = t !== 'Todas' && s.dataset.tarea !== t;
    });
  });
  nav.append(b);
  return b;
});

// Tema claro / oscuro: la página cambia sus variables y cada gráfico se vuelve a crear.
const logo = document.getElementById('logo') as HTMLImageElement;
const botonTema = document.getElementById('tema') as HTMLButtonElement;
function aplicarTema(t: ThemeName): void {
  tema = t;
  document.documentElement.dataset.tema = t;
  logo.src = t === 'dark' ? logoOscuro : logoClaro;
  botonTema.setAttribute('aria-pressed', String(t === 'dark'));
  botonTema.textContent = t === 'dark' ? 'Tema claro' : 'Tema oscuro';
  vivas.forEach((f) => f());
}
botonTema.addEventListener('click', () => aplicarTema(tema === 'dark' ? 'light' : 'dark'));
logo.src = logoClaro;

const main = document.getElementById('entradas') as HTMLElement;
for (const e of ENTRADAS) montarEntrada(e, main);

(window as unknown as { galeria: Record<string, Chart> }).galeria = graficos;
