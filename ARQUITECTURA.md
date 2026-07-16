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
el panel admin, ver sección 13). `app.js` lo carga en tiempo de ejecución
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

- `renderProducts()` → pinta en `#products-container` (inicio), filtrando
  `productsDB` por `catalogSearchQuery` (búsqueda en vivo del inicio; ver
  más abajo).
- `renderExplorar()` → pinta en `#explorar-container`, filtrando
  `productsDB` por `currentCategoryFilter` (si hay una categoría activa) y
  luego por `explorarSearchQuery`. Si el resultado queda vacío, muestra un
  mensaje distinto según si fue por categoría, por búsqueda, o ambas.
- `renderFavoritos()` → filtra `productsDB` por `userProfile.likes` y pinta
  en `#favoritos-container` (o un mensaje si no hay favoritos).

### Búsqueda y filtro por categoría

- `filterProductsByQuery(products, query)` — helper compartido: filtra un
  array de productos por `title`/`category` (case-insensitive). Si `query`
  está vacío devuelve el array sin tocar.
- **Inicio**: el input `#catalog-search-input` dispara
  `handleCatalogSearch(query)` en cada tecla (`input` event), que guarda
  `catalogSearchQuery` y llama a `renderProducts()`. Volver a "Inicio"
  desde la barra inferior (`navigate('catalog')`) resetea la búsqueda.
- **Explorar**: el input `#explorar-search-input` dispara
  `handleExplorarSearch(query)` → guarda `explorarSearchQuery` y llama a
  `renderExplorar()`.
- **Categorías** (`catalog-screen`): cada ícono de categoría llama a
  `filterByCategory(categoria)`, que setea `currentCategoryFilter` y
  navega a Explorar. `renderExplorarFilterChip()` pinta un chip con la
  categoría activa y una `x` que llama a `clearCategoryFilter()`.
- `goExplorar()` — usada por la barra inferior ("Explorar") y por el
  enlace "Ver todo" del inicio: limpia `currentCategoryFilter` y
  `explorarSearchQuery` (y el input de búsqueda) antes de navegar, para
  que siempre muestre el catálogo completo sin filtros heredados de una
  visita anterior.

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

## 10. Menú lateral (sidebar) y overlay de información

`toggleSidebar()` alterna la clase `active` en `#sidebar` y en
`#sidebar-overlay` (fondo oscuro detrás del menú). El sidebar tiene:

- **"Sobre Tridi"**, **"Envíos y Cambios"** y **"Privacidad"** — cada una
  llama a `openInfoOverlay('sobre'|'envios'|'privacidad')`.
- **"Preguntas Frecuentes"** y **"Soporte"** — todavía sin funcionalidad
  real (backlog pendiente, ver [NOTAS_TECNICAS.md](NOTAS_TECNICAS.md)).
- **"Cambiar Usuario"**, que llama a `logout()`.

