import 'xilaplot/fuentes/xila.css';
import {
  accessibilityPlugin,
  Chart,
  fetchCsv,
  formatNumber,
  statusGroups,
  statusLayout,
  titlePlugin,
  tooltipPlugin,
  type BoxChartConfig,
  type DataTable,
  type StatusLayout,
} from 'xilaplot';

/**
 * Ranura de estado: los cuatro casos validados en el brief, con la misma anatomía y distinta
 * configuración (referencia, estado, margen). Los títulos dicen el hallazgo y salen de los
 * datos, con el mismo cálculo que usa el gráfico. `window.graficos` sirve a las pruebas.
 */

const plugins = (title: string, subtitle: string) => [
  titlePlugin({ title, subtitle }),
  tooltipPlugin(),
  accessibilityPlugin(),
];

/** Filas de la ranura calculadas fuera del gráfico, para redactar el título con el hallazgo. */
function filas(
  table: DataTable,
  x: string,
  y: string,
  box: NonNullable<BoxChartConfig['box']>,
  extra: { low?: string; high?: string; period?: string } = {},
): StatusLayout {
  const col = table.column(x);
  const names = col.kind === 'category' ? col.categories : [];
  const codes = col.kind === 'category' ? col.codes : new Uint32Array(0);
  const periodColumn = extra.period ? table.column(extra.period) : null;
  const groups = statusGroups(codes, table.numeric(y), names, {
    low: extra.low ? table.numeric(extra.low) : undefined,
    high: extra.high ? table.numeric(extra.high) : undefined,
    periods: periodColumn && periodColumn.kind !== 'category' ? periodColumn.values : undefined,
  });
  return statusLayout(groups, {
    reference: box.reference ?? 'history',
    status: box.status ?? 'auto',
    threshold: box.statusThreshold ?? 0.05,
    window: box.statusWindow ?? 5,
    range: box.range ?? [0.1, 0.9],
    sort: box.sort ?? 'status',
    maxRows: box.maxRows ?? 12,
  });
}

const cuenta = (layout: StatusLayout, estado: string): number =>
  layout.rows.filter((r) => r.status === estado).length;

const el = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

// A · Canciones: rango típico propio, evidencia con σ y n, 2026 parcial.
const canciones = (await fetchCsv('/ranura/canciones.csv')).table;
const boxCanciones = {
  mark: 'range',
  orientation: 'horizontal',
  range: [0.125, 0.875],
  now: 'last',
  period: 'anio',
  count: 'n',
  partial: 2026,
} satisfies BoxChartConfig['box'];
const lCanciones = filas(canciones, 'genero', 'segundos', boxCanciones, {
  low: 'low',
  high: 'high',
  period: 'anio',
});
const claros = lCanciones.rows.filter((r) => r.status === 'clear').map((r) => r.name);
const a = new Chart(el('canciones'), {
  type: 'box',
  data: canciones,
  series: [
    { id: 'g', name: 'duración media', x: 'genero', y: 'segundos', yLow: 'low', yHigh: 'high' },
  ],
  box: boxCanciones,
  axes: { y: { format: (v) => `${formatNumber(v, { decimals: 0 })} s` } },
  plugins: plugins(
    `${claros.join(' y ')} se acortaron con claridad en 2026; ${cuenta(lCanciones, 'possible')} género${cuenta(lCanciones, 'possible') === 1 ? '' : 's'} en duda`,
    'Duración media por género; banda = su rango típico desde 2018; margen del 95 % con n canciones; 2026 hasta junio (parcial)',
  ),
});

// B · CO₂ total: pico propio = 100 %, dirección contra 5 años atrás.
const co2 = (await fetchCsv('/co2/data/co2.csv')).table;
const boxTotal = {
  mark: 'range',
  orientation: 'horizontal',
  reference: 'peak',
  status: 'direction',
  statusThreshold: 0.05,
  statusWindow: 5,
  period: 'fecha',
} satisfies BoxChartConfig['box'];
const lTotal = filas(co2, 'pais', 'co2_mt', boxTotal, { period: 'fecha' });
const enPico = lTotal.rows.filter((r) => r.value >= 99.5).map((r) => r.name);
const b = new Chart(el('total'), {
  type: 'box',
  data: co2,
  series: [{ id: 'mt', name: 'CO₂', x: 'pais', y: 'co2_mt' }],
  box: boxTotal,
  axes: { y: { format: (v) => `${formatNumber(v, { decimals: 0 })} Mt` } },
  plugins: plugins(
    `${cuenta(lTotal, 'down')} de ${lTotal.rows.length} países bajan desde 2019; ${enPico.join(' e ')} ${enPico.length === 1 ? 'sigue' : 'siguen'} en su pico`,
    'Emisiones de 2024 como % del máximo de cada país desde 1950; flecha de 2019 a 2024; estable = cambio menor al 5 %',
  ),
});

