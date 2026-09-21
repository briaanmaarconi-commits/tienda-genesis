import { Link } from "react-router-dom";
import { Copy, ExternalLink, Image, MessageCircle, Package, Settings, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const items = [
  { to: "/admin/sitio", label: "Marca / Sitio", desc: "Logo, nombre, contacto, redes", Icon: Settings },
  { to: "/admin/banners", label: "Banners", desc: "Slides del home", Icon: Image },
  { to: "/admin/productos", label: "Productos", desc: "Crear y editar productos", Icon: Package },
];

const AdminHome = () => {
  const url = typeof window !== "undefined" ? window.location.origin : "";
  const message = `Mirá nuestra tienda online: ${url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Mi tienda", text: message, url });
      } catch {/* cancelado */}
    } else {
      copy();
    }
  };

  const wapp = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const canShare = typeof navigator !== "undefined" && !!(navigator as any).share;

  return (
    <div>
      <h1 className="text-3xl font-bold">Panel</h1>
      <p className="mt-2 text-muted-foreground">Editá todo el contenido de tu tienda desde acá.</p>

      <div className="mt-6 rounded-2xl border bg-card p-6">
        <div className="flex items-start gap-3">
          <Share2 className="mt-1 text-primary" />
          <div className="flex-1">
            <h2 className="font-bold">Compartir tu tienda</h2>
            <p className="text-sm text-muted-foreground">
              Tu tienda es pública. Cualquiera con el link puede verla sin iniciar sesión.
            </p>
          </div>
        </div>
        <div className="mt-4 break-all rounded-lg bg-muted px-3 py-2 text-sm font-medium">
          {url}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={copy} variant="default" size="sm">
            <Copy /> Copiar link
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={wapp} target="_blank" rel="noreferrer">
              <MessageCircle /> WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink /> Abrir tienda
            </a>
          </Button>
          {canShare && (
            <Button onClick={share} variant="outline" size="sm">
              <Share2 /> Compartir...
            </Button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Para que los últimos cambios estén live, tocá <strong>Publish</strong> arriba a la derecha (o <strong>...</strong> → Publish en celular).
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {items.map(({ to, label, desc, Icon }) => (
          <Link key={to} to={to} className="group rounded-2xl border bg-card p-6 transition-shadow hover:shadow-[var(--shadow-card)]">
            <Icon className="text-primary" />
            <h3 className="mt-3 font-bold group-hover:text-primary">{label}</h3>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminHome;
