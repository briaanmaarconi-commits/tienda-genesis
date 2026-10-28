import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LEGAL } from "@/lib/legal";

const LegalLayout = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="container max-w-3xl py-10">
    <h1 className="mb-2 text-3xl">{title}</h1>
    <p className="mb-8 text-sm text-muted-foreground">Última actualización: {LEGAL.updatedAt}</p>
    <div className="space-y-6 text-muted-foreground [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
      {children}
    </div>
  </div>
);

const Titular = () => (
  <section>
    <h2>Titular del sitio</h2>
    <ul>
      <li>Nombre comercial: {LEGAL.brand}</li>
      <li>Razón social: {LEGAL.legalName} ({LEGAL.legalNameAfip})</li>
      <li>CUIT: {LEGAL.cuit} — {LEGAL.taxCondition}</li>
      <li>Domicilio: {LEGAL.address}</li>
      <li>Teléfono: <a href={`tel:${LEGAL.phoneHref}`} className="underline">{LEGAL.phone}</a></li>
      <li>Correo electrónico: <a href={`mailto:${LEGAL.email}`} className="underline">{LEGAL.email}</a></li>
    </ul>
  </section>
);

export const PrivacyPage = () => (
  <LegalLayout title="Política de privacidad">
    <p>
      En {LEGAL.brand} ({LEGAL.website}) cuidamos los datos personales de nuestros clientes. Esta política explica qué datos
      recolectamos, para qué los usamos y cuáles son tus derechos, conforme a la Ley 25.326 de Protección de los Datos Personales
      de la República Argentina.
    </p>
    <Titular />
    <section>
      <h2>Datos que recolectamos</h2>
      <ul>
        <li>Datos de contacto: nombre, teléfono, correo electrónico y dirección de envío.</li>
        <li>Datos de la compra: productos, diseños o imágenes que nos envíes para imprimir, y el medio de pago elegido.</li>
        <li>Conversaciones por WhatsApp, Instagram, Facebook o correo electrónico.</li>
        <li>Datos de navegación: cookies y píxeles de medición (por ejemplo, Meta Pixel) para entender el uso del sitio y mostrar anuncios.</li>
      </ul>
      <p className="mt-2">No guardamos datos completos de tarjetas: los pagos se procesan a través de las plataformas de pago correspondientes.</p>
    </section>
    <section>
      <h2>Para qué usamos tus datos</h2>
      <ul>
        <li>Procesar, producir y enviar tus pedidos.</li>
        <li>Responder consultas y dar atención al cliente, incluso mediante asistentes automáticos en WhatsApp.</li>
        <li>Emitir comprobantes y cumplir obligaciones legales e impositivas.</li>
        <li>Enviarte novedades o promociones, solo si nos diste tu consentimiento. Podés darte de baja cuando quieras.</li>
      </ul>
    </section>
    <section>
      <h2>Con quién compartimos tus datos</h2>
      <p>
        Solo con los proveedores necesarios para operar: empresas de envío (Correo Argentino, Andreani u otras), plataformas de pago,
        servicios de alojamiento y mensajería (como WhatsApp de Meta). No vendemos tus datos a terceros.
      </p>
    </section>
    <section>
      <h2>Tus derechos</h2>
      <p>
        Podés solicitar el acceso, la rectificación, la actualización o la eliminación de tus datos escribiendo a{" "}
        <a href={`mailto:${LEGAL.email}`} className="underline">{LEGAL.email}</a>. Responderemos dentro de los plazos de la Ley 25.326.
        La Agencia de Acceso a la Información Pública, órgano de control de la ley, atiende las denuncias y reclamos relacionados con
        el incumplimiento de las normas sobre protección de datos personales.
      </p>
    </section>
    <section>
      <h2>Conservación y seguridad</h2>
      <p>
        Conservamos los datos mientras sean necesarios para las finalidades indicadas o por los plazos que exija la ley, y aplicamos
        medidas razonables de seguridad para protegerlos.
      </p>
    </section>
  </LegalLayout>
);

