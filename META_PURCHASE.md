# Compras confirmadas y seguimiento de carritos compartidos

## Qué se registra

`Purchase` se envía por la API de conversiones desde el servidor. No se dispara desde el navegador ni por visitar `/pago/exito`, crear un pedido, enviar un comprobante o hacer clic en WhatsApp.

- Mercado Pago: el servidor consulta el pago con su credencial y exige `approved`, `live_mode=true`, moneda ARS e importe igual al total del pedido.
- Transferencia: después de verificar el ingreso, el administrador debe marcar el pedido **Abonado**. Los dos formularios de edición del estado guardan la confirmación y su fecha en la misma transacción.
- Se registran los nuevos pedidos creados por el checkout web a partir del despliegue. No se reconstruyen pagos históricos ni ventas cargadas directamente desde administración.
- Valor: total final del pedido, con descuento, envío y recargo. Moneda ARS. Los packs verificados contra la base usan `genesis-pack-<uuid>`, igual que el catálogo. Los artículos a medida sin pack no inventan IDs de catálogo.

## Enlaces para las consultas de WhatsApp

En **Carritos compartidos → Armar carrito**, cargar el cliente y sus productos, copiar el enlace y enviarlo en la conversación. Cada consulta debe tener su propio carrito. La lista distingue enlace pendiente, pedido creado sin pago confirmado, pago confirmado y pedido cancelado; muestra el número de pedido y si se envió Purchase a Meta.

El enlace se consume atómicamente al crear el pedido: un segundo checkout concurrente no puede adjudicarse la misma consulta. Los enlaces vencidos se rechazan. Un pedido creado no equivale a una compra pagada.

Esto vincula el carrito con el pedido dentro de la tienda. No lee mensajes de WhatsApp, no descubre quién escribió sin enlace y no garantiza atribución de anuncios de Meta. Los eventos anteriores ViewContent/Contact siguen usando IDs de producto; la coincidencia por pack de este cambio corresponde a Purchase.

## Almacenamiento y entrega

Al arrancar, el backend crea de forma aditiva e idempotente la tabla `purchase_tracking`. No modifica ni elimina ventas existentes. El usuario de PostgreSQL necesita permiso CREATE en su esquema. La aplicación falla al iniciar si no puede preparar esta tabla, para no aceptar pedidos cuya medición no podría guardar.

El checkout guarda una instantánea del total y de los IDs de pack. La primera confirmación fija `paid_at`. El identificador `purchase_<sale UUID>` y esa fecha se conservan en todos los reintentos. Una entrega aceptada se marca persistentemente; avisos repetidos y recargas no vuelven a encolarla. Un bloqueo temporal y una reserva atómica permiten procesar la cola con varias instancias. Una caída después de enviar y antes de guardar el resultado se reintenta con el mismo ID para la deduplicación de Meta.

La cola se procesa cada 30 segundos y reintenta fallos con espera creciente, hasta una hora entre intentos. No reenvía eventos de 7 días o más cambiando su fecha. No envía pedidos cancelados antes de procesarlos. Una cancelación posterior no revierte automáticamente un Purchase ya enviado; devoluciones requieren un proceso separado.

Datos compartidos: email normalizado con SHA-256 cuando es válido, ID del cliente con SHA-256, identificadores `_fbp`/`_fbc` existentes y agente del navegador. No se envían nombres, teléfonos, domicilios, notas de diseño ni tokens de carritos. Los logs guardan códigos de error, no claves ni payloads personales. Se usan los identificadores existentes; no se crea un `fbc` artificial para una conversación de WhatsApp.

## Activación en Coolify — API de génesis

Guardar exclusivamente en las variables privadas del backend:

```dotenv
META_CAPI_ENABLED=true
META_PIXEL_ID=2845894399129197
META_CAPI_ACCESS_TOKEN=CLAVE_PRIVADA_GENERADA_EN_META
META_GRAPH_VERSION=v26.0
META_TEST_EVENT_CODE=
```

Obtener la clave desde la configuración de la API de conversiones del conjunto `genesisqrweb` en Administrador de eventos. No ponerla en variables VITE, código fuente, capturas ni mensajes. El envío está deshabilitado por defecto; mientras tanto se guardan confirmaciones locales. Activar envía los pagos pendientes elegibles de los últimos 7 días registrados desde el despliegue.

Desplegar **API de génesis** y **tienda-genesis**. El diagnóstico autenticado `GET /api/admin/purchase-tracking` muestra enabled/test_mode y cantidades enviadas, pendientes y vencidas, sin exponer datos personales ni claves.

## Validación

CI ejecuta pruebas de los importes, datos normalizados, IDs, pagos pendientes/rechazados/de prueba, moneda y monto incorrectos, y antigüedad. Con PostgreSQL aislado comprueba rollback, primera fecha de pago, reintentos tras fallo y marcador persistente de entrega. Compila frontend y backend y corre las pruebas existentes.

Para verificar recepción real usar un entorno de prueba y `META_TEST_EVENT_CODE` del panel, con un pedido de prueba marcado Abonado. No marcar ventas reales sin haber cobrado ni simular una compra en producción como dato real. Quitar el código de prueba antes de medir ventas reales. Los pagos sandbox de Mercado Pago no generan Purchase con esta integración. La aceptación end-to-end queda pendiente hasta disponer de la credencial y confirmar el evento procesado en Meta.

Referencias de Meta: https://github.com/facebook/facebook-php-business-sdk/blob/main/examples/AdsPixelEventsPostCustom.php y https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/apiconfig.py
