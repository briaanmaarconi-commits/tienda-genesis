import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/helpers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Loader2, ShoppingCart, Upload, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  useStickerMaterials,
  useStickerFinishes,
  useStickerShapes,
  useStickerSizes,
  useStickerQuantities,
  computeStickerPrice,
  type CustomStickerConfig,
} from "@/hooks/useCustomSticker";
import shapeCircular from "@/assets/shapes/circular.png.asset.json";
import shapeCuadrado from "@/assets/shapes/cuadrado.png.asset.json";
import shapeRectangular from "@/assets/shapes/rectangular.png.asset.json";
import shapeSilueta from "@/assets/shapes/silueta.png.asset.json";

const shapeIconFor = (name: string): string | null => {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (n.includes("circ") || n.includes("redond")) return shapeCircular.url;
  if (n.includes("cuadr")) return shapeCuadrado.url;
  if (n.includes("rect")) return shapeRectangular.url;
  if (n.includes("silu") || n.includes("contorn") || n.includes("troquel")) return shapeSilueta.url;
  return null;
};

type Props = {
  product: { slug: string; name: string };
};

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPTED = [
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
  "application/pdf",
  "application/postscript",
  "application/illustrator",
  "application/octet-stream",
];

export default function CustomStickerConfigurator({ product }: Props) {
  const { data: materials = [], isLoading: lm } = useStickerMaterials();
  const { data: finishes = [], isLoading: lf } = useStickerFinishes();
  const { data: shapes = [], isLoading: lsh } = useStickerShapes();
  const { data: sizes = [], isLoading: lsz } = useStickerSizes();
  const { data: quantities = [], isLoading: lq } = useStickerQuantities();
  const { add } = useCart();

  const [materialId, setMaterialId] = useState("");
  const [finishId, setFinishId] = useState("");
  const [shapeId, setShapeId] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [quantityId, setQuantityId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (finishes.length && !finishId) {
      setFinishId(finishes[0].id);
    }
  }, [finishes, finishId]);

  const material = materials.find((m: any) => m.id === materialId);
  const finish = finishes.find((f: any) => f.id === finishId);
  const shape = shapes.find((s: any) => s.id === shapeId);
  const size = sizes.find((s: any) => s.id === sizeId);
  const quantity = quantities.find((q: any) => q.id === quantityId);

  const price = useMemo(() => {
    if (!material || !size || !quantity) return 0;
    const finishStub = finish ?? { id: "none", name: "Estándar", surcharge: 0 };
    return computeStickerPrice({ material, finish: finishStub as any, size, quantity });
  }, [material, finish, size, quantity]);

  const loading = lm || lf || lsh || lsz || lq;
  const complete = !!(material && shape && size && quantity);

  const handleFile = (f: File | null) => {
    if (!f) return setFile(null);
    if (f.size > MAX_FILE_BYTES) {
      toast.error("El archivo supera 20MB");
      return;
    }
    const ok =
      ACCEPTED.includes(f.type) ||
      /\.(ai|eps|pdf|jpe?g|png|svg|webp)$/i.test(f.name);
    if (!ok) {
      toast.error("Tipo de archivo no permitido");
      return;
    }
    setFile(f);
  };

  const addToCart = async () => {
    if (!complete) return;
    setUploading(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let imageUrl: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${product.slug}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("custom-sticker-uploads")
          .upload(path, file, { contentType: file.type || undefined });
        if (error) throw error;
        // Private bucket: keep the object path, admins get signed URLs.
        fileUrl = path;
        fileName = file.name;
      }
      const finishForConfig = finish ?? { id: "none", name: "Estándar", surcharge: 0 };
      const config: CustomStickerConfig = {
        material: { id: material!.id, name: material!.name, base_price: Number(material!.base_price) },
        finish: { id: finishForConfig.id, name: finishForConfig.name, surcharge: Number(finishForConfig.surcharge) },
        shape: { id: shape!.id, name: shape!.name },
        size: {
          id: size!.id,
          label: size!.label,
          width_cm: Number(size!.width_cm),
          height_cm: Number(size!.height_cm),
          price_multiplier: Number(size!.price_multiplier),
        },
        quantity: { id: quantity!.id, quantity: quantity!.quantity, discount_pct: Number(quantity!.discount_pct) },
        file_url: fileUrl,
        file_name: fileName,
      };
      const label = `${material!.name} · ${shape!.name} · ${size!.label} · ${quantity!.quantity}u`;
      add({
        slug: product.slug,
        name: product.name,
        price,
        label,
        variantId: `${material!.id}-${size!.id}-${quantity!.id}`,
        image_url: imageUrl,
        customStickerConfig: config,
      });
      toast.success("Calco personalizado agregado al carrito");
      setFile(null);
    } catch (err: any) {
      toast.error(err.message ?? "Error al subir el archivo");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={16} /> Cargando opciones...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Step number={1} title="Material" done={!!material}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {materials.map((m: any) => (
            <OptionCard key={m.id} active={materialId === m.id} onClick={() => setMaterialId(m.id)}>
              <p className="font-semibold text-sm">{m.name}</p>
              <p className="text-xs text-muted-foreground">desde {formatPrice(Number(m.base_price))}</p>
            </OptionCard>
          ))}
        </div>
      </Step>


      <Step number={2} title="Forma" done={!!shape}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {shapes.map((s: any) => {
            const icon = shapeIconFor(s.name);
            return (
              <OptionCard key={s.id} active={shapeId === s.id} onClick={() => setShapeId(s.id)} className="text-center">
                {icon && (
                  <img
                    src={icon}
                    alt={s.name}
                    className="mx-auto mb-1.5 h-10 w-10 object-contain"
                  />
                )}
                <p className="font-semibold text-sm">{s.name}</p>
              </OptionCard>
            );
          })}
        </div>
      </Step>

      <Step number={3} title="Tamaño" done={!!size}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sizes.map((s: any) => (
            <OptionCard key={s.id} active={sizeId === s.id} onClick={() => setSizeId(s.id)}>
              <p className="font-semibold text-sm">{s.label}</p>
              <p className="text-xs text-muted-foreground">x{Number(s.price_multiplier)}</p>
            </OptionCard>
          ))}
        </div>
      </Step>

      <Step number={4} title="Cantidad" done={!!quantity}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {quantities.map((q: any) => (
            <OptionCard key={q.id} active={quantityId === q.id} onClick={() => setQuantityId(q.id)}>
              <p className="font-semibold text-sm">{q.quantity} unidades</p>
              {Number(q.discount_pct) > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400">-{q.discount_pct}% off</p>
              )}
            </OptionCard>
          ))}
        </div>
      </Step>

      <Step number={5} title="Subí tu diseño (opcional)" done={!!file}>
        <Label
          htmlFor="custom-sticker-file"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition hover:bg-muted"
        >
          {file ? (
            <>
              <Check className="text-primary" />
              <p className="text-sm font-semibold">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  setFile(null);
                }}
              >
                <X size={14} /> Quitar
              </Button>
            </>
          ) : (
            <>
              <Upload className="text-muted-foreground" />
              <p className="text-sm font-semibold">Hacé clic o arrastrá tu archivo</p>
              <p className="text-xs text-muted-foreground">JPG, PNG, SVG, PDF o AI · hasta 20MB</p>
            </>
          )}
          <input
            id="custom-sticker-file"
            type="file"
            className="hidden"
            accept=".jpg,.jpeg,.png,.svg,.webp,.pdf,.ai,.eps,image/*,application/pdf,application/postscript"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </Label>
      </Step>

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 p-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {quantity ? `${quantity.quantity} unidades` : "Total estimado"}
            </p>
            <p className="text-2xl font-bold text-primary">{formatPrice(price)}</p>
          </div>
          <Button size="lg" className="rounded-full" disabled={!complete || uploading} onClick={addToCart}>
            {uploading ? <Loader2 className="animate-spin" /> : <ShoppingCart />}
            {uploading ? "Subiendo..." : "Agregar al carrito"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Step({ number, title, done, children }: { number: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "grid h-6 w-6 place-items-center rounded-full text-xs font-bold",
            done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {done ? <Check size={14} /> : number}
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function OptionCard({ active, onClick, className, children }: { active: boolean; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 text-left transition",
        active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}
