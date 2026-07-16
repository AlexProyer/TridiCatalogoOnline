# Guía práctica: agregar y editar productos

Esta guía es para quien necesite mantener el catálogo (agregar productos
nuevos, cambiar precios, agregar fotos) sin necesariamente entender toda la
arquitectura. Para el detalle técnico completo ver
[ARQUITECTURA.md](ARQUITECTURA.md).

Todo el catálogo vive en **un solo lugar**: el archivo
[catalogo/data/products.json](catalogo/data/products.json). Ya no hay que
tocar `catalogo/js/app.js` para agregar, editar o quitar productos — `app.js`
solo carga este archivo con `fetch()` al iniciar la app.

**Hay dos formas de editar el catálogo:**

1. **Desde el panel de administración** (`/admin/`) — recomendado para el
   día a día, no requiere saber de código ni de JSON. Ver
   [catalogo/ADMIN.md](catalogo/ADMIN.md).
2. **Editando `products.json` a mano** — útil para cambios masivos, o si el
   panel no está disponible por algún motivo. El resto de esta guía explica
   esta segunda forma.

## 1. Agregar un producto nuevo (editando el JSON a mano)

El archivo tiene esta forma general — un objeto con una clave `"products"`
que contiene la lista de productos:

```json
{
    "products": [
        { "id": "gato_geo", "...": "..." },
        { "id": "llavero_pers", "...": "..." }
    ]
}
```

Copiar este bloque dentro del array `products` (respetando la coma entre
productos) y completar cada campo:

```json
{
    "id": "nombre_unico_sin_espacios",
    "title": "Nombre visible del producto",
    "price": 25000,
    "category": "Decoración",
    "desc": "Descripción del producto que aparece en la ficha de detalle.",
    "material": "PLA Premium",
    "size": "10 cm",
    "mainImage": "assets/images/carpeta/imagen-principal.jpeg",
    "colors": [
        {
            "name": "Blanco",
            "hex": "#ffffff",
            "images": [
                "assets/images/carpeta/blanco-1.jpeg",
                "assets/images/carpeta/blanco-2.jpeg"
            ]
        }
    ]
}
```

Explicación de cada campo:

- `id` — identificador único interno (no se muestra). Debe ser distinto para cada producto.
- `title` — nombre visible en la tarjeta y en la ficha.
- `price` — número entero, sin puntos ni signo de pesos (se formatea solo como `$25.000`).
- `category` — texto libre, se muestra como etiqueta.
- `desc` — descripción que aparece en la ficha de detalle.
- `material` / `size` — se muestran en la ficha, como texto libre.
- `mainImage` — foto que se ve en la tarjeta del catálogo.
- `colors` — lista de colores; cada uno con `name`, `hex` (color del círculo selector) e `images` (fotos del carrusel **para ese color específico**, puede ser 1 o varias).

Notas importantes:

- `products.json` es JSON estricto: todas las claves y strings van entre
  comillas dobles `"..."`, no se permiten comentarios (`//`), y no puede
  quedar una coma después del último elemento de un array u objeto.
- Si un producto tiene más de 5 colores, la ficha solo muestra 5 "dots" y
  agrega automáticamente un enlace "Ver todos" que abre la lista completa
  — no hay que hacer nada extra para eso.
- Después de editar `products.json`, alcanza con recargar la página — no
  hace falta tocar `app.js` ni reiniciar nada.

## 2. Dónde colocar las imágenes

Las imágenes están organizadas por producto dentro de
`catalogo/assets/images/`, por ejemplo:

```
catalogo/assets/images/
├── gato/
│   ├── gato_rosado_basecelular.jpeg
│   ├── gato_rosado_basecelular1.jpeg
│   ├── gato_rosado_basecelular2.jpeg
│   └── gato_rosado_basecelular3.jpeg
└── llavero/
    └── general.jpeg
```

Recomendación: crear una subcarpeta por producto (`assets/images/<nombre-producto>/`)
y poner ahí todas sus fotos (principal + una por color).

**Cuidado con mayúsculas y minúsculas**: la ruta que se escribe en
`products.json` debe coincidir **exactamente** con el nombre real de la
carpeta y el archivo, incluyendo mayúsculas/minúsculas. En Windows esto
normalmente no da error, pero el hosting de producción (Cloudflare Workers)
corre sobre Linux, que sí distingue mayúsculas de minúsculas — usar siempre
minúsculas en carpetas y archivos nuevos evita este problema (ver
[NOTAS_TECNICAS.md](NOTAS_TECNICAS.md) por el caso real que ya se corrigió).

## 3. Editar un producto existente

Buscar el producto por su `id` o `title` dentro del array `products` en
`catalogo/data/products.json` y modificar directamente los campos (`price`,
`desc`, `colors`, etc.). Los cambios se reflejan apenas se recarga la
página — no hace falta reiniciar nada ni compilar.

## 4. Cambiar el número de WhatsApp

El número de WhatsApp **no** está en `products.json` — sigue en
[catalogo/js/app.js](catalogo/js/app.js), al inicio del archivo:

```js
const WHATSAPP_NUMBER = "573174271275";
```

Reemplazar por el número real del negocio, **con código de país y sin el
símbolo `+`** (por ejemplo, Colombia: `57` + número, todo junto).

## 5. Quitar un producto

Simplemente eliminar su objeto completo del array `products` en
`products.json` (incluyendo la coma que lo separaba del siguiente
elemento). Si el producto tenía likes o pedidos guardados por algún usuario
en su `localStorage`, esos registros quedan "huérfanos" pero no rompen
nada: las pantallas de Favoritos/Pedidos ya validan que el producto siga
existiendo antes de mostrarlo (`productsDB.find(...)`).

## 6. Si el catálogo no carga

`app.js` carga `products.json` con `fetch()` al iniciar la app. Si ese
archivo tiene un error de sintaxis JSON (una coma de más, comillas simples en
vez de dobles, etc.) o no se pudo descargar, la app va a mostrar un mensaje
de error legible en vez de una pantalla en blanco ("⚠️ No se pudo cargar el
catálogo de productos..."). Si ves ese mensaje, revisar que `products.json`
sea JSON válido — se puede validar rápido pegando el contenido en cualquier
validador de JSON online, o corriendo `node -e "require('./catalogo/data/products.json')"`
desde la carpeta del proyecto.
