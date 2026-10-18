---
layout: home
hero:
  name: Xila
  text: Gráficos para dashboards y datos científicos
  tagline: TypeScript, Canvas por capas, WebGL para millones de puntos y un sistema de plugins. Pensada para leer CSV largos salidos de pandas.
  actions:
    - theme: brand
      text: Primer gráfico en 5 minutos
      link: /guia/primer-grafico
    - theme: alt
      text: Galería
      link: /galeria/
    - theme: alt
      text: GitHub
      link: https://github.com/kevinedgm/xila
features:
  - title: Columnas tipadas, no objetos por fila
    details: Una DataTable guarda cada columna en un Float64Array o en códigos de categoría. Un millón de puntos pesa 15 MB en vez de 46 y se recorre sin crear basura.
  - title: Canvas decimado y WebGL cuando hace falta
    details: Las líneas se decimán por mín y máx por píxel y se dibujan en milisegundos. Las dispersiones grandes suben a la GPU y el pan no vuelve a tocar los datos.
  - title: Plugins con hooks en orden fijo
    details: Tooltip, leyenda, zoom y pan, anotaciones, accesibilidad y sincronización son plugins. Escribir uno propio son veinte líneas.
  - title: Del notebook al dashboard sin código
    details: exportar_xila(df) escribe el CSV, dashboard.json declara filtros y paneles, y pnpm build deja un sitio estático que se protege en el servidor.
---

::: warning Estado
Xila es experimental y su API cambia sin aviso. "Xila" es un nombre provisional y el paquete
aún no está publicado en npm: por ahora se usa desde el monorepo. La galería corre con el
código actual del repositorio.
:::
