import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadImage } from "@/lib/helpers";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  bucket: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  className?: string;
};

const ImageUploader = ({ bucket, value, onChange, label = "Imagen", className }: Props) => {
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(bucket, file);
      onChange(url);
    } catch (e: any) {
      toast.error(e.message || "Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      <Label>{label}</Label>
      <div className="mt-2 flex items-center gap-3">
        {value ? (
          <div className="relative h-24 w-24 overflow-hidden rounded-lg border">
            <img src={value} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => onChange(null)} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white">
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="grid h-24 w-24 place-items-center rounded-lg border border-dashed bg-muted text-muted-foreground">
            <Upload size={20} />
          </div>
        )}
        <div>
          <input
            ref={ref}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
          />
          <Button type="button" variant="outline" disabled={uploading} onClick={() => ref.current?.click()}>
            {uploading ? "Subiendo..." : value ? "Cambiar" : "Subir imagen"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImageUploader;
