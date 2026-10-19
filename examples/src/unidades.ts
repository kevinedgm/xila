import {
  Chart,
  DataTable,
  accessibilityPlugin,
  brushPlugin,
  numberColumn,
  type BrushPayload,
} from 'xilaplot';
import { mulberry32 } from './bench/synthetic';

/**
 * Propuesta A de Kiwi ("Casos como unidades") sobre xilaplot: gráfico `units` + plugin brush.
 * `?n=` cambia la cantidad de casos (con 50 000 o más dibuja en WebGL); `?escala=log` usa eje
 * logarítmico; `?renderer=canvas|webgl` fuerza el backend; `?n=0` muestra el estado vacío. `window.grafico` queda para las pruebas.
 */
const params = new URLSearchParams(location.search);
const n = Math.max(0, Number(params.get('n') ?? 1240));
const log = params.get('escala') === 'log';
const renderer = (params.get('renderer') ?? 'auto') as 'auto' | 'canvas' | 'webgl';

// Tiempos con forma lognormal y un 3 % de casos atípicos largos (como en el F2).
const rand = mulberry32(42);
const minutos = new Float64Array(n);
for (let i = 0; i < n; i++) {
  const u1 = Math.max(rand(), 1e-9);
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rand());
  let v = Math.exp(2.6 + 0.45 * z);
  if (rand() < 0.03) v += 40 + rand() * 60;
  minutos[i] = Math.round(v * 10) / 10;
}

const fmt = (v: number): string => v.toLocaleString('es-MX', { maximumFractionDigits: 1 });
const fmtInt = (v: number): string => v.toLocaleString('es-MX');

const read = document.getElementById('read') as HTMLElement;
const sub = document.getElementById('sub') as HTMLElement;
sub.textContent = `Minutos · ${fmtInt(n)} casos · cada punto es un caso`;
const host = document.getElementById('grafica') as HTMLElement;

const describe = (p: Omit<BrushPayload, 'text'>): string =>
  p.range
    ? `${fmtInt(p.count)} casos (${(p.share * 100).toFixed(1)} %) entre ${fmt(p.range[0])} y ${fmt(p.range[1])} min`
    : `${fmtInt(p.total)} casos en total. Arrastra sobre la gráfica para contar un rango.`;

/** La lectura visible: el conteo en negritas, el resto como texto. */
function showReadout(p: Omit<BrushPayload, 'text'>): void {
  const b = document.createElement('b');
  if (p.range) {
    b.textContent = `${fmtInt(p.count)} casos`;
    read.replaceChildren(
      b,
      ` (${(p.share * 100).toFixed(1)} %) entre ${fmt(p.range[0])} y ${fmt(p.range[1])} min`,
    );
  } else {
    b.textContent = fmtInt(p.total);
    read.replaceChildren('Arrastra sobre la gráfica para contar un rango. ', b, ' casos en total.');
  }
}

if (n === 0) {
  // K-06: estado vacío, sin control de rango.
  read.textContent = '';
  const empty = document.createElement('p');
  empty.className = 'empty';
  empty.textContent = 'Sin casos para mostrar.';
  host.replaceWith(empty);
  for (const id of ['m-loose', 'm-stacked']) {
    (document.getElementById(id) as HTMLButtonElement).disabled = true;
  }
} else {
  const brush = brushPlugin({
    label: 'Rango de minutos a contar',
    describe,
  });
  const grafico = new Chart(host, {
    type: 'units',
    theme: 'xila',
    renderer,
    data: new DataTable({ minutos: numberColumn(minutos) }),
    series: [{ id: 'casos', name: 'Casos', x: 'minutos', y: 'minutos' }],
    scales: { x: { type: log ? 'log' : 'linear' } },
    axes: { x: { title: 'Minutos de atención', format: fmt }, y: { title: 'Casos' } },
    units: { mode: 'loose' },
    plugins: [accessibilityPlugin({ keyboard: false, locale: 'es-MX' }), brush],
  });
  grafico.events.on('brush', showReadout);
  // K-04: si la columna más alta no cabe, cada punto vale varios casos y el subtítulo lo dice.
  grafico.events.on('draw', () => {
    const k = grafico.getUnitsPerMark();
    sub.textContent = `Minutos · ${fmtInt(n)} casos · ${k === 1 ? 'cada punto es un caso' : `cada punto = ${fmtInt(k)} casos`}`;
  });
  showReadout({ range: null, count: n, total: n, share: 1 });

  const setMode = (mode: 'loose' | 'stacked'): void => {
    (document.getElementById('m-loose') as HTMLElement).setAttribute(
      'aria-pressed',
      String(mode === 'loose'),
    );
    (document.getElementById('m-stacked') as HTMLElement).setAttribute(
      'aria-pressed',
      String(mode === 'stacked'),
    );
    grafico.update({ units: { mode } });
  };
  (document.getElementById('m-loose') as HTMLElement).onclick = () => setMode('loose');
  (document.getElementById('m-stacked') as HTMLElement).onclick = () => setMode('stacked');

  Object.assign(window, { grafico, brush });
}
