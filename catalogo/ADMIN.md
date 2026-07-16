# Cómo usar el panel de administración de Tridi

Esta guía es para vos, sin necesidad de saber programar. Explica cómo entrar
al panel, agregar un producto, cambiar un precio y subir fotos.

## Entrar al panel

1. Abrí en el navegador: **https://tridicatalogo.alexbuitrago156.workers.dev/admin/**
2. Hacé clic en **"Login with GitHub"**.
3. Se abre una ventana de GitHub pidiendo autorizar el acceso — iniciá sesión
   con tu cuenta de GitHub si te lo pide, y aceptá.
4. Vas a ver el panel con una sección llamada **"Productos"** en el menú de
   la izquierda.

Si alguna vez ves un mensaje de error al loguearte, cerrá la ventana e
intentá de nuevo. Si persiste, revisá con quien te ayudó a configurar el
panel (puede ser un tema de configuración en Cloudflare, no de tu usuario).

## Importante: acá los cambios no se publican solos

Este panel está configurado en modo **"borrador + publicar"**. Esto quiere
decir que:

1. Cuando editás algo y le das **"Save" / "Guardar"**, el cambio queda
   guardado como **borrador**, todavía no se ve en la página real.
2. Para que el cambio se vea en el sitio en vivo, tenés que ir a la sección
   de arriba a la izquierda que dice algo como **"Editorial Workflow"** (o
   el ícono con los borradores pendientes), abrir tu cambio, y apretar
   **"Publish" / "Publicar"**.
3. Recién ahí, en 1-2 minutos, el cambio aparece en
   [tridicatalogo.alexbuitrago156.workers.dev](https://tridicatalogo.alexbuitrago156.workers.dev).

Esto es a propósito: te da la chance de revisar antes de que un error de
tipeo (un precio mal puesto, por ejemplo) se vea en el sitio real.

## Agregar un producto nuevo

1. Entrá a **"Productos"** en el menú de la izquierda.
2. Vas a ver la lista de productos actuales. Al final de la lista hay un
   botón para **agregar un nuevo elemento** dentro de "Productos".
3. Completá los campos:
   - **ID interno**: un nombre corto sin espacios ni tildes, por ejemplo
     `taza_personalizada`. Es solo para uso interno, no lo va a ver el
     cliente. **Usá uno distinto para cada producto.**
   - **Nombre del producto**: el nombre que va a ver el cliente.
   - **Precio (COP)**: solo el número, sin puntos ni el signo `$`. Por
     ejemplo, para $45.000 escribí `45000`.
   - **Categoría**: por ejemplo "Decoración", "Llaveros", "Recuerdos", "Regalos".
   - **Descripción**: el texto que se ve al abrir el producto.
   - **Material** y **Tamaño**: texto libre, por ejemplo "PLA Premium" y "10 cm".
   - **Foto principal**: la foto que se ve en la grilla del catálogo (ver
     abajo "Subir fotos").
   - **Colores disponibles**: agregá uno o más colores, cada uno con:
     - Nombre del color (ej: "Blanco").
     - El color en sí (elegís de una paleta o escribís el código).
     - Una o más fotos de ese color específico (las que se ven al deslizar
       en la ficha del producto).
4. Dale **"Save"**, y después **"Publish"** (ver sección de arriba) para que
   se vea en el sitio real.

## Cambiar el precio (o cualquier otro dato) de un producto existente

1. Entrá a **"Productos"**.
2. Hacé clic en el producto que querés editar (se identifican por nombre y precio en la lista).
3. Cambiá el campo que necesites (por ejemplo, "Precio (COP)").
4. Dale **"Save"** y después **"Publish"**.

## Subir fotos

Cuando estés en un campo de foto (la "Foto principal" de un producto, o una
foto dentro de un color):

1. Hacé clic en el campo de la foto — se abre una ventana para elegir una
   imagen.
2. Podés **subir una foto nueva desde tu computadora** (botón para elegir
   archivo) o elegir una que ya se haya subido antes.
3. Una vez subida, la foto queda seleccionada en ese campo automáticamente
   — no hace falta escribir ninguna ruta ni nombre de archivo a mano.

**Recomendación**: antes de subir una foto, ponele un nombre descriptivo en
tu computadora (por ejemplo `taza-personalizada-azul.jpg` en vez de
`IMG_2034.jpg`). Todas las fotos que subís desde el panel quedan juntas en
una misma carpeta del sitio, así que un nombre claro ayuda a encontrarlas
después si hace falta.

## Quitar un producto

1. Entrá a **"Productos"**, abrí el producto que querés eliminar.
2. Buscá la opción de eliminar ese elemento de la lista (un ícono de
   tacho de basura o "Remove", normalmente arriba a la derecha de ese
   producto dentro del formulario).
3. Guardá y publicá los cambios como siempre.

## ¿Y si algo sale mal?

- Si guardaste un cambio por error y todavía no lo publicaste, podés
  entrar al borrador pendiente y editarlo de nuevo antes de publicar, o
  descartarlo.
- Si publicaste algo por error, simplemente volvé a editar ese mismo campo
  con el valor correcto, guardá y publicá de nuevo — es como cualquier
  corrección normal.
- Este panel no puede "romper" la página de forma permanente: en el peor
  caso, edita el mismo archivo de datos del catálogo, así que un error se
  corrige de la misma manera en que se cargó.
