# xilaplot-vue

Componentes Vue 3 para **Xila**: `<XilaChart>` envuelve un gráfico de
[`xilaplot`](https://www.npmjs.com/package/xilaplot) con el ciclo de vida del componente, y
`<XilaDashboard>` arma un dashboard completo desde un `dashboard.json` y CSV.

```bash
npm install xilaplot xilaplot-vue
```

```vue
<script setup lang="ts">
import { XilaChart } from 'xilaplot-vue';
import { DataTable, numberColumn, tooltipPlugin } from 'xilaplot';

const config = {
  type: 'line' as const,
  data: new DataTable({ x: numberColumn([1, 2, 3]), y: numberColumn([4, 1, 3]) }),
  series: [{ id: 's', name: 'Serie', x: 'x', y: 'y' }],
  plugins: [tooltipPlugin()],
};
</script>

<template>
  <div style="height: 320px"><XilaChart :config="config" /></div>
</template>
```

Documentación: <https://kevinedgm.github.io/xila/>. Licencia MIT.
