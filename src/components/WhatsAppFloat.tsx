import { MessageCircle } from "lucide-react";
import { useSiteSettings } from "@/hooks/useShopData";
import { trackWhatsAppContact } from "@/lib/metaPixel";

const WhatsAppFloat = () => {
  const { data } = useSiteSettings();
  if (!data?.whatsapp) return null;
  const num = data.whatsapp.replace(/\D/g, "");
  return (
    <a
      href={`https://wa.me/${num}`}
      onClick={() => trackWhatsAppContact("floating")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-[hsl(142_70%_45%)] text-white shadow-lg transition-transform hover:scale-110"
    >
      <MessageCircle />
    </a>
  );
};

export default WhatsAppFloat;
