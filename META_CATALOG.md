# Catálogo de Meta y WhatsApp

URL pública después de desplegar: https://genesisqr.com/api/catalog/meta.xml

El backend consulta productos activos en cada descarga. Publica un artículo por pack, con ID estable `genesis-pack-<uuid del pack>`, moneda ARS, imagen principal y enlace que selecciona ese pack. No se usa una copia manual de precios ni requiere credenciales de Meta.

El precio corresponde a un pack con las primeras opciones activas de los grupos obligatorios, igual que la selección inicial de la tienda. Incluye adicionales por unidad, fijos y multiplicadores. El título describe esa configuración. Los extras opcionales, el envío y los recargos del medio de pago no se incluyen. Se usa el precio que cobra la tienda, sin inventar descuentos a partir de precios tachados. Las calcos configurables y otros productos de tipo distinto de `standard` quedan fuera.

La tienda permite pedir productos activos sin descontar inventario; por eso el catálogo los indica disponibles para pedir (`in stock`). Si se implementa control de existencias, actualizar también esta regla. No se exportan costos, datos de clientes ni datos internos de pedidos.

Si falta una imagen, precio válido u opción obligatoria, hay una falla de base de datos o el resultado está vacío, el endpoint devuelve 503 y registra el motivo en el backend. No entrega un catálogo vacío como actualización exitosa.

## Validación y despliegue

1. `npm ci --prefix backend` y `npm run build --prefix backend`.
2. `node --test backend/tests/metaCatalog.test.mjs`.
3. `npm run test` y `npm run build` para la selección del pack en la web.
4. Desplegar **API de génesis** y **tienda-genesis** desde la versión que contiene estos cambios. No hay migración de base de datos ni nuevas variables. Se usa `FRONTEND_ORIGIN` para los enlaces; debe ser `https://genesisqr.com` en producción.
5. Abrir la URL XML: debe devolver HTTP 200 y artículos. Abrir enlaces de fotos, pulseras y entradas y comprobar pack, opciones y subtotal.

## Cambio de origen en Meta

Conservar el catálogo conectado `Catalog_Products`. Antes de modificarlo, guardar/exportar sus artículos actuales y anotar la URL anterior:

`https://genesisimpresionesar.empretienda.com.ar/facebook/catalogo-facebook.xml`

En el origen existente “Nueva lista de datos para Catalog_Products”, cambiar la URL de descarga por la nueva URL, conservar la frecuencia cada hora y solicitar actualización. No agregar un segundo origen con los mismos productos. Comprobar los diagnósticos y el número de artículos importados antes de considerar terminada la migración.

Los IDs de Empretienda no se han equiparado a los UUID nuevos: una carga completa de reemplazo retirará los artículos anteriores ausentes del archivo. Los enlaces guardados a artículos antiguos pueden dejar de funcionar. Conservar el catálogo mantiene su conexión con WhatsApp, pero no conserva la identidad de cada artículo viejo. Si Meta rechaza el archivo, mantener/restaurar la URL anterior y revisar el diagnóstico antes de borrar productos.

Los cambios de precios aparecen después de la siguiente descarga programada y el procesamiento de Meta, no instantáneamente. La lista de productos debe aprobarse también según las políticas de Meta.

## Pixel

Este feed no modifica el Pixel. Los eventos actuales usan IDs de producto, mientras el catálogo usa IDs de pack. Antes de campañas dinámicas que requieran coincidencias de catálogo, se debe instrumentar el ID del pack realmente seleccionado; no suponer que el catálogo y esos eventos ya coinciden. Purchase y API de conversiones son trabajos independientes.
