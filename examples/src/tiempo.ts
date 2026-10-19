import {
  Chart,
  RhythmStrip,
  TrailPanel,
  fetchCsv,
  focusPlugin,
  narratePlugin,
  pivot,
  tooltipPlugin,
} from 'xilaplot';

/**
 * Las dos propuestas elegidas para "cambio en el tiempo": Ahora con estela (TrailPanel) y
 * Protagonista y contexto (focusPlugin), sobre los datos de CO₂ del dashboard de ejemplo.
 * `window.panel` y `window.grafico` quedan para las pruebas.
 */
const PAISES = ['Estados Unidos', 'Alemania', 'España', 'China', 'México', 'Brasil', 'India'];
const year = (ms: number): string => String(new Date(ms).getUTCFullYear());
const t = (v: number): string =>
  v.toLocaleString('es-MX', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

const { table } = await fetchCsv('/co2/data/co2.csv');
const wide = pivot(table, { index: 'fecha', columns: 'pais', values: 'co2_t_por_persona' });

// Ahora con estela
const panel = new TrailPanel(document.getElementById('ahora') as HTMLElement, {
  data: wide,
  x: 'fecha',
  series: PAISES.map((p) => ({ id: p, name: p, y: p })),
  format: t,
  formatX: year,
  compareSteps: 10,
  compareLabel: (s) => `en ${s} años`,
  unit: 't por persona',
  theme: 'xila',
});
const range = document.getElementById('anio') as HTMLInputElement;
const label = document.getElementById('anio-label') as HTMLOutputElement;
const play = document.getElementById('play') as HTMLButtonElement;
range.max = String(panel.length - 1);
const sync = (): void => {
  range.value = String(panel.getIndex());
  label.textContent = year(panel.getX());
  play.textContent = panel.isPlaying() ? 'Pausa' : 'Reproducir';
};
panel.onChange(sync);
sync();
range.addEventListener('input', () => {
  panel.stop();
  panel.setIndex(+range.value);
});
play.addEventListener('click', () => {
  if (panel.isPlaying()) panel.stop();
  else panel.play();
  sync();
});

// Protagonista y contexto
const focus = focusPlugin({ series: 'México', format: t });
const grafico = new Chart(document.getElementById('protagonista') as HTMLElement, {
  type: 'line',
  theme: 'xila',
  data: wide,
  series: PAISES.map((p) => ({ id: p, name: p, x: 'fecha', y: p })),
  line: { width: 2 },
  axes: { y: { title: 't CO₂ por persona' } },
  plugins: [focus, tooltipPlugin()],
});
const box = document.getElementById('paises') as HTMLElement;
for (const p of PAISES) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = p;
  b.setAttribute('aria-pressed', String(p === focus.getFocus()));
  b.addEventListener('click', () => {
    focus.setFocus(p);
    box.querySelectorAll('button').forEach((q) => q.setAttribute('aria-pressed', String(q === b)));
  });
  box.append(b);
}

// Tira de ritmo
const ritmo = new RhythmStrip(document.getElementById('ritmo') as HTMLElement, {
  data: wide,
  x: 'fecha',
  series: PAISES.map((p) => ({ id: p, name: p, y: p })),
  window: 3,
  cap: 0.06,
  formatX: year,
  stepLabel: 'al año',
  theme: 'xila',
});
(document.getElementById('ritmo-leyenda') as HTMLElement).textContent =
  'Primer color de la paleta: baja · gris: sin cambio · segundo color: sube (saturado en ±6 % al año). Pasa el cursor para ver cada año.';

// Línea narrada
const narra = narratePlugin({ series: 'Alemania', drops: 3, format: t, formatX: year });
const narrada = new Chart(document.getElementById('narrada') as HTMLElement, {
  type: 'line',
  theme: 'xila',
  data: wide,
  series: [{ id: 'Alemania', name: 'Alemania', x: 'fecha', y: 'Alemania' }],
  line: { width: 2.5 },
  axes: { y: { title: 't CO₂ por persona' } },
  plugins: [narra, tooltipPlugin()],
});
narrada.events.on('draw', () => {
  const ms = narra.getMoments();
  const max = ms.find((m) => m.kind === 'max');
  const v = wide.numeric('Alemania');
  const last = v[v.length - 1] as number;
  if (max) {
    const peak = v[max.index] as number;
    (document.getElementById('narrada-titulo') as HTMLElement).textContent =
      `Alemania emite hoy ${Math.round((1 - last / peak) * 100)} % menos por persona que en su máximo`;
  }
  // Las mismas notas, como lista: el resumen accesible de lo que dice la gráfica.
  const ul = document.getElementById('narrada-momentos') as HTMLElement;
  ul.replaceChildren(
    ...ms.map((m) => Object.assign(document.createElement('li'), { textContent: m.text })),
  );
});

Object.assign(window, { panel, grafico, focus, ritmo, narra });