`openInfoOverlay(key)` es un único overlay reutilizable (`#info-overlay`,
mismo patrón visual que `#all-colors-overlay`: bottom-sheet con
`transform: translateY(...)`) que cambia de contenido según la clave
recibida. El texto de cada sección vive en un objeto `INFO_CONTENT` en
`app.js` (no en el HTML) — para editar la redacción de "Sobre Tridi",
"Envíos y Cambios" o "Privacidad" hay que tocar ese objeto, no
`index.html`. `closeInfoOverlay()` solo quita la clase `active`. Abrir
cualquier sección desde el sidebar también cierra el sidebar automáticamente.

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
blur(...)`), y animaciones CSS simples (`fadeIn`, transiciones de
`transform`). Para cambiar la paleta de colores de toda la app basta con
editar estas variables. `.app-container` con `max-width: 480px` es el
layout de **mobile** únicamente — ver la sección siguiente para tablet y
desktop.

## 12. Diseño responsive (mobile / tablet / desktop)

El sitio nació con un layout fijo tipo "app móvil" (`.app-container` con
`max-width: 480px` en todos los tamaños de pantalla, bottom-nav estilo tab
bar). Eso hacía que en pantallas de escritorio se viera como un teléfono
flotando en medio de un montón de espacio vacío. Se rediseñó para que
mobile se mantenga exactamente igual, y tablet/desktop se comporten como un
sitio web normal. Todo el cambio es **CSS y estructura HTML** — el sistema
de estado (`localStorage`, `navigate()`, `showScreen()`) no se tocó.

### Breakpoints

Mobile-first, sin media query = mobile (el diseño original, intacto):

| Rango | Media query | Qué cambia |
|---|---|---|
| Mobile (hasta 767px) | *(default)* | Igual que siempre. |
| Tablet (768–1023px) | `@media (min-width: 768px)` | Aparece la barra superior, grilla de 3 columnas, se quita el `box-shadow` de "marco de teléfono". |
| Desktop estándar (1024–1599px) | `@media (min-width: 1024px)` | Grilla de 5+ columnas, hero de landing page, modal de producto centrado en dos columnas. |
| Desktop ancho (1600–2199px) | `@media (min-width: 1600px)` | El contenedor puede crecer un poco más antes de topar. |
| UltraWide (2200px+) | `@media (min-width: 2200px)` | Tope más generoso — se aprovecha más pantalla que en desktop estándar, sin líneas de texto interminables. |

`.app-container` pasa de `max-width: 480px` (mobile) → `720px` (tablet) →
`1600px` (desktop estándar) → `1800px` (desktop ancho) → `2000px`
(UltraWide). **No es un tope fijo temprano**: en cualquier viewport más
angosto que el tope de su tier, el contenedor simplemente llena el 100%
del ancho disponible (es `max-width` sin `width` fijo, así que crece con la
pantalla hasta chocar contra el tope). Esto reemplazó un bug real: antes
todo desktop (1024px en adelante) topaba parejo en `1280px`, así que un
monitor de oficina estándar de 1920×1080 —o incluso uno de 1680×1050—
dejaba cientos de píxeles vacíos a los costados. El fondo con gradiente
sigue siendo el mismo en todos los tamaños; lo único que cambia es cuánto
ancho ocupa el contenido.

### Grillas: `auto-fit`, no `auto-fill`

`.products-grid` usa `repeat(auto-fit, minmax(Npx, 1fr))` a partir de
tablet. La diferencia con `auto-fill` importa especialmente con pocos
productos: `auto-fill` reserva espacio para columnas "fantasma" aunque no
haya productos que las llenen, así que con 2 productos en una pantalla
ancha se veían dos tarjetas chicas pegadas a la izquierda con un montón de
espacio vacío al lado. `auto-fit` colapsa esas columnas vacías y deja que
las tarjetas que sí existen se estiren (`1fr`) para ocupar el ancho
disponible — con el catálogo actual (2 productos), las tarjetas se ven
grandes y centradas en vez de chicas y corridas a un costado.

### Mostrar/ocultar la navegación: una sola clase, `.app-container.app-started`

Antes, `startApp()` revelaba el `bottom-nav` seteando
`style.display = 'flex'` directamente (un estilo inline). Eso chocaba con
cualquier regla CSS que quisiera ocultarlo de nuevo en desktop (un estilo
inline siempre le gana a una regla de una hoja de estilos). Ahora
`startApp()` solo agrega una clase:

```js
document.getElementById('app-container').classList.add('app-started');
```

Y todo lo demás lo decide el CSS:

```css
.app-container.app-started .bottom-nav { display: flex; }   /* mobile (por defecto) */

