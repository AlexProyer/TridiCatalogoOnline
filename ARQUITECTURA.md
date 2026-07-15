# Arquitectura técnica

Este documento explica cómo funciona el código por dentro. Está pensado para
alguien que nunca vio el proyecto y necesita entenderlo al 100% antes de
modificarlo.

Ver también: [README.md](README.md) (visión general) y
[NOTAS_TECNICAS.md](NOTAS_TECNICAS.md) (bugs y detalles a tener en cuenta).

## 1. Idea general: una "SPA falsa" de una sola página

Todo vive en **un único** [catalogo/index.html](catalogo/index.html). No hay
router, no hay múltiples páginas `.html`, no hay recarga del navegador al
"navegar". Lo que parecen pantallas distintas de una app son en realidad
`<section>` (o `<div>`) dentro del mismo documento, que JavaScript muestra y
oculta cambiando su `style.display` entre `none` y `block`.

Las "pantallas" (todas definidas en `index.html`) son:

| id HTML | Qué es |
|---|---|
| `hero-screen` | Pantalla de bienvenida inicial (logo, nombre opcional, botón "Comenzar") |
| `catalog-screen` | Inicio del catálogo: buscador, categorías, banner promo, productos destacados |
| `explorar-screen` | Grilla con **todos** los productos |
| `favoritos-screen` | Productos marcados con ❤️ |
| `pedidos-screen` | Historial de pedidos hechos por WhatsApp |
| `perfil-screen` | Nombre del usuario y "puntos Tridi" |
| `auth-screen` | Pantalla que pide el nombre cuando se intenta entrar a una sección protegida |

Además, fuera de ese flujo de "pantallas", hay overlays que se activan con
una clase CSS `.active` (no con `display`):

- `product-modal` — ficha de detalle de un producto (carrusel + specs + botón WhatsApp).
- `all-colors-overlay` — grilla con todos los colores disponibles de un producto.
- `sidebar` (+ `sidebar-overlay`) — menú lateral hamburguesa.

Todo el CSS de este comportamiento (`display:none`, `transform: translateY(100%)`,
transiciones) está en [catalogo/css/style.css](catalogo/css/style.css).

## 2. Arranque de la app

`index.html` carga [catalogo/js/app.js](catalogo/js/app.js) al final del
`<body>`. Al cargar la página se ve `hero-screen` (pantalla de bienvenida).

Cuando el usuario toca **"Comenzar"** se ejecuta `startApp()`:

```js
async function startApp() {
    const nameInput = document.getElementById('username-input').value;
    if (nameInput.trim() !== "") {
        userProfile.name = nameInput.trim();
        saveUser();
    }
    await productsReady;
    document.getElementById('hero-screen').style.display = 'none';
    document.getElementById('bottom-nav').style.display = 'flex';
    navigate('catalog');
}
```

Esto guarda el nombre (si el usuario escribió uno — es opcional), espera a
que termine de cargar el catálogo (`productsReady`, ver sección 5), oculta
el hero, muestra la barra de navegación inferior y navega a `catalog`.

`productsReady` es la promesa devuelta por `loadProductsDB()`, disparada
apenas se ejecuta `app.js` (en paralelo a que el usuario escribe su nombre
en el hero), así que normalmente ya está resuelta para cuando el usuario
toca "Comenzar".

## 3. Sistema de navegación

Todo pasa por tres funciones en `app.js`:

- **`navigate(screenPrefix)`** — el punto de entrada. Recibe un string como
  `'catalog'`, `'explorar'`, `'favoritos'`, `'pedidos'` o `'perfil'`.
  1. Si la sección requiere "login" (`pedidos`, `favoritos`, `perfil`) y el
     usuario no tiene nombre guardado (`userProfile.name` es `null`), guarda
     a dónde quería ir (`targetScreenAfterAuth`) y muestra `auth-screen` en
     su lugar.
  2. Si no, llama a la función de renderizado correspondiente
     (`renderProducts`, `renderExplorar`, `renderFavoritos`, `renderPedidos`,
     `renderPerfil`) para refrescar el contenido dinámico de esa pantalla.
  3. Llama a `showScreen()` para cambiar qué `<section>` está visible.
  4. Llama a `updateNavHighlight()` para resaltar el ícono activo en la
     barra inferior.