export const TermsPage = () => (
  <LegalLayout title="Términos y condiciones">
    <p>
      Estos términos regulan el uso del sitio {LEGAL.website} y las compras realizadas a {LEGAL.brand}. Al navegar el sitio o hacer
      un pedido aceptás estas condiciones.
    </p>
    <Titular />
    <section>
      <h2>Productos y precios</h2>
      <ul>
        <li>Vendemos stickers, calcos, planchas y productos impresos, estándar y personalizados.</li>
        <li>Los precios están expresados en pesos argentinos e incluyen los impuestos que correspondan. El costo de envío se informa aparte.</li>
        <li>Los precios y la disponibilidad pueden cambiar sin previo aviso; se respeta el precio vigente al momento de confirmar el pedido.</li>
        <li>Los colores pueden variar levemente respecto de lo que se ve en pantalla.</li>
      </ul>
    </section>
    <section>
      <h2>Pedidos y pagos</h2>
      <ul>
        <li>Un pedido se considera confirmado cuando se acredita el pago o la seña acordada.</li>
        <li>En productos personalizados se puede pedir una seña del 50% para comenzar la producción y el saldo antes del envío o la entrega.</li>
        <li>Medios de pago: los publicados en el sitio al momento de la compra (transferencia, plataformas de pago y otros).</li>
      </ul>
    </section>
    <section>
      <h2>Diseños enviados por el cliente</h2>
      <p>
        Al enviarnos un diseño o imagen declarás que tenés derecho a usarlo. No imprimimos material que infrinja derechos de terceros
        o que sea ilegal u ofensivo, y podemos rechazar un pedido por esos motivos devolviendo lo abonado.
      </p>
    </section>
    <section>
      <h2>Envíos</h2>
      <p>
        Enviamos a todo el país por Correo Argentino, Andreani u otros transportes. Los plazos de entrega dependen del transporte y del
        tiempo de producción informado en cada pedido. Más información en <Link to="/info" className="underline">Envíos y pagos</Link>.
      </p>
    </section>
    <section>
      <h2>Cambios, devoluciones y arrepentimiento</h2>
      <p>
        Ver la <Link to="/devoluciones" className="underline">Política de devoluciones y reembolsos</Link>.
      </p>
    </section>
    <section>
      <h2>Responsabilidad y ley aplicable</h2>
      <p>
        Estos términos se rigen por las leyes de la República Argentina, en particular la Ley 24.240 de Defensa del Consumidor. Ante
        cualquier reclamo podés contactarnos primero a {LEGAL.email} o al {LEGAL.phone}.
      </p>
    </section>
  </LegalLayout>
);

export const RefundsPage = () => (
  <LegalLayout title="Política de devoluciones y reembolsos">
    <Titular />
    <section>
      <h2>Derecho de arrepentimiento</h2>
      <p>
        Según el artículo 34 de la Ley 24.240 y el artículo 1110 del Código Civil y Comercial, en compras a distancia podés revocar la
        aceptación dentro de los 10 días corridos desde que recibiste el producto, sin costo ni necesidad de explicar el motivo.
        El producto debe devolverse sin uso y en las mismas condiciones en que lo recibiste. Los gastos de devolución corren por nuestra cuenta.
      </p>
      <p className="mt-2">
        Excepción: según el artículo 1116 del Código Civil y Comercial, este derecho no aplica a productos confeccionados según las
        especificaciones del cliente o claramente personalizados (por ejemplo, calcos con tu diseño, logo, nombre o medidas a pedido).
      </p>
    </section>
    <section>
      <h2>Productos fallados o con errores</h2>
      <p>
        Si el producto llega dañado, con fallas de impresión o distinto de lo acordado, avisanos dentro de los 10 días de recibido con
        fotos del problema. Lo reimprimimos sin cargo o te devolvemos el dinero, a tu elección.
      </p>
    </section>
    <section>
      <h2>Cómo pedir una devolución</h2>
      <ul>
        <li>Escribinos a <a href={`mailto:${LEGAL.email}`} className="underline">{LEGAL.email}</a> o por WhatsApp al {LEGAL.phone} con tu número de pedido.</li>
        <li>Te indicamos cómo enviar el producto, si corresponde.</li>
        <li>Una vez aprobada, reintegramos el importe por el mismo medio de pago dentro de los 10 días hábiles.</li>
      </ul>
    </section>
  </LegalLayout>
);
