import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  required: number;
  value: string[];
  onChange: (urls: string[]) => void;
};

const MAX_MB = 10;

const PhotoUploader = ({ required, value, onChange }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = required - value.length;
    const arr = Array.from(files).slice(0, remaining);
    if (arr.length === 0) {
      toast.error(`Ya alcanzaste el máximo de ${required} fotos`);
      return;
    }
    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of arr) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name}: no es una imagen`);
          continue;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
          toast.error(`${file.name}: máximo ${MAX_MB}MB`);
          continue;
        }
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("customer-photos").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) {
          toast.error(error.message);
          continue;
        }
        // Private bucket: store the object path, preview locally.
        setPreviews((prev) => ({ ...prev, [path]: URL.createObjectURL(file) }));
        uploaded.push(path);
      }
      if (uploaded.length) onChange([...value, ...uploaded]);
    } finally {
      setUploading(false);
    }
  };

  const removeAt = (i: number) => onChange(value.filter((_, j) => j !== i));

  const remaining = Math.max(0, required - value.length);
  const complete = value.length >= required;

  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Subí tus fotos para imprimir</p>
          <p className="text-xs text-muted-foreground">
            {value.length} / {required} cargadas {complete ? "✓" : `(faltan ${remaining})`}
          </p>
        </div>
        <label>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading || complete}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button asChild type="button" size="sm" variant="outline" disabled={uploading || complete}>
            <span className="cursor-pointer">
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
              {uploading ? "Subiendo…" : "Elegir fotos"}
            </span>
          </Button>
        </label>
      </div>

      {value.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {value.map((url, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-md border">
              <img src={previews[url] ?? url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                aria-label="Quitar"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PhotoUploader;