- **`showScreen(screenId)`** — oculta todas las pantallas de la lista
  `screens` y muestra solo la solicitada, con una animación `fadeIn`.

- **`updateNavHighlight(navId)`** — quita la clase `active` de todos los
  íconos de `bottom-nav` y se la pone solo al actual.

**"Login" simplificado**: `auth-screen` solo pide un nombre (input de texto),
sin contraseña ni verificación real. Al enviarlo (`quickLogin()`), se guarda
el nombre y se navega a `targetScreenAfterAuth` (la pantalla a la que el
usuario quería ir originalmente). `logout()` simplemente borra
`userProfile.name` y vuelve al catálogo público.

## 4. Estado del usuario (persistencia con `localStorage`)

No hay backend ni base de datos: todo el estado del usuario vive en el
navegador, en `localStorage`, bajo la clave `tridiUser`:

```js
let userProfile = JSON.parse(localStorage.getItem('tridiUser')) || {
    name: null,
    likes: [],     // IDs de productos marcados como favoritos
    recent: [],    // IDs de productos vistos recientemente
    orders: []     // Pedidos realizados: [{ id, color, date }, ...]
};
```

Cada vez que cambia algo relevante (nombre, likes, pedidos) se llama a
`saveUser()`, que vuelve a serializar `userProfile` a `localStorage`. Esto
significa que:

- Los datos son **por navegador/dispositivo**, no hay cuenta real ni
  sincronización entre dispositivos.
- Si el usuario borra los datos del sitio o usa otro navegador, pierde sus
  favoritos, pedidos y nombre.

## 5. Catálogo de productos (`productsDB`)

El catálogo ya no está hardcodeado en `app.js`: vive en
[catalogo/data/products.json](catalogo/data/products.json), un archivo JSON
independiente con la forma `{ "products": [...] }` (envuelto en un objeto,
no un array "pelado" — así lo requiere Decap CMS para poder editarlo desde
el panel admin, ver sección 12). `app.js` lo carga en tiempo de ejecución
con `fetch`:

```js
let productsDB = [];
let productsLoadError = null;

async function loadProductsDB() {
    try {
        const response = await fetch('data/products.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        productsDB = data.products;
    } catch (err) {
        console.error('No se pudo cargar data/products.json:', err);
        productsLoadError = err;
    }
}

const productsReady = loadProductsDB(); // se dispara apenas carga el script
```

`productsDB` arranca vacío (`[]`) y se llena de forma **asíncrona** una vez
que el `fetch` resuelve. Todo el resto del código (`renderProducts`,
`renderExplorar`, `renderFavoritos`, `renderPedidos`, `openProduct`, etc.)
sigue leyendo `productsDB` exactamente igual que antes — no les importa si
se llenó de forma síncrona o asíncrona, solo que ya esté listo antes de la
primera vez que se use. Eso se garantiza porque `startApp()` hace
`await productsReady` antes de mostrar el catálogo (ver sección 2).

Si el `fetch` falla (archivo movido, JSON con errores de sintaxis, sin
conexión, etc.), `productsLoadError` queda seteado y `productsDB` queda
vacío. `renderProducts()`, `renderExplorar()` y `renderFavoritos()` llaman
a un helper, `renderCatalogErrorIfNeeded(container)`, que en ese caso pinta
un mensaje de error legible en vez de dejar la grilla en blanco.

Cada producto en `products.json` tiene esta forma:

```json
{
    "id": "gato_geo",
    "title": "Gato geométrico",
    "price": 45000,
    "category": "Decoración",
    "desc": "Figura decorativa...",
    "material": "PLA Premium",
    "size": "12 cm",
    "mainImage": "assets/images/gato/gato_rosado_basecelular.jpeg",
    "colors": [
        {
            "name": "Blanco",
            "hex": "#ffffff",
            "images": ["assets/images/gato/gato_rosado_basecelular.jpeg"]
        }
    ]
}
```

