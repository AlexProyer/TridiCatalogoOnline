# Notas técnicas y hallazgos

Observaciones encontradas al leer el código del proyecto, más el registro de
qué se hizo con cada una. Sirve para que quien continúe el proyecto no se
sorprenda ni pierda tiempo reinvestigando algo que ya se sabía.

## 1. ✅ RESUELTO — `startApp()` estaba definida dos veces

En [catalogo/js/app.js](catalogo/js/app.js) existían **dos** funciones
`startApp()` (una cerca de la línea 85 que mostraba el catálogo directo, y
otra en la sección "9. NAVEGACIÓN INFERIOR" que mostraba el `bottom-nav` y
llamaba a `navigate('catalog')`). La segunda ganaba en tiempo de ejecución
(JavaScript se queda con la última declaración) y la primera era código
muerto. **Se eliminó la primera definición** — ahora solo existe una.

## 2. ✅ RESUELTO — Bloque grande de código comentado

Había un bloque de ~25 líneas comentado con `//`, justo después de
`renderProducts()`, con una versión vieja de esa misma función. **Se
eliminó** por ser código muerto sin valor de referencia.

## 3. ✅ RESUELTO — Inconsistencia de mayúsculas en ruta de imagen

La carpeta física era `catalogo/assets/images/Llavero/` (con "L" mayúscula)
mientras el código ya apuntaba a `assets/images/llavero/` (minúscula). En
Windows no daba error, pero en un hosting Linux (como Cloudflare Workers, que
es donde se va a desplegar el sitio) la ruta no habría encontrado el
archivo. **Se renombró la carpeta a `llavero/`** (minúscula) para que
coincida exactamente con las rutas usadas en el código/datos.

## 4. Imágenes referenciadas que todavía no existen

Ahora que el catálogo vive en
[catalogo/data/products.json](catalogo/data/products.json) (ver punto 8),
varios colores siguen apuntando a archivos que no están presentes en
`assets/images/`:

- `assets/images/gato/blanco_1.jpg` (colores "Morado" y "Azul" del gato geométrico).
- `assets/images/llavero/llavero_1.jpg` (todos los colores del llavero personalizado).

Son placeholders dejados por quien escribió el catálogo originalmente.
Mientras no se agreguen esas imágenes reales, esos colores mostrarán el
ícono de fallback (imagen rota) en el carrusel. Ver
[GUIA_PRODUCTOS.md](GUIA_PRODUCTOS.md) para cómo agregar imágenes nuevas.

## 5. No hay backend ni persistencia real

`localStorage` sigue siendo la única fuente de verdad para nombre de
usuario, favoritos, vistos recientes y pedidos. Esto implica:

- Ningún dato de usuario es visible para el dueño del negocio salvo el
  mensaje de WhatsApp que llega al hacer un pedido.
- No hay forma de ver "todos los pedidos de todos los clientes" desde algún
  panel — cada pedido solo existe en el WhatsApp del negocio y en el
  `localStorage` del navegador de quien lo hizo.
- Si se necesita un historial real de pedidos/clientes a futuro, hace falta
  agregar un backend (o un servicio externo tipo formulario/hoja de cálculo)
  — actualmente no existe ninguno.

## 6. Sin build tools ni dependencias instalables

No hay `package.json`, `node_modules`, empaquetador (Webpack/Vite) ni
transpilador. Las únicas dependencias externas son **Google Fonts** y
**Font Awesome**, cargadas por `<link>` a un CDN en `index.html`. Si el
sitio se usa sin conexión a internet, los íconos y la tipografía
"Poppins" no cargarán (el texto seguirá siendo legible con la fuente por
defecto del sistema).

## 7. "Login" no es autenticación real

La pantalla `auth-screen` y las funciones `quickLogin()` / `logout()` no
verifican contraseña ni identidad: cualquiera puede escribir cualquier
nombre y "entrar". Es un mecanismo simple para personalizar la experiencia
(saludo, mensaje de WhatsApp) y para gatear el acceso a Favoritos/Pedidos/Perfil
como fricción mínima, no como seguridad real. No debe tratarse como sistema
de cuentas de usuarios.

## 8. El catálogo ahora se carga desde `data/products.json`

