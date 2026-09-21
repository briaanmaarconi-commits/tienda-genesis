import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Minus, Plus, ShoppingCart, X } from "lucide-react";
import { formatPrice } from "@/lib/helpers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getImageUrl } from "@/lib/imageUrl";

type Sticker = { id: string; name: string; image_url: string | null; active: boolean; sort_order: number };
type Folder = {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
  stickers: Sticker[];
};

type Props = {
  product: { slug: string; name: string; price: number };
  folders: Folder[];
};

export default function StickerPicker({ product, folders }: Props) {
  const { add } = useCart();
  const visibleFolders = folders
    .filter((f) => f.active)
    .map((f) => ({ ...f, stickers: f.stickers.filter((s) => s.active).sort((a, b) => a.sort_order - b.sort_order) }))
    .sort((a, b) => a.sort_order - b.sort_order);

  const [activeFolder, setActiveFolder] = useState(visibleFolders[0]?.id ?? "");
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<Sticker | null>(null);

  const setQty = (id: string, v: number) =>
    setQtys((p) => ({ ...p, [id]: Math.max(0, v) }));

  const totalUnits = Object.values(qtys).reduce((a, b) => a + b, 0);
  const totalPrice = totalUnits * Number(product.price);

  const addAll = () => {
    if (totalUnits === 0) return;
    const all = visibleFolders.flatMap((f) => f.stickers.map((s) => ({ folder: f, sticker: s })));
    let added = 0;
    for (const { folder, sticker } of all) {
      const q = qtys[sticker.id] ?? 0;
      if (q <= 0) continue;
      add(
        {
          slug: product.slug,
          name: product.name,
          price: Number(product.price),
          label: `${folder.name} / ${sticker.name}`,
          variantId: sticker.id,
          image_url: sticker.image_url ?? undefined,
        },
        q,
      );
      added += q;
    }
    toast.success(`${added} sticker${added === 1 ? "" : "s"} agregado${added === 1 ? "" : "s"} al carrito`);
    setQtys({});
  };

  if (visibleFolders.length === 0) {
    return (
      <p className="rounded-lg border bg-muted p-4 text-sm text-muted-foreground">
        Este producto aún no tiene stickers cargados.
      </p>
    );
  }

  const current = visibleFolders.find((f) => f.id === activeFolder) ?? visibleFolders[0];

  return (
    <div className="space-y-4">
      <p className="text-3xl font-bold text-primary">{formatPrice(Number(product.price))} <span className="text-sm font-normal text-muted-foreground">c/u</span></p>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {visibleFolders.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFolder(f.id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition",
              current.id === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {f.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {current.stickers.map((s) => {
          const q = qtys[s.id] ?? 0;
          return (
            <div key={s.id} className={cn("rounded-xl border bg-card p-2 transition", q > 0 && "border-primary ring-2 ring-primary/30")}>
              <button
                type="button"
                onClick={() => s.image_url && setPreview(s)}
                className="block aspect-square w-full overflow-hidden rounded-lg bg-muted transition hover:opacity-90"
                aria-label={`Ver ${s.name}`}
              >
                {s.image_url ? (
                  <img
                    src={getImageUrl(s.image_url, { width: 240 })}
                    alt={s.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-3xl">🎨</div>
                )}
              </button>
              <p className="mt-2 line-clamp-2 text-center text-xs font-semibold">{s.name}</p>
              <div className="mt-2 flex items-center justify-between">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQty(s.id, q - 1)} disabled={q === 0}>
                  <Minus size={14} />
                </Button>
                <span className="w-6 text-center text-sm font-bold">{q}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQty(s.id, q + 1)}>
                  <Plus size={14} />
                </Button>
              </div>
            </div>
          );
        })}
        {current.stickers.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">Carpeta vacía.</p>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 p-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{totalUnits} sticker{totalUnits === 1 ? "" : "s"}</p>
            <p className="text-lg font-bold">{formatPrice(totalPrice)}</p>
          </div>
          <Button size="lg" className="rounded-full" disabled={totalUnits === 0} onClick={addAll}>
            <ShoppingCart /> Agregar al carrito
          </Button>
        </div>
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden bg-background">
          {preview?.image_url && (
            <div className="relative">
              <img src={getImageUrl(preview.image_url, { width: 800 })} alt={preview.name} className="w-full h-auto object-contain bg-muted" />
              <div className="p-4 text-center">
                <p className="text-lg font-bold">{preview.name}</p>
                <p className="text-sm text-muted-foreground mt-1">{formatPrice(Number(product.price))}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