`price` se formatea con `toLocaleString('es-CO')`; `hex` es el color del
"dot" seleccionable; `images` son las rutas del carrusel para ese color
específico.

Este cambio (extraer el catálogo a un JSON separado) fue deliberado para
poder conectar un panel de administración **Git-based (Decap CMS)** que
edite `products.json` directamente, sin que quien mantiene el catálogo
tenga que tocar JavaScript. Para agregar/editar productos en la práctica,
ver la guía en [GUIA_PRODUCTOS.md](GUIA_PRODUCTOS.md).

### Renderizado de tarjetas

`createProductCardHTML(prod)` genera el HTML de una tarjeta de producto
(imagen, botón de like, título, precio) como string, y se reutiliza en las
tres vistas que muestran grillas de productos:

- `renderProducts()` → pinta `productsDB` en `#products-container` (inicio).
- `renderExplorar()` → pinta `productsDB` completo en `#explorar-container`.
- `renderFavoritos()` → filtra `productsDB` por `userProfile.likes` y pinta
  en `#favoritos-container` (o un mensaje si no hay favoritos).

`renderPedidos()` es distinto: recorre `userProfile.orders` (más reciente
primero) y por cada pedido busca el producto correspondiente en `productsDB`
para mostrar una tarjeta de historial (`order-card`) con fecha, imagen,
título y color pedido.

`renderPerfil()` solo pone el nombre y calcula puntos como
`orders.length * 10` (una regla fija, no hay lógica de puntos más compleja).

## 6. Ficha de producto (modal) y sistema de colores

Al tocar una tarjeta se llama `openProduct(id)`:

1. Busca el producto en `productsDB` por `id` y lo guarda en la variable
   global `currentProduct`.
2. Lo agrega a `userProfile.recent` si no estaba (histórico de "vistos").
3. Rellena todos los campos de texto del modal (título, precio, categoría,
   descripción, specs).
4. Pinta hasta 5 "dots" de color rápidos con `renderColorOptions()`.
5. Selecciona el primer color por defecto llamando a
   `changeColor(product.colors[0].name)`.
6. Muestra el modal agregando la clase `active` (el CSS anima la entrada
   deslizando desde abajo).

`changeColor(colorName)` busca el color en `currentProduct.colors`, marca su
"dot" como activo, y llama a `renderCarousel(selectedColor.images)` para
cargar las fotos específicas de ese color.

`closeProduct()` quita la clase `active` del modal y vuelve a llamar
`renderProducts()` para que la grilla del catálogo refleje cambios de like
hechos desde el modal.

### Overlay "Ver todos los colores"

Si un producto tiene más de 5 colores, `openAllColors()` pinta una grilla
completa (`grid-all-colors`) con **todos** los colores dentro de
`all-colors-overlay`. Cada color, al tocarlo, también llama a
`changeColor()` (que además cierra este overlay automáticamente).

## 7. Carrusel de imágenes (deslizable)

Implementado a mano, sin ninguna librería de carrusel. Piezas clave:

- **`renderCarousel(imagesArray)`** — limpia el carrusel anterior, crea una
  etiqueta `<img>` por cada imagen del color elegido dentro de
  `#carousel-track`, y un punto indicador por imagen en
  `#carousel-indicators`. Si el color no tiene imágenes, muestra un ícono de
  cubo genérico como fallback.
- **Variables de estado globales**: `currentSlide`, `isDragging`, `startX`,
  `currentTranslate`, `prevTranslate`, `totalSlides`.
- **Eventos de arrastre** (mouse y touch) sobre `#carousel-container`:
  `dragStart` → `drag` → `dragEnd`.
  - `drag()` calcula cuánto se movió el dedo/mouse y traslada la pista
    (`setTransform`), con un efecto de "resistencia" (`/3`) si se intenta
    arrastrar más allá del primer o último slide.
  - `dragEnd()` decide si el arrastre fue suficiente (más del 20% del ancho)
    para cambiar de slide, y llama a `updateSlidePosition()` para animar el
    salto al slide final y actualizar qué punto indicador está activo.