// C · CO₂ por persona: China como línea común, arriba o abajo y desde cuándo.
const boxPersona = {
  mark: 'range',
  orientation: 'horizontal',
  reference: { group: 'China' },
  status: 'side',
  period: 'fecha',
  highlight: 'México',
} satisfies BoxChartConfig['box'];
const lPersona = filas(co2, 'pais', 'co2_t_por_persona', boxPersona, { period: 'fecha' });
const mx = lPersona.rows.find((r) => r.name === 'México');
const desde = mx ? new Date(mx.crossing).getUTCFullYear() : '';
const c = new Chart(el('persona'), {
  type: 'box',
  data: co2,
  series: [{ id: 'tpp', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
  box: boxPersona,
  axes: { y: { format: (v) => `${formatNumber(v, { decimals: 1 })} t` } },
  plugins: plugins(
    `México emite menos CO₂ por persona que China desde ${desde}; ${cuenta(lPersona, 'above')} de ${lPersona.rows.length} países ${cuenta(lPersona, 'above') === 1 ? 'sigue' : 'siguen'} arriba`,
    'Toneladas por persona en 2024; línea punteada = China en 2024; puntos tenues = 1950–2023',
  ),
});

// D · Panadería: periodo anterior como 0 %, bootstrap, "no concluyente" si el margen cruza 0.
const panaderia = (await fetchCsv('/ranura/panaderia.csv')).table;
const boxPanaderia = {
  mark: 'range',
  orientation: 'horizontal',
  reference: 'previous',
  status: 'evidence',
  statusLabels: { possible: 'no concluyente' },
  sort: 'input',
  highlight: 'Total',
  period: 'anio',
} satisfies BoxChartConfig['box'];
const lPanaderia = filas(panaderia, 'tienda', 'ganancia', boxPanaderia, {
  low: 'low',
  high: 'high',
  period: 'anio',
});
const total = lPanaderia.rows.find((r) => r.name === 'Total');
const dudosas = lPanaderia.rows.filter((r) => r.status === 'possible').map((r) => r.name);
const d = new Chart(el('panaderia'), {
  type: 'box',
  data: panaderia,
  series: [{ id: 'g', name: 'ganancia', x: 'tienda', y: 'ganancia', yLow: 'low', yHigh: 'high' }],
  box: boxPanaderia,
  axes: { y: { format: (v) => `$${formatNumber(v, { decimals: 0 })}` } },
  plugins: plugins(
    `La ganancia subió ${formatNumber(total?.value ?? 0, { decimals: 1 })} % en 2024; ${dudosas.length > 0 ? `${dudosas.join(' y ')} no es concluyente` : 'las tres tiendas con claridad'}`,
    'Cambio de 2024 frente a 2023 por tienda; margen = bootstrap de los pedidos de 2024 (95 %)',
  ),
});

// Descomposición de la causa: pedidos frente a ganancia por pedido, del total.
const tiendas = panaderia.column('tienda');
const anios = panaderia.numeric('anio');
const pedidos = panaderia.numeric('pedidos');
const porPedido = panaderia.numeric('por_pedido');
const fila = (anio: number): number => {
  for (let i = 0; i < panaderia.length; i++) {
    if (
      tiendas.kind === 'category' &&
      tiendas.categories[tiendas.codes[i] as number] === 'Total' &&
      anios[i] === anio
    )
      return i;
  }
  return -1;
};
const [i23, i24] = [fila(2023), fila(2024)];
if (i23 >= 0 && i24 >= 0) {
  const cambio = (v: Float64Array): string => {
    const p = ((v[i24] as number) / (v[i23] as number) - 1) * 100;
    return `${p > 0 ? '+' : ''}${formatNumber(p, { decimals: 1 })} %`;
  };
  el('causa').textContent +=
    ` Causa del total: pedidos ${cambio(pedidos)}, ganancia por pedido ${cambio(porPedido)}.`;
}

// Complemento para metas acumulativas: la ventaja acumulada mes a mes responde "¿vamos a cumplir?".
const meses = (await fetchCsv('/ranura/panaderia-meses.csv')).table;
const ventaja = meses.numeric('ventaja');
const ultima = ventaja[ventaja.length - 1] as number;
const e = new Chart(el('ventaja'), {
  type: 'line',
  data: meses,
  series: [{ id: 'v', name: 'ventaja acumulada', x: 'mes', y: 'ventaja' }],
  line: { curve: 'monotone' },
  scales: { y: { domain: [0, Math.ceil((ventaja[0] as number) / 5) * 5] } },
  axes: { y: { format: (v) => `${formatNumber(v, { decimals: 0 })} %` } },
  plugins: [
    titlePlugin({
      title: `La ventaja sobre 2023 fue de +${formatNumber(ventaja[0] as number, { decimals: 0 })} % en enero y cerró en +${formatNumber(ultima, { decimals: 0 })} %`,
      subtitle: 'Ganancia acumulada de 2024 frente a la de 2023 hasta ese mes',
    }),
    tooltipPlugin(),
    accessibilityPlugin(),
  ],
});

(window as unknown as { graficos: Chart[] }).graficos = [a, b, c, d, e];
