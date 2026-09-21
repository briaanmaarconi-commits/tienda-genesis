# Fotos Clásicas: elegir varios packs de unidades

Hoy el producto tiene un solo "pack" de $0 y las unidades se eligen como una opción única (1, 10, 50 o 100) que multiplica el precio del tamaño. Por eso solo se puede elegir un pack por compra y la cantidad de fotos a subir queda en 1.

## Qué va a cambiar

- Las unidades pasan a ser packs reales: **x1, x10, x50, x100**, cada uno con su contador +/- como en los demás productos, para poder combinar (ej: 1 pack x50 + 2 packs x10 = 70 fotos).
- El **tamaño** (10x15, 13x18, 15x20, 20x30) sigue siendo una elección única y pasa a cobrarse **por unidad**.
- Precio final = precio del tamaño elegido × cantidad total de unidades. Ejemplo: 10x15 ($500) con 70 unidades = $35.000.
- El bloque de **subir fotos** pide automáticamente la cantidad total de unidades seleccionadas (70 en el ejemplo).
- El detalle en el carrito y en el panel de ventas muestra cada pack por separado con su tamaño.

## Detalles técnicos

Cambio de datos en el producto `fotos-clasicas`, sin tocar la lógica de la página de producto (ya soporta multi-pack, addons `per_unit` y conteo de fotos):

- Reemplazar el pack único `unidad` por cuatro filas en `product_packs`: `units` 1/10/50/100, `price` 0, `photos_required` igual a `units`, `label` "1 unidad", "10 unidades", etc.
- Marcar el grupo de addons "tamaños" con `per_unit = true` (sigue `required`, no multiplicador).
- Desactivar/eliminar el grupo multiplicador "unidades" y sus opciones.

Verificación con Playwright en la página del producto: combinar packs, revisar el precio total y que el uploader pida la cantidad correcta de fotos.