- Se previene el comportamiento nativo de "arrastrar imagen como archivo"
  (`dragstart` en `track`) y el scroll de la página mientras se hace swipe
  en touch (`e.preventDefault()` en `touchmove`).

## 8. Flujo de pedido por WhatsApp

No existe un "carrito" ni checkout real. `sendToWhatsApp()`:

1. Requiere que haya un `currentProduct` y un `selectedColor` (si no, no
   hace nada).
2. Guarda el pedido en `userProfile.orders` (`id`, `color`, `date` con
   `toLocaleDateString()`) y persiste con `saveUser()`.
3. Arma un mensaje de texto en español con nombre del usuario (si existe),
   título del producto, precio formateado y color elegido.
4. Abre `https://wa.me/<WHATSAPP_NUMBER>?text=<mensaje codificado>` en una
   nueva pestaña — esto abre WhatsApp Web o la app de WhatsApp con el
   mensaje prellenado, listo para enviar manualmente.

El número de destino está hardcodeado al inicio de `app.js`:

```js
const WHATSAPP_NUMBER = "573174271275";
```

## 9. Compartir producto

`shareProduct()` intenta usar la **Web Share API** nativa del navegador/celular
(`navigator.share`) para compartir título, texto y la URL actual de la
página. Si el navegador no la soporta (típicamente en escritorio),
usa `fallbackShare()`, que copia el texto al portapapeles
(`navigator.clipboard.writeText`) y muestra una notificación temporal
("toast") con `showToast()`.

`showToast(message)` crea un `<div class="toast-notification">`, lo agrega
al `<body>`, lo anima con la clase `show` (CSS transiciona su posición y
opacidad) y lo elimina del DOM después de 3 segundos.

## 10. Menú lateral (sidebar)

`toggleSidebar()` alterna la clase `active` en `#sidebar` y en
`#sidebar-overlay` (fondo oscuro detrás del menú). El sidebar es solo
contenido estático en `index.html` (enlaces a "Preguntas Frecuentes",
"Envíos y Entregas", "Soporte" sin funcionalidad real todavía) más la opción
**"Cambiar Usuario"**, que llama a `logout()`.

## 11. Tema visual (CSS)

Todas las variables de color/tema están centralizadas en `:root` al inicio
de [catalogo/css/style.css](catalogo/css/style.css):

```css
:root {
    --bg-color: #0b0914;
    --bg-gradient: linear-gradient(135deg, #1f1b4a 0%, #0b0914 100%);
    --primary: #7C3AED;
    --primary-light: #9333EA;
    --primary-gradient: linear-gradient(90deg, #3B82F6, #8B5CF6, #D946EF);
    --glass-bg: rgba(255, 255, 255, 0.05);
    --glass-border: rgba(255, 255, 255, 0.1);
    --text-main: #ffffff;
    --text-muted: #9ca3af;
}
```

El diseño usa "glassmorphism" (fondos semitransparentes + `backdrop-filter:
blur(...)`), un layout centrado tipo app móvil (`.app-container` con
`max-width: 480px`), y animaciones CSS simples (`fadeIn`, transiciones de
`transform`). Para cambiar la paleta de colores de toda la app basta con
editar estas variables.

## 12. Panel de administración (Decap CMS) y login con GitHub

El panel vive en [catalogo/admin/](catalogo/admin/) y queda accesible en
`/admin/` una vez desplegado. Es **Decap CMS** (un CMS "Git-based": no tiene
base de datos propia, edita archivos del repo directamente vía la API de
GitHub y hace un commit por cada publicación).

### Piezas involucradas

- **[catalogo/admin/index.html](catalogo/admin/index.html)** — carga el
  script de Decap CMS desde un CDN (`unpkg.com/decap-cms`). No tiene lógica
  propia; Decap CMS busca automáticamente `config.yml` en la misma carpeta.
