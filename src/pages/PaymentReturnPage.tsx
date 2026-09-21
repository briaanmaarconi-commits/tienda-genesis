import { Link, useLocation, useParams } from "react-router-dom";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const PaymentReturnPage = () => {
  const { status } = useParams<{ status: string }>();
  const params = new URLSearchParams(useLocation().search);
  const saleId = params.get("sale_id");

  const config = {
    exito: { icon: CheckCircle2, color: "text-green-500", title: "¡Pago aprobado!", msg: "Recibimos tu pago. Te vamos a contactar para coordinar la entrega." },
    pendiente: { icon: Clock, color: "text-yellow-500", title: "Pago pendiente", msg: "Tu pago está siendo procesado por Mercado Pago." },
    error: { icon: XCircle, color: "text-red-500", title: "Pago no completado", msg: "El pago no pudo procesarse. Podés intentar de nuevo." },
  }[status || "pendiente"] || { icon: Clock, color: "text-muted-foreground", title: "Estado desconocido", msg: "" };

  const Icon = config.icon;

  return (
    <div className="container py-20 text-center">
      <Icon className={`mx-auto ${config.color}`} size={64} />
      <h1 className="mt-4 text-3xl font-bold">{config.title}</h1>
      <p className="mt-2 text-muted-foreground">{config.msg}</p>
      {saleId && <p className="mt-1 text-xs text-muted-foreground">Pedido #{saleId.slice(0, 8)}</p>}
      <Button asChild className="mt-6 rounded-full" size="lg"><Link to="/">Volver al inicio</Link></Button>
    </div>
  );
};

export default PaymentReturnPage;