`productsDB` dejó de estar hardcodeado en `app.js`: al iniciar la app,
`app.js` hace `fetch('data/products.json')` y recién después de que esa
promesa resuelve (`await productsReady` dentro de `startApp()`) se navega al
catálogo. Esto se hizo para poder conectar un panel de administración
Git-based (Decap CMS, ver punto 9) que edite `products.json` sin tocar
código. Detalles:

- Si el `fetch` falla (archivo movido, JSON inválido, etc.), la app no
  queda en blanco: `renderProducts()`, `renderExplorar()` y
  `renderFavoritos()` muestran un mensaje de error legible
  (`renderCatalogErrorIfNeeded()` en `app.js`).
- `renderPedidos()` no necesitó ese mismo guard porque ya validaba
  `productsDB.find(...)` antes de usar cada producto.
- La ruta `data/products.json` es relativa al `index.html`, por lo que
  funciona igual sirviendo la carpeta `catalogo/` con cualquier servidor
  estático local (`npx serve catalogo`) o en el deploy real (probado
  localmente con `wrangler dev`: `fetch` devuelve `200 OK` y el catálogo se
  pinta con los datos del JSON).
- Ver [GUIA_PRODUCTOS.md](GUIA_PRODUCTOS.md) para cómo editar el catálogo
  ahora que vive en `products.json` en vez de `app.js`.
- **El archivo es un objeto `{ "products": [...] }`, no un array suelto.**
  Se envolvió así (en vez de dejar el array directo en la raíz del archivo)
  porque Decap CMS necesita esa forma para poder editar el archivo como una
  "colección de archivo único" con un campo de tipo lista. Si alguna vez se
  edita `products.json` a mano, ojo con no perder ese wrapper.

## 9. Panel de administración (Decap CMS) vía Cloudflare Workers, no Pages

Se agregó un panel en `/admin/` (Decap CMS) para editar `products.json` sin
tocar código, con login vía OAuth de GitHub. Ver
[ARQUITECTURA.md](ARQUITECTURA.md) sección 13 para el flujo completo y
[catalogo/ADMIN.md](catalogo/ADMIN.md) para el uso día a día. Cosas a tener
en cuenta:

- El acceso de escritura al panel = ser colaborador con permiso de
  "Write" (o superior) en el repo de GitHub. No hay un sistema de usuarios
  separado — ver la sección de permisos en ARQUITECTURA.md.
- El modo elegido es `editorial_workflow`: nada se publica solo, hay que
  entrar al panel y apretar "Publish" explícitamente después de guardar.
- El Client Secret de la OAuth App de GitHub vive únicamente como variable
  configurada en el Worker `tridicatalogo` (Cloudflare dashboard → Settings
  → Variables and Secrets, marcada "Encrypt"), nunca en el repo.
- El puente OAuth (`src/worker.js`, `src/oauth-auth.js`,
  `src/oauth-callback.js`) vive en la **raíz del repo** (no dentro de
  `catalogo/`), junto con `wrangler.jsonc`. `catalogo/` es solo el
  `assets.directory` que declara ese archivo de configuración — no hay una
  carpeta "de Functions" separada como en Pages (ver la nota siguiente).

**Corrección importante durante el desarrollo — el hosting no es Cloudflare
Pages, es Cloudflare Workers (con static assets).** El plan original asumía
Cloudflare Pages clásico (`*.pages.dev`, con `Pages Functions` en una
carpeta `functions/`), pero al conectar el repo el proyecto en Cloudflare
quedó como un **Worker** (`*.workers.dev`) — Cloudflare viene empujando
Workers + static assets como reemplazo de Pages. Esto cambia varias cosas
de fondo:

- No existe `functions/api/*.js` (estilo Pages, ruteo automático por
  nombre de archivo). En su lugar hay un único Worker script
  (`src/worker.js`) que decide a mano si una request es `/api/auth`,
  `/api/callback`, o si se sirve como archivo estático
  (`env.ASSETS.fetch(request)`).
- La configuración vive en `wrangler.jsonc` (raíz del repo): declara el
  `name` del Worker (debe coincidir con el nombre en el dashboard de
  Cloudflare), el `main` (el script de arriba) y el `assets.directory`
  (`./catalogo`).