- **[catalogo/admin/config.yml](catalogo/admin/config.yml)** — define:
  - El backend (`name: github`, el repo `AlexProyer/TridiCatalogoOnline`,
    rama `main`).
  - `base_url` + `auth_endpoint`: le dicen a Decap CMS dónde está el
    "puente" de login (ver más abajo). Como el puente vive en el mismo
    sitio, `base_url` es la URL del propio sitio en producción.
  - `publish_mode: editorial_workflow`: los cambios quedan como borrador
    (una rama + estado interno) hasta que alguien aprieta "Publish" dentro
    del panel — no se comitea directo a `main` al guardar.
  - `media_folder` / `public_folder`: dónde se suben las imágenes nuevas
    (`catalogo/assets/images/`, relativo a la raíz del repo) y qué ruta se
    guarda en el campo correspondiente (`assets/images/...`, relativo al
    sitio) — coincide con la convención ya usada en `products.json`.
  - La colección **"productos"**: un único archivo
    (`catalogo/data/products.json`) con un campo `products` de tipo lista,
    cuyos subcampos son exactamente los mismos que ya documenta la sección 5
    (`id`, `title`, `price`, `category`, `desc`, `material`, `size`,
    `mainImage`, `colors[].name/hex/images`).

- **[functions/api/auth.js](functions/api/auth.js)** y
  **[functions/api/callback.js](functions/api/callback.js)** — dos
  Cloudflare Pages Functions (código de servidor, no llegan al navegador
  del cliente del catálogo) que hacen de "puente OAuth" entre Decap CMS y
  GitHub. Viven en `functions/` en la **raíz del repo** (no dentro de
  `catalogo/`), porque Cloudflare Pages busca las Functions relativas al
  "Root directory" del proyecto, mientras que `catalogo/` es solo el "Build
  output directory" (lo que se sirve como sitio estático).

### Flujo de login, paso a paso

1. El usuario entra a `/admin/` y toca "Login with GitHub". Decap CMS abre
   un popup a `${base_url}/api/auth`.
2. **`auth.js`** arma la URL de autorización de GitHub
   (`github.com/login/oauth/authorize`) con el `client_id` (variable de
   entorno `GITHUB_OAUTH_CLIENT_ID`), un `state` aleatorio (guardado en una
   cookie de corta duración, protección CSRF) y `redirect_uri` apuntando a
   `/api/callback`. Redirige el popup ahí.
3. GitHub muestra la pantalla de autorización; el usuario acepta.
4. GitHub redirige el popup a `/api/callback?code=...&state=...`.
5. **`callback.js`** valida que el `state` coincida con la cookie, y
   cambia el `code` por un `access_token` llamando a
   `github.com/login/oauth/access_token` (usando `client_id` +
   `GITHUB_OAUTH_CLIENT_SECRET`, ambos como variables de entorno — el
   secret nunca está en el código ni en el repo).
6. `callback.js` devuelve una página HTML mínima que hace `postMessage` del
   token de vuelta a la ventana que abrió el popup (protocolo esperado por
   Decap CMS: `authorization:github:success:{"token":"...","provider":"github"}`).
   Decap CMS recibe ese mensaje, guarda el token, y a partir de ahí llama a
   la API de GitHub directamente desde el navegador del usuario para leer y
   escribir archivos del repo.

### Modelo de permisos (importante)

Decap CMS **no tiene usuarios propios**. Cualquiera que se loguee con una
cuenta de GitHub que sea colaboradora con permiso de **escritura** en el
repo puede editar el catálogo desde el panel; alguien sin ese permiso puede
autenticarse pero le va a fallar al intentar guardar. Administrar "quién
puede usar el panel" = administrar colaboradores del repo en GitHub
(Settings → Collaborators), no algo que se configure en Decap CMS.

### Variables de entorno requeridas (Cloudflare Pages)

- `GITHUB_OAUTH_CLIENT_ID` — Client ID de la OAuth App de GitHub.
- `GITHUB_OAUTH_CLIENT_SECRET` — Client Secret de esa misma OAuth App
  (configurada como variable **secreta/cifrada** en Cloudflare Pages, nunca
  committeada al repo).
