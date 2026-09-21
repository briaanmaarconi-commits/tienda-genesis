import { useRef, useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

export type FocalSettings = {
  focal_x: number;
  focal_y: number;
  zoom: number;
  fit: "cover" | "contain";
};

type Props = {
  url: string;
  value: FocalSettings;
  onChange: (v: FocalSettings) => void;
  aspect?: string; // e.g. "1 / 1", "16 / 9"
  label?: string;
};

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 4;
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

const PRESETS = [
  { key: "16 / 9", label: "Escritorio 16:9" },
  { key: "21 / 9", label: "Panorámico 21:9" },
  { key: "4 / 3", label: "Tablet 4:3" },
  { key: "3 / 2", label: "Celular 3:2" },
  { key: "1 / 1", label: "Cuadrado 1:1" },
];

const ImageFocalEditor = ({ url, value, onChange, aspect = "1 / 1", label = "Encuadre" }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState(aspect);
  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);

  // mantener callbacks frescos para el listener nativo
  const stateRef = useRef({ value, onChange });
  stateRef.current = { value, onChange };

  // zoom con rueda / pinch (listener no pasivo para poder preventDefault)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const { value: v, onChange: cb } = stateRef.current;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * Math.exp(-dy * 0.0015)));
      cb({ ...v, zoom: Number(next.toFixed(3)) });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, fx: value.focal_x, fy: value.focal_y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    // arrastrar la imagen: mover a la derecha => mostrar parte izquierda
    const dx = ((e.clientX - d.x) / rect.width) * 100;
    const dy = ((e.clientY - d.y) / rect.height) * 100;
    onChange({ ...value, focal_x: clamp(d.fx - dx), focal_y: clamp(d.fy - dy) });
  };
  const endDrag = () => { drag.current = null; };

  const setZoom = (z: number) =>
    onChange({ ...value, zoom: Number(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)).toFixed(3)) });

  // mismo render que el banner real (HeroSlider)
  const bg: React.CSSProperties = {
    backgroundImage: `url(${url})`,
    backgroundSize: value.fit === "contain" ? "contain" : `${value.zoom * 100}% auto`,
    backgroundPosition: `${value.focal_x}% ${value.focal_y}%`,
    backgroundRepeat: "no-repeat",
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold">{label}</Label>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.key}
            type="button"
            size="sm"
            variant={preview === p.key ? "default" : "outline"}
            className="h-7 text-[11px]"
            onClick={() => setPreview(p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div
        ref={ref}
        className="relative w-full cursor-grab select-none overflow-hidden rounded-lg border bg-muted touch-none active:cursor-grabbing"
        style={{ aspectRatio: preview, ...bg }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.5)]"
          style={{ left: `${value.focal_x}%`, top: `${value.focal_y}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Arrastrá para mover la imagen · rueda del mouse o pinch para acercar/alejar
      </p>

      <div className="flex items-center gap-2">
        <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => setZoom(value.zoom - 0.1)}>
          <ZoomOut size={14} />
        </Button>
        <Slider
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.05}
          value={[value.zoom]}
          onValueChange={([z]) => setZoom(z)}
        />
        <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => setZoom(value.zoom + 0.1)}>
          <ZoomIn size={14} />
        </Button>
        <span className="text-xs tabular-nums w-12 text-right">{value.zoom.toFixed(2)}x</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={value.fit === "cover" ? "default" : "outline"}
          onClick={() => onChange({ ...value, fit: "cover" })}
        >
          Rellenar / recortar
        </Button>
        <Button
          type="button"
          size="sm"
          variant={value.fit === "contain" ? "default" : "outline"}
          onClick={() => onChange({ ...value, fit: "contain" })}
        >
          Mostrar completa
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onChange({ focal_x: 50, focal_y: 50, zoom: 1, fit: "cover" })}
        >
          <RotateCcw size={14} /> Reset
        </Button>
      </div>
    </div>
  );
};

export default ImageFocalEditor;
