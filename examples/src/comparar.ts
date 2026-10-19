import {
  categoryColumn,
  Chart,
  DataTable,
  fetchCsv,
  filterRows,
  numberColumn,
  referencePlugin,
  titlePlugin,
  tooltipPlugin,
} from 'xilaplot';

/**
 * Las dos formas elegidas en la ronda r01 de "Más allá de la barra": A (puntos con referencia:
 * `bar.mark: 'dot'` + `referencePlugin`) y D (unidades del total: `type: 'waffle'`).
 * `window.graficos` sirve a las pruebas.
 */
const { table } = await fetchCsv('/co2/data/co2.csv');
const fechas = table.numeric('fecha');
const solo2024 = filterRows(table, (i) => (fechas[i] as number) === Date.UTC(2024, 0, 1));
// Ordenado de mayor a menor por persona: en barras el orden de las filas es el de las categorías,
// así que la tabla se arma de nuevo con ese orden.
const pais = solo2024.column('pais');
const nombres = pais.kind === 'category' ? pais.categories : [];
const porPersona = solo2024.numeric('co2_t_por_persona');
const totales = solo2024.numeric('co2_mt');
const orden = Array.from({ length: solo2024.length }, (_, i) => i).sort(
  (a, b) => (porPersona[b] as number) - (porPersona[a] as number),
);
const en2024 = new DataTable({
  pais: categoryColumn(
    orden.map((i) => nombres[(pais.kind === 'category' ? pais.codes[i] : 0) as number] ?? ''),
  ),
  co2_t_por_persona: numberColumn(orden.map((i) => porPersona[i] as number)),
  co2_mt: numberColumn(orden.map((i) => totales[i] as number)),
});

const puntos = new Chart(document.getElementById('puntos') as HTMLElement, {
  type: 'bar',
  data: en2024,
  series: [{ id: 'pc', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
  bar: { mark: 'dot' },
  axes: { y: { title: 't de CO₂ por persona, 2024' } },
  plugins: [
    titlePlugin({
      title: 'Estados Unidos emite dos veces el promedio; India, una tercera parte',
      subtitle: 'Toneladas de CO₂ por persona en 2024',
    }),
    tooltipPlugin(),
    referencePlugin({ value: 'mean', format: (v) => v.toFixed(1) }),
  ],
});

document.querySelectorAll<HTMLButtonElement>('[data-ref]').forEach((b) => {
  b.addEventListener('click', () => {
    const raw = b.dataset.ref ?? 'mean';
    const value = raw === 'mean' || raw === 'median' ? raw : Number(raw);
    document
      .querySelectorAll('[data-ref]')
      .forEach((q) => q.setAttribute('aria-pressed', String(q === b)));
    puntos.update({
      plugins: [
        titlePlugin({
          title: 'Estados Unidos emite dos veces el promedio; India, una tercera parte',
          subtitle: 'Toneladas de CO₂ por persona en 2024',
        }),
        tooltipPlugin(),
        referencePlugin({
          value,
          format: (v) => v.toFixed(1),
          ...(typeof value === 'number' ? { label: `meta ${value.toFixed(1)}` } : {}),
        }),
      ],
    });
  });
});

const total = new Chart(document.getElementById('total') as HTMLElement, {
  type: 'waffle',
  data: en2024,
  series: [{ id: 'mt', name: 'Mt de CO₂', x: 'pais', y: 'co2_mt' }],
  waffle: { unit: 100 },
  plugins: [
    titlePlugin({
      title: 'China emite más de la mitad del total de los siete',
      subtitle: 'Millones de toneladas de CO₂ en 2024; cada cuadro, 100 Mt',
    }),
    tooltipPlugin(),
  ],
});

(window as unknown as { graficos: Chart[] }).graficos = [puntos, total];
