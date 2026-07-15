# Tridi - Catálogo Online

Catálogo web para **Tridi**, un negocio de impresiones 3D. Es una página web
que simula una app móvil: el cliente entra, ve productos (llaveros, figuras
decorativas, etc.), elige color, y hace su pedido enviando un mensaje
prellenado por **WhatsApp**. No hay backend ni base de datos propia: el
catálogo vive en un archivo JSON versionado en git, y hay un panel de
administración (Decap CMS) para editarlo sin tocar código.

- **Sitio en vivo**: https://tridicatalogo.pages.dev
- **Panel de administración**: https://tridicatalogo.pages.dev/admin/ (ver [catalogo/ADMIN.md](catalogo/ADMIN.md))
- **Repo**: [github.com/AlexProyer/TridiCatalogoOnline](https://github.com/AlexProyer/TridiCatalogoOnline), desplegado automáticamente por Cloudflare Pages (proyecto `tridicatalogo`)

Este README es el punto de partida. Para el detalle técnico, ver:

- **[ARQUITECTURA.md](ARQUITECTURA.md)** — cómo funciona el código por dentro (pantallas, estado, carrusel, WhatsApp, compartir).
- **[GUIA_PRODUCTOS.md](GUIA_PRODUCTOS.md)** — cómo agregar/editar productos, colores e imágenes del catálogo (a mano, editando el JSON).
- **[catalogo/ADMIN.md](catalogo/ADMIN.md)** — cómo usar el panel de administración (`/admin/`) sin tocar código, pensado para el dueño del negocio.
- **[NOTAS_TECNICAS.md](NOTAS_TECNICAS.md)** — cosas raras o pendientes que se encontraron al leer el código (bugs, placeholders, código muerto).

## ¿Qué hace la app?

- Muestra un catálogo de productos en tarjetas (imagen, título, precio).
- Al tocar un producto se abre una ficha con carrusel de fotos (deslizable
  con el dedo o el mouse), descripción, especificaciones (material, tamaño)
  y selector de color.
- El usuario puede marcar productos como **favoritos** (❤️).
- Al pedir un producto, se genera un mensaje de texto con los datos del
  pedido y se abre WhatsApp para enviarlo directamente al número del negocio.
- Hay una sección de **"Mis Pedidos"** (historial local) y un **"Perfil"**
  simple con un sistema de puntos.
- Para entrar a Favoritos, Pedidos o Perfil, la app pide un nombre (no hay
  contraseña ni backend real — es solo para identificar al usuario en su
  propio navegador).

## Cómo ejecutarlo

No requiere instalación, `npm`, ni compilación. Es HTML/CSS/JS plano, **pero
necesita servirse por HTTP** (no abrir el archivo directamente con doble
clic): la app carga el catálogo con `fetch('data/products.json')`, y los
navegadores bloquean `fetch` sobre archivos abiertos con `file://` (da error
de CORS / "Failed to fetch"). Con un servidor estático simple alcanza:

```
npx serve catalogo
```

o la extensión "Live Server" de VS Code sobre la carpeta `catalogo/`. En
producción esto lo resuelve automáticamente Cloudflare Pages (o cualquier
hosting estático), que siempre sirve los archivos por HTTP.

El sitio en sí no necesita variables de entorno. El panel de administración
(`/admin/`) sí depende de dos variables de entorno configuradas en Cloudflare
Pages (`GITHUB_OAUTH_CLIENT_ID` y `GITHUB_OAUTH_CLIENT_SECRET`) — ver
[ARQUITECTURA.md](ARQUITECTURA.md) sección 12. Lo otro "configurable" a mano
es el número de WhatsApp, ver [GUIA_PRODUCTOS.md](GUIA_PRODUCTOS.md).

## Estructura de carpetas

```
TridiCatalogoOnline/                 (raíz del repo de GitHub)
├── functions/
│   └── api/
│       ├── auth.js         Cloudflare Pages Function: arranca el login OAuth con GitHub
│       └── callback.js     Cloudflare Pages Function: recibe el token y se lo pasa al panel admin
└── catalogo/                        (Build output directory configurado en Cloudflare Pages)
    ├── index.html            Toda la estructura HTML de la app (una sola página)
    ├── ADMIN.md              Guía simple del panel de administración (sin tecnicismos)
    ├── css/
    │   └── style.css         Todo el estilo visual (tema oscuro/morado, layout, animaciones)
    ├── js/
    │   └── app.js             Toda la lógica: estado, navegación, carrusel, WhatsApp (carga el catálogo desde data/products.json)
    ├── data/
    │   └── products.json      El catálogo de productos: { "products": [...] } — editable a mano o desde /admin/
    ├── admin/
    │   ├── index.html         Carga Decap CMS (el panel de administración)
    │   └── config.yml         Define el formulario del panel y a qué archivo/repo escribe
    └── assets/
        └── images/
            ├── gato/           Fotos del producto "Gato geométrico"
            └── llavero/        Foto genérica del producto "Llavero personalizado"
```

`functions/` vive en la **raíz del repo** (no dentro de `catalogo/`) porque
Cloudflare Pages busca las Functions relativas al "Root directory" del
proyecto, que es distinto del "Build output directory" (`catalogo/`, que es
lo que efectivamente se sirve como sitio). Ver
[ARQUITECTURA.md](ARQUITECTURA.md) sección 12 para el detalle del panel
admin y el flujo de OAuth.

No hay `package.json` ni carpetas de build (`dist/`, `node_modules/`, etc.)
— el sitio en sí sigue siendo HTML/CSS/JS plano; lo único con código de
servidor son las dos Cloudflare Pages Functions del login.

## Dependencias externas

Cargadas por CDN directamente en `index.html`, sin instalación:

- **Google Fonts** (tipografía "Poppins").
- **Font Awesome 6.4.0** (todos los íconos: corazón, casa, brújula, etc.).

## Tecnologías usadas

- HTML5 + CSS3 (sin frameworks de estilos).
- JavaScript "vanilla" (sin frameworks como React/Vue, sin build tools).
- `localStorage` del navegador como única forma de persistencia de datos.
- API de WhatsApp (`https://wa.me/...`) para el flujo de pedido.
- Web Share API (`navigator.share`) para compartir productos.
