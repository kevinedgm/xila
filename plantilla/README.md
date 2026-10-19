# Plantilla de dashboard estático

Lo que se copia para cada cliente. Tres cosas cambian por cliente y ninguna es código:

```
public/
  dashboard.json   ← título, tablas, filtros y paneles (ver docs/configuracion-dashboard.md)
  data/*.csv       ← los CSV que exporta el notebook (ver docs/contrato-csv.md)
  logo.svg         ← icono de la pestaña
```

## Crear un cliente

```bash
pnpm nuevo-cliente acme        # copia esta plantilla a clientes/acme
cd clientes/acme
pnpm dev                       # http://localhost:5173 (u otro puerto si está ocupado) con recarga al editar el JSON o los CSV
pnpm build                     # genera dist/ lista para subir
```

`clientes/` está en `.gitignore`: los datos de un cliente no van en el repo de Xila. Si
quieres versionarlos, crea un repo privado dentro de `clientes/acme`.

## Qué hay en `dist/`

```
dist/
  index.html
  app/index-*.js      ← Xila + Vue, un solo archivo
  dashboard.json
  data/*.csv
  logo.svg
```

Las rutas son relativas (`base: './'` en `vite.config.ts`), así que la carpeta funciona en
`https://cliente.com/` o en `https://cliente.com/reportes/` sin reconstruir. Para
actualizar datos basta reemplazar un CSV en `dist/data/`; no hace falta volver a construir.

Cómo subirla y protegerla con contraseña: `docs/despliegue.md`.