- Las variables de entorno se configuran en el dashboard del Worker
  (Settings → Variables and Secrets) — pero **solo aparece esa opción una
  vez que el Worker tiene código propio** (`main` + assets). Un Worker que
  sirve *únicamente* static assets (sin `main` script) no deja agregar
  variables desde el dashboard ("Variables cannot be added to a Worker
  that only has static assets") — por eso hizo falta agregar
  `src/worker.js` antes de poder configurar `GITHUB_OAUTH_CLIENT_ID` /
  `GITHUB_OAUTH_CLIENT_SECRET`.
- Se probó localmente con `wrangler dev` (no con `npx serve`, que no
  entiende `wrangler.jsonc` ni sirve `env.ASSETS`): sirvió `/`, `/admin/`,
  `/data/products.json`, imágenes, y las dos rutas de la API, incluyendo
  el redirect real a `github.com/login/oauth/authorize` con un
  `GITHUB_OAUTH_CLIENT_ID` de prueba vía `.dev.vars` (archivo que no se
  commitea, ver `.gitignore`).

**Importante — ya no se puede abrir `index.html` con doble clic.** Antes,
como todo era JS embebido, abrir el archivo directamente (`file://...`)
funcionaba. Ahora que `app.js` hace `fetch('data/products.json')`, abrirlo
así falla: los navegadores no permiten `fetch` sobre el esquema `file://`
(error de CORS / "Failed to fetch"), así que `productsLoadError` queda
seteado y se ve el mensaje de error en vez del catálogo. Hace falta un
servidor HTTP, aunque sea local (`npx serve catalogo`, `wrangler dev`,
Live Server, etc.). En producción esto no es un problema porque Cloudflare
Workers siempre sirve por HTTP.

## 10. ✅ RESUELTO — Elementos de la interfaz que no hacían nada

Al hacer un inventario completo de todo lo clickeable en `index.html`, se
encontraron elementos rotos o sin funcionalidad que no estaban documentados
acá. Todos se implementaron:

- **Ícono de usuario del header** (`catalog-screen`) llamaba a
  `showUserProfile()`, una función que **no existía** en `app.js` —
  tiraba un error real en consola (`showUserProfile is not defined`) y no
  hacía nada visible. Se cambió por `navigate('perfil')` (reutiliza la
  pantalla de Perfil que ya existía, con su mismo gate de login).
- **Las 4 categorías** (Decoración, Llaveros, Recuerdos, Regalos) tenían
  `cursor: pointer` en CSS pero **cero `onclick`** en el HTML. Ahora cada
  una llama a `filterByCategory(categoria)`, que navega a Explorar filtrado
  por esa categoría (con un chip para ver/quitar el filtro activo,
  `renderExplorarFilterChip()` / `clearCategoryFilter()` en `app.js`).
- **Las dos barras de búsqueda** ("Buscar productos..." en el inicio y
  "Buscar en todo el catálogo..." en Explorar) eran puramente decorativas.
  Ahora filtran en vivo por título/categoría (`handleCatalogSearch()` /
  `handleExplorarSearch()`, conectadas con `addEventListener('input', ...)`
  sobre `#catalog-search-input` / `#explorar-search-input`).
- **El enlace "Ver todo"** (junto a "Destacados") tenía `href="#"` sin
  ningún JS. Ahora llama a `goExplorar()` (Explorar sin ningún filtro).

Nota de contenido (no de código): las categorías "Recuerdos" y "Regalos"
todavía no tienen ningún producto cargado en `products.json`, así que
filtrar por ellas hoy muestra el estado vacío ("No hay productos en...
todavía"). Es el comportamiento esperado — se resuelve solo agregando
productos con esas categorías (ver [GUIA_PRODUCTOS.md](GUIA_PRODUCTOS.md)
o [catalogo/ADMIN.md](catalogo/ADMIN.md)).

## 11. Pulido técnico: metadata, imágenes, 404, loading states

Pasada de pulido sobre el rediseño responsive (que no cambia layout, solo
metadata/rendimiento/accesibilidad):

- **WebP + fallback JPEG**: todas las fotos existentes en
  `assets/images/` se convirtieron a `.webp` (conservando el JPEG
  original) — ~51% menos peso para navegadores modernos. `app.js` arma un
  `<picture>` con `<source type="image/webp">` + `<img>` de respaldo en
  las tres vistas que muestran imágenes (`createProductCardHTML`,
  `renderCarousel`, `renderPedidos`). Ver la nota sobre fotos nuevas en
  [GUIA_PRODUCTOS.md](GUIA_PRODUCTOS.md) — el `.webp` **no se genera
  solo** para imágenes que se suban después.
- `<picture> { display: contents; }` (regla global en `style.css`) hace
  que el wrapper no afecte ningún estilo existente del `<img>` (flex,
  tamaños, etc.) — por eso no hizo falta tocar el resto del CSS de
  `.product-img` / `.carousel-track img` al introducir `<picture>`.
- **Alt text**: antes era genérico (`alt="${title}"` en la tarjeta, sin
  `alt` en la miniatura de Pedidos). Ahora describe título + color +
  posición en el carrusel (ej. `"Gato geométrico, color Blanco (foto 1 de
  3)"`), generado dinámicamente a partir de los datos del producto.
- **Loading states**: `.product-img` tiene un shimmer animado (CSS puro,
  usa `--glass-bg`/`--glass-border`) que se apaga solo cuando la imagen
  soltó el evento `load` (clase `.loaded`, agregada vía `onload` inline).
  El carrusel del modal usa el mismo patrón (fade de opacidad). No depende
  de la cantidad de columnas de la grilla — es por-tarjeta, no por-grilla.
- **404 personalizada** (`catalogo/404.html`): reutiliza `style.css` y las
  mismas clases (`.app-container`, `.btn-primary`) para que se vea igual
  de responsive que el resto del sitio, no como el viejo frame de app
  móvil. Requiere `"not_found_handling": "404-page"` en `wrangler.jsonc`
  (sin eso, Cloudflare Workers muestra su propio 404 genérico en vez de
  este archivo).
- **`robots.txt`** bloquea `/admin/` (no tiene sentido indexar el panel) y
  apunta a **`sitemap.xml`** — que solo lista la home, porque el catálogo
  es una sola página (todo el "routing" entre pantallas es JS, no URLs
  reales).
- **Logo real y favicon (✅ resuelto)**: Alex mandó el logo oficial de
  Tridi (PNG con fondo transparente). Se guardó recortado en
  `catalogo/assets/logo/tridi-logo.png` (+ `.webp`), y se generaron las
  variantes de favicon en `catalogo/assets/favicon/`
  (`favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png` —con
  fondo sólido `--bg-color`, porque iOS no maneja bien la transparencia—,
  `icon-192.png`, `icon-512.png`, y un `site.webmanifest` mínimo que los
  referencia). El logo reemplazó al ícono de cubo de Font Awesome en:
  `top-nav-logo`, `.logo-container` del hero, `.hero-visual` (desktop), y
  el ícono de la página 404. **Se sacó el texto "Tridi" que estaba al
  lado/debajo del ícono en el top-nav y en el hero** porque el logo ya
  trae el nombre incluido — quedaba duplicado. Si se prefiere volver a
  mostrar el `<h1>Tridi</h1>` del hero además del logo, es un cambio de
  una línea en `index.html`.
- **`og:image` (✅ resuelto)**: en vez de usar directo alguna foto de
  producto (quedaría mal recortada — las fotos son ~1004×1115, casi
  cuadradas, y `og:image` se muestra en 1200×630, mucho más ancho), se
  compuso una imagen dedicada en
  [catalogo/assets/og/og-image.jpg](catalogo/assets/og/og-image.jpg):
  fondo con el mismo gradiente de marca que el resto del sitio, el logo
  arriba a la izquierda, la bajada del hero ("Impresiones 3D únicas,
  hechas para ti.") como texto, y la foto de `gato_rosado_basecelular.jpeg`
  a la derecha. Se generó con `sharp` componiendo un SVG de fondo + el
  logo + la foto (script no versionado, vivió solo en el scratchpad de la
  sesión). Si se agregan productos nuevos más adelante y se quiere
  actualizar esta imagen con otra foto, hay que rehacer la composición a
  mano (no hay un script en el repo para regenerarla).

**Nota de testing**: en el navegador headless usado para probar esta
sesión, `loading="lazy"` en las imágenes no dispara la carga (posible
limitación del entorno de automatización sin ciclo de render activo — el
mismo entorno donde las capturas de pantalla vienen fallando toda la
sesión). Se verificó forzando `loading="eager"` manualmente que todo el
resto del mecanismo (WebP, alt, `.loaded`) funciona correctamente una vez
que la imagen carga; no se pudo confirmar el comportamiento de
`loading="lazy"` en un navegador real durante esta sesión.
