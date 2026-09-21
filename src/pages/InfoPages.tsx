import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useProducts, useSiteSettings } from "@/hooks/useShopData";
import { formatPrice } from "@/lib/helpers";

const parseFaqs = (value: any): { question: string; answer: string }[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value as { question: string; answer: string }[];
  try {
    const parsed = JSON.parse(value as string);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const PriceListPage = () => {
  const { data: products } = useProducts();
  return (
    <div className="container py-10">
      <h1 className="mb-6 text-3xl">Lista de precios</h1>
      <div className="overflow-hidden rounded-2xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted">
            <tr><th className="p-3">Producto</th><th className="p-3">Categoría</th><th className="p-3 text-right">Precio</th></tr>
          </thead>
          <tbody>
            {(products ?? []).map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3 text-muted-foreground">{p.category?.name || "—"}</td>
                <td className="p-3 text-right font-bold text-primary">{formatPrice(Number(p.price))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const InfoPage = () => {
  const { data: s } = useSiteSettings();
  const faqs = parseFaqs(s?.info_faqs);
  return (
    <div className="container py-10 max-w-3xl">
      <h1 className="mb-6 text-3xl">Información útil</h1>
      {s?.info_content && (
        <div className="mb-6 whitespace-pre-line text-muted-foreground">{s.info_content}</div>
      )}
      <Accordion type="single" collapsible className="rounded-2xl border bg-card px-6">
        {faqs.length > 0 ? (
          faqs.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger>{f.question}</AccordionTrigger>
              <AccordionContent>{f.answer}</AccordionContent>
            </AccordionItem>
          ))
        ) : (
          <>
            <AccordionItem value="envios"><AccordionTrigger>¿Cómo son los envíos?</AccordionTrigger>
              <AccordionContent>Enviamos a todo el país. Demora 3 a 7 días hábiles.</AccordionContent></AccordionItem>
            <AccordionItem value="pagos"><AccordionTrigger>¿Qué medios de pago aceptan?</AccordionTrigger>
              <AccordionContent>Tarjeta, transferencia bancaria y efectivo.</AccordionContent></AccordionItem>
            <AccordionItem value="cambios"><AccordionTrigger>¿Hacen cambios o devoluciones?</AccordionTrigger>
              <AccordionContent>Sí, dentro de los 10 días de recibido.</AccordionContent></AccordionItem>
          </>
        )}
      </Accordion>
    </div>
  );
};

export const PromosPage = () => (
  <div className="container py-10">
    <h1 className="mb-6 text-3xl">Promos del mes</h1>
    <p className="text-muted-foreground">Próximamente cargaremos promociones.</p>
  </div>
);

export const AboutPage = () => {
  const { data: s } = useSiteSettings();
  return (
    <div className="container py-10 max-w-3xl">
      <h1 className="mb-6 text-3xl">Conocenos</h1>
      {s?.about_content ? (
        <div className="whitespace-pre-line text-muted-foreground">{s.about_content}</div>
      ) : (
        <p className="text-muted-foreground">Editá esta sección desde el panel de administración.</p>
      )}
    </div>
  );
};

