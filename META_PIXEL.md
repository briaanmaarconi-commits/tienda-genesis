# Meta Pixel — Genesis QR

## Estado

Integración configurada con el ID real `2845894399129197`, proporcionado por el propietario. El Dockerfile lo utiliza como valor predeterminado de build; `.env.example` incluye el mismo ID para desarrollo local. No se desplegó al VPS: la recepción en Meta queda pendiente del despliegue y de Probar eventos.

El proyecto es React 18 + Vite + React Router, con API propia en `backend/`, PostgreSQL y archivos históricos de Supabase. `index.html` es el documento global y `src/components/Layout.tsx` es el layout público. La integración se monta una sola vez en `src/App.tsx`, dentro de `BrowserRouter` y fuera de `Suspense`, para medir navegación interna. El cargador inserta el script asíncrono oficial en el head.

## Activación y despliegue

1. El Dockerfile ya incluye `VITE_META_PIXEL_ID=2845894399129197`. Si Coolify define un valor para este build arg, debe coincidir: un valor vacío sobrescribe el predeterminado y desactiva el Pixel. Es un identificador público, no un token de acceso.
2. Commit de los archivos listados abajo y despliegue del frontend desde la rama elegida. El Dockerfile acepta el build arg; cambiar solamente variables del contenedor ya construido no modifica el bundle de Vite.
3. En Meta, abrir Probar eventos y visitar la home, un producto y volver a la home: debe aparecer un PageView por navegación. Repetir con Meta Pixel Helper, sin bloqueador de anuncios.
4. Confirmar que no hay otro Pixel instalado mediante GTM, inyección del servidor o configuración automática de eventos en Meta. No añadir otro snippet a index.html.

Sin ID, con ID inválido o en `npm run dev`, la integración no carga Meta. Para probar localmente el bundle de producción, usar el ID de prueba propio al compilar y `npm run preview`. Las pruebas automatizadas utilizan un ID ficticio y no hacen peticiones a Meta.

El snippet proporcionado se integra mediante el cargador existente: no se agrega un segundo script ni otro PageView en index.html. Se omite el fallback noscript global porque la tienda requiere JavaScript y ese fallback registraría también accesos directos a administración y enlaces privados, sin poder aplicar las exclusiones del router.

Se envía PageView en home, productos, ofertas, promos, lista de precios, info y nosotros. No se generan eventos explícitos en admin, carrito, carritos compartidos, retorno de pago ni rutas desconocidas. No se envían datos de clientes como parámetros ni se habilita coincidencia avanzada. El SDK, una vez cargado, permanece en la sesión; estas exclusiones no constituyen aislamiento del SDK ni un gestor de consentimiento. Se desactiva autoConfig para este Pixel.

## Puntos de instrumentación revisados (eventos todavía no agregados)

| Acción | Archivo | Evento y criterio |
|---|---|---|
| WhatsApp flotante | `src/components/WhatsAppFloat.tsx` | Contact al clic; origen `floating`. No implica conversación iniciada ni venta. |
| WhatsApp del pie | `src/components/Footer.tsx` | Contact al clic; origen `footer`. |
| Consulta por producto | `src/pages/ProductPage.tsx` | Contact en el enlace `waLink`; incluir ID/nombre/categoría del producto, sin teléfono ni mensaje. |
| Ver pulseras o entradas | `src/pages/ProductPage.tsx` | ViewContent cuando termina de cargar el producto, una vez por visita; usar `product.id`, `product.name` y categoría del catálogo. Existen referencias a los slugs `pulseras-holograficas` y `entradas`. |
| Sistema QR | Catálogo o futura página propia | No existe una ruta o componente específico del sistema QR en el código revisado. Si es un producto del catálogo, usar el mismo ProductPage; si es un servicio, instrumentar su página/CTA cuando se identifique. No inventar vistas del sistema QR en la home. |
| Agregar producto | `src/pages/ProductPage.tsx` y configurador de stickers | AddToCart después de agregar correctamente; importe real de packs y adicionales, moneda ARS. |
| Iniciar checkout | `src/pages/CartPage.tsx` | InitiateCheckout en la acción de inicio con carrito válido. |
| WhatsApp tras pedido | `src/pages/CartPage.tsx` | Distinguir apertura automática posterior al pedido de clic manual; no contarlos dos veces como nuevos contactos. |
| Compra confirmada | `backend/src/routes/mercadopago.ts` | Purchase solamente después de validar el pago y con deduplicación por pedido. No usar como prueba de compra la URL `/pago/exito`, cuyo contenido depende de la URL. |

## Archivos de esta integración

- `.env.example`: variable pública del ID.
- `Dockerfile`: variable en tiempo de build.
- `src/App.tsx`: montaje global.
- `src/components/MetaPixel.tsx`: seguimiento de navegación.
- `src/lib/metaPixel.ts`: cargador único y PageView.
- `src/test/metaPixel.test.tsx`: desactivación, navegación, duplicados y exclusiones.
- `META_PIXEL.md`: activación, despliegue y mapa de eventos.

## Revisión del servidor

El 2 de octubre de 2026 (Argentina), genesisqr.com respondió HTTP 200 con Nginx. Se verificó acceso SSH de lectura al VPS y Coolify activo. La imagen del frontend usa el commit `3b999fec4a626a98254e7126f827c1e58f50f160`, coincidente con la base descargada. Nginx sirve `dist`, redirige rutas SPA a index.html y conecta `/api/` y `/files/` con `genesis-api:8081`. No se modificaron servicios, bases de datos, credenciales ni configuración remota.

## Validación local

Build de producción con el ID real correcto; 4 pruebas aprobadas; comprobación de tipos y diff sin errores. La recepción real en Meta todavía no se verificó porque no se desplegó.
