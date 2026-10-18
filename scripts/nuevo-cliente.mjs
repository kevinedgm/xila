// Copia la plantilla a clientes/<nombre> y la deja lista para `pnpm dev`.
// Uso: pnpm nuevo-cliente acme
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const nombre = process.argv[2];
if (!nombre || !/^[a-z0-9][a-z0-9-]*$/.test(nombre)) {
  console.error('Uso: pnpm nuevo-cliente <nombre>  (minúsculas, números y guiones)');
  process.exit(1);
}
const root = resolve(import.meta.dirname, '..');
const origen = resolve(root, 'plantilla');
const destino = resolve(root, 'clientes', nombre);
if (existsSync(destino)) {
  console.error(`Ya existe ${destino}`);
  process.exit(1);
}
mkdirSync(resolve(root, 'clientes'), { recursive: true });
cpSync(origen, destino, {
  recursive: true,
  filter: (src) => !/[\\/](node_modules|dist)([\\/]|$)/.test(src),
});

const pkgPath = resolve(destino, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.name = `cliente-${nombre}`;
pkg.description = `Dashboard de ${nombre}`;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

// La plantilla vive un nivel más arriba que clientes/<nombre>: ajustar el `extends`.
const tsPath = resolve(destino, 'tsconfig.json');
writeFileSync(
  tsPath,
  readFileSync(tsPath, 'utf8').replace('../tsconfig.base.json', '../../tsconfig.base.json'),
);

const cfgPath = resolve(destino, 'public', 'dashboard.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
cfg.titulo = `Dashboard de ${nombre}`;
writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);

// Registra el paquete en el workspace para que `workspace:*` resuelva a los paquetes locales.
execSync('pnpm install --silent', { cwd: root, stdio: 'inherit' });
console.log(`Listo: ${destino}\n  cd clientes/${nombre} && pnpm dev`);
