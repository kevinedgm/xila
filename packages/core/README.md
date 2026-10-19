# xilaplot

Motor de gráficos de **Xila**: librería en TypeScript para dashboards y datos científicos.
Columnas tipadas (`Float64Array`), Canvas 2D decimado, WebGL para millones de puntos y un
sistema de plugins (tooltip, leyenda, zoom y pan, anotaciones, accesibilidad, sincronización).

```bash
npm install xilaplot
```

```ts
import { Chart, fetchCsv, groupBy, tooltipPlugin, zoomPanPlugin } from 'xilaplot';

const { table } = await fetchCsv('/data/ventas.csv');
// Varias filas por fecha (región y canal): una línea necesita un valor por x.
const porDia = groupBy(table, 'fecha', { agg: 'sum', column: 'monto' });
new Chart(document.getElementById('grafico')!, {
  type: 'line',
  data: porDia,
  series: [{ id: 'v', name: 'Ventas', x: 'fecha', y: 'monto' }],
  plugins: [tooltipPlugin(), zoomPanPlugin()],
});
```

Documentación, galería y referencia de la API: <https://kevinedgm.github.io/xila/>.
Componente para Vue 3: [`xilaplot-vue`](https://www.npmjs.com/package/xilaplot-vue).

Estado: experimental, la API puede cambiar entre versiones 0.x. Licencia MIT.