@media (min-width: 768px) {
    .app-container.app-started .top-nav { display: flex; }
    .app-container.app-started .bottom-nav { display: none; }
}
```

El `.top-nav` (barra superior) está oculto por defecto y **solo aparece
después de `startApp()`**, igual que el bottom-nav — así se evita que en
desktop se pueda navegar a otra pantalla mientras el `hero-screen` todavía
está mostrándose (`showScreen()` nunca oculta `hero-screen`, solo lo hace
`startApp()`; si el top-nav fuera clickeable antes de eso, quedarían dos
pantallas superpuestas).

Los 5 destinos son los mismos que el bottom-nav (`catalog`, `explorar`,
`favoritos`, `pedidos`, `perfil`), usando los mismos `onclick` (`navigate()`
/ `goExplorar()`). El botón "Menú" del top-nav llama al mismo
`toggleSidebar()` de siempre — el sidebar deslizable no cambió, solo se
reubicó desde dónde se dispara.

`updateNavHighlight(navKey)` se generalizó para marcar `.active` en
**todos** los elementos con un `data-nav` que coincida (bottom-nav y
top-nav a la vez), en vez de buscar un solo `id`:

```js
function updateNavHighlight(navKey) {
    document.querySelectorAll('.nav-item, .top-nav-item').forEach(item => item.classList.remove('active'));
    if (navKey) {
        document.querySelectorAll(`[data-nav="${navKey}"]`).forEach(item => item.classList.add('active'));
    }
}
```

### Grillas de producto

`.products-grid` pasa de columnas fijas (`1fr 1fr`, siempre 2) a columnas
auto-ajustables con `repeat(auto-fill, minmax(Npx, 1fr))` a partir de
tablet — el número de columnas lo decide el ancho disponible, no un número
hardcodeado por dispositivo. Aplica igual a `catalog-screen`,
`explorar-screen` y `favoritos-screen` (las tres reutilizan `.products-grid`).

### Hero: de splash de app a landing page

El contenido de `#hero-screen` ahora está envuelto en `.hero-content`
(texto, input, botón — igual que antes) más un `.hero-visual` (el ícono del
cubo a gran escala, oculto en mobile). En desktop, `#hero-screen` pasa de
columna centrada a fila de dos columnas (texto a la izquierda, visual a la
derecha), y el botón "Comenzar" deja de ser `width: 100%` para ser un CTA
de ancho natural. `startApp()` sigue siendo la única forma de salir de esta
pantalla — no cambió esa lógica.

### Ficha de producto: bottom-sheet (mobile/tablet) → diálogo centrado (desktop)

El modal se reestructuró: `modal-header` + `modal-image-container` +
`modal-content` ahora están envueltos en un `.modal-body` (antes eran hijos
directos de `.product-modal`). En mobile y tablet, `.modal-body` solo
replica el mismo layout de columna que existía antes — sin cambio visual.
En desktop (1024px+), `.product-modal` pasa a ser un fondo oscuro de
backdrop (`opacity`/`pointer-events` en vez de `transform: translateY(...)`
para mostrar/ocultar) y `.modal-body` se convierte en la tarjeta centrada
(máx. 960px, dos columnas: carrusel a la izquierda, specs/colores/WhatsApp
a la derecha). Sigue siendo la misma clase `.active` la que dispara todo —
`openProduct()`/`closeProduct()` no cambiaron.

Se agregaron flechas de navegación (`goToSlide(direction)`, reutiliza
`updateSlidePosition()`) visibles solo en desktop, como complemento al
drag/swipe que ya existía (y que sigue funcionando igual en todos los
tamaños). Si el color elegido tiene una sola imagen, `renderCarousel()` le
agrega la clase `single-image` al contenedor del carrusel y las flechas se
ocultan solas vía CSS.

### Footer (`#site-footer`)

Vive como hermano de las 6 pantallas (`hero-screen` + las 5 de `screens`),
justo después de `auth-screen` en el HTML, **fuera** del array `screens` —
por eso `showScreen()` nunca lo oculta: queda siempre presente, debajo de
la pantalla que esté activa en cada momento, alcanzable con solo hacer
scroll (sin depender del sidebar). Tiene los mismos 3 links que el sidebar
("Sobre Tridi", "Envíos y Cambios", "Privacidad", vía `openInfoOverlay()`)
más los links a Instagram/Facebook. En mobile se apila en columna; en
tablet/desktop pasa a una fila (logo — links — redes).

Agregar el footer expuso un bug latente: `.bottom-nav` usaba
`position: absolute` (relativo a `.app-container`), lo cual solo
"funcionaba" porque el contenido siempre medía justo 100vh antes de que
existiera el footer. En cuanto `.app-container` pasó a medir más de una
pantalla, un `bottom-nav` absoluto se habría ido al final de *todo* el
contenido (después del footer) en vez de quedarse pegado abajo del
viewport mientras se hace scroll. Se cambió a `position: fixed` — la forma
correcta para una barra de navegación inferior persistente, y lo que ya
usan `.sidebar`, `.product-modal` y los overlays. Por eso cada pantalla
(`#catalog-screen`, `.view-screen`) y ahora también `.site-footer` tienen
`padding-bottom` reservado en mobile: para que su contenido no quede
tapado detrás de la barra fija.

