import { Link } from "react-router-dom";
import { Facebook, Instagram, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useSiteSettings } from "@/hooks/useShopData";
import { Skeleton } from "@/components/ui/skeleton";

const Footer = () => {
  const { data: s, isLoading } = useSiteSettings();

  const siteName = isLoading ? (
    <Skeleton className="inline-block h-5 w-32 rounded-md" />
  ) : (
    <>{s?.site_name || "Tienda Genesis"}</>
  );

  return (
    <footer className="mt-20 bg-primary text-primary-foreground">
      <div className="container grid gap-10 py-12 md:grid-cols-4">
        <div>
          <h3 className="text-xl font-extrabold">{siteName}</h3>
          <p className="mt-2 text-sm opacity-90">Productos de calidad, envíos a todo el país.</p>
          <div className="mt-4 flex gap-3">
            {s?.instagram_url && <a href={s.instagram_url} aria-label="Instagram" className="rounded-full bg-primary-foreground/10 p-2 hover:bg-primary-foreground/20"><Instagram size={18} /></a>}
            {s?.facebook_url && <a href={s.facebook_url} aria-label="Facebook" className="rounded-full bg-primary-foreground/10 p-2 hover:bg-primary-foreground/20"><Facebook size={18} /></a>}
            {s?.whatsapp && <a href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}`} aria-label="WhatsApp" className="rounded-full bg-primary-foreground/10 p-2 hover:bg-primary-foreground/20"><MessageCircle size={18} /></a>}
          </div>
        </div>
        <div>
          <h4 className="mb-3 font-semibold">Tienda</h4>
          <ul className="space-y-2 text-sm opacity-90">
            <li><Link to="/" className="hover:underline">Inicio</Link></li>
            <li><Link to="/promos" className="hover:underline">Promos</Link></li>
            <li><Link to="/lista-de-precios" className="hover:underline">Lista de precios</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold">Información</h4>
          <ul className="space-y-2 text-sm opacity-90">
            <li><Link to="/info" className="hover:underline">Envíos y pagos</Link></li>
            <li><Link to="/nosotros" className="hover:underline">Conocenos</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold">Contacto</h4>
          <ul className="space-y-2 text-sm opacity-90">
            {s?.phone && <li className="flex items-center gap-2"><Phone size={16} /> {s.phone}</li>}
            {s?.email && <li className="flex items-center gap-2"><Mail size={16} /> {s.email}</li>}
            {s?.address && <li className="flex items-center gap-2"><MapPin size={16} /> {s.address}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/20">
        <div className="container py-4 text-center text-xs opacity-80">
          © {new Date().getFullYear()} {siteName}. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
