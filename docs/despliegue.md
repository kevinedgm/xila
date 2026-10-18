# Despliegue y protección con contraseña

Qué se entrega: la carpeta `dist/` que genera `pnpm build` en `clientes/<nombre>/`. Son
archivos estáticos (HTML, un JS, JSON y CSV); cualquier servidor web los sirve.

## Hecho que manda sobre todo lo demás

En un sitio estático **un login hecho en el navegador no protege nada**: quien conozca la
ruta `data/ventas.csv` la descarga sin pasar por la pantalla de login, porque el archivo
está ahí y el servidor lo entrega a quien lo pida. La protección tiene que estar en el
servidor, delante de todos los archivos, incluidos los CSV.

Cómo comprobarlo, siempre, después de desplegar:

```bash
curl -I https://cliente.com/reportes/data/ventas.csv
# Debe responder 401 (o 302 a la pantalla de acceso), nunca 200.
```

## Opción 1 · nginx o Apache del cliente (basic auth)

Para clientes que ya tienen servidor. Un usuario y contraseña por cliente, sin servicios
externos.

```bash
# Crear el archivo de contraseñas (pide la contraseña).
htpasswd -c /etc/nginx/.htpasswd-reportes analista
```

nginx:

```nginx
location /reportes/ {
    alias /var/www/reportes/;            # aquí va el contenido de dist/
    auth_basic "Reportes";
    auth_basic_user_file /etc/nginx/.htpasswd-reportes;
    try_files $uri $uri/ /reportes/index.html;
}
```

Apache (`.htaccess` dentro de la carpeta):

```apache
AuthType Basic
AuthName "Reportes"
AuthUserFile /var/www/.htpasswd-reportes
Require valid-user
```

Limitación: basic auth sin HTTPS manda la contraseña casi en claro; solo con HTTPS.

## Opción 2 · Cloudflare Access delante del sitio

Para clientes con dominio en Cloudflare (o que acepten ponerlo). El sitio se sube a
cualquier hosting estático (Cloudflare Pages, el propio servidor, un bucket) y Access pide
login por correo con código de un solo uso o Google/Microsoft; nadie memoriza contraseñas.

1. Zero Trust → Access → Applications → Add → Self-hosted.
2. Dominio: `cliente.com`, ruta `reportes`.
3. Política: Allow · Emails ending in `@cliente.com` (o una lista de correos).
4. Si el hosting no es de Cloudflare, activar "Protect with Access" también en el origen
   para que no se pueda saltar entrando por la IP directa.

Es gratis hasta 50 usuarios. Es la opción recomendada cuando el cliente no tiene equipo
técnico: tú la configuras una vez y él administra correos.

## Opción 3 · Hosting estático con contraseña integrada

Para una entrega rápida sin tocar servidores del cliente:

- **Netlify** (plan de pago): Site settings → Access control → Password protection.
  Protege todo el sitio, CSV incluidos, porque lo hace el edge antes de servir.
- **Vercel**: Deployment Protection → Password Protection (plan Pro).
- **GitHub Pages no sirve**: no tiene protección de acceso; cualquier URL es pública.

Subir la carpeta: arrastrar `dist/` al panel (Netlify Drop) o `netlify deploy --prod --dir=dist`.

## Actualizar datos sin reconstruir

Reemplazar `dist/data/ventas.csv` por el nuevo CSV del notebook. El dashboard lo lee al
cargar; no hay caché que invalidar salvo la del navegador (recargar con Ctrl+F5 si el
hosting pone `Cache-Control` largo; en nginx conviene `add_header Cache-Control "no-cache"`
para `data/` y `dashboard.json`).

## Lista de verificación de entrega

1. `pnpm build` sin errores y `pnpm preview` muestra el dashboard completo.
2. Subida la carpeta `dist/`.
3. `curl -I .../data/<archivo>.csv` responde 401 o redirección, no 200.
4. Entrar con la credencial del cliente y abrir el dashboard en móvil también.
5. Anotar cuánto tiempo tomó todo: es el costo por cliente y marca la siguiente mejora.