## 13. Panel de administración (Decap CMS) y login con GitHub

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

- **[wrangler.jsonc](wrangler.jsonc)** (raíz del repo) — la configuración
  del Worker de Cloudflare: `name` (debe coincidir con el nombre del
  proyecto en el dashboard, `tridicatalogo`), `main` (el script de entrada,
  `src/worker.js`) y `assets` (`directory: "./catalogo"`, `binding:
  "ASSETS"`, `run_worker_first: ["/api/*"]` — esto último asegura que las
  rutas de la API pasen siempre por el script del Worker en vez de
  intentar resolverse como un archivo estático).
- **[src/worker.js](src/worker.js)** — punto de entrada del Worker: si la
  ruta pedida es `/api/auth` o `/api/callback` delega a los módulos de
  abajo; para cualquier otra ruta (`/`, `/admin/`, `/data/products.json`,
  imágenes, etc.) hace `env.ASSETS.fetch(request)`, que sirve el archivo
  estático correspondiente dentro de `catalogo/`.
- **[src/oauth-auth.js](src/oauth-auth.js)** y
  **[src/oauth-callback.js](src/oauth-callback.js)** — el "puente OAuth"
  entre Decap CMS y GitHub (código de servidor, corre en el Worker, nunca
  llega al navegador del cliente del catálogo).

> **Nota**: el modelo original de este proyecto se planeó para Cloudflare
> Pages clásico (con `Pages Functions` en una carpeta `functions/`, ruteo
> automático por nombre de archivo). Al conectar el repo, Cloudflare
> provisionó en cambio un **Worker con static assets** (dominio
> `*.workers.dev`, no `*.pages.dev`) — el reemplazo que Cloudflare viene
> empujando en lugar de Pages. La arquitectura de arriba ya refleja el
> modelo real (Workers); ver [NOTAS_TECNICAS.md](NOTAS_TECNICAS.md) punto 9
> para el detalle de esa corrección.

### Flujo de login, paso a paso

1. El usuario entra a `/admin/` y toca "Login with GitHub". Decap CMS abre
   un popup a `${base_url}/api/auth`.
2. **`oauth-auth.js`** (llamado desde `worker.js`) arma la URL de
   autorización de GitHub (`github.com/login/oauth/authorize`) con el
   `client_id` (variable `GITHUB_OAUTH_CLIENT_ID`), un `state` aleatorio
   (guardado en una cookie de corta duración, protección CSRF) y
   `redirect_uri` apuntando a `/api/callback`. Redirige el popup ahí.
3. GitHub muestra la pantalla de autorización; el usuario acepta.
4. GitHub redirige el popup a `/api/callback?code=...&state=...`.
5. **`oauth-callback.js`** valida que el `state` coincida con la cookie, y
   cambia el `code` por un `access_token` llamando a
   `github.com/login/oauth/access_token` (usando `client_id` +
   `GITHUB_OAUTH_CLIENT_SECRET`, ambos como variables del Worker — el
   secret nunca está en el código ni en el repo).
6. `oauth-callback.js` devuelve una página HTML mínima que hace `postMessage` del
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

### Variables requeridas (Worker `tridicatalogo` en Cloudflare)

Se configuran en el dashboard de Cloudflare → Workers & Pages → `tridicatalogo`
→ Settings → **Variables and Secrets** (esa opción solo aparece una vez que
el Worker tiene un `main` script real, no solo static assets — ver
[NOTAS_TECNICAS.md](NOTAS_TECNICAS.md) punto 9):

- `GITHUB_OAUTH_CLIENT_ID` — Client ID de la OAuth App de GitHub. No es
  secreto, pero igual se maneja como variable de entorno por simplicidad.
- `GITHUB_OAUTH_CLIENT_SECRET` — Client Secret de esa misma OAuth App,
  marcada como **Encrypt** (nunca committeada al repo).

Para probar esto en local sin tocar las credenciales reales, `wrangler dev`
lee un archivo `.dev.vars` (en la raíz del repo, ignorado por git) con el
mismo formato `NOMBRE=valor` por línea.
