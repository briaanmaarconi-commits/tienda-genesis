import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettingsAdmin } from "@/hooks/useShopData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ImageUploader from "@/components/admin/ImageUploader";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type Faq = { question: string; answer: string };

const AdminSite = () => {
  const { data, isLoading } = useSiteSettingsAdmin();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({});

  useEffect(() => { if (data) setForm(data); }, [data]);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const faqs: Faq[] = Array.isArray(form.info_faqs) ? form.info_faqs : [];

  const updateFaq = (index: number, key: keyof Faq, value: string) => {
    const next = [...faqs];
    next[index] = { ...next[index], [key]: value };
    set("info_faqs", next);
  };

  const addFaq = () => set("info_faqs", [...faqs, { question: "", answer: "" }]);
  const removeFaq = (index: number) => set("info_faqs", faqs.filter((_, i) => i !== index));

  const save = async () => {
    const { error } = await supabase.from("site_settings").update({
      site_name: form.site_name,
      logo_url: form.logo_url,
      phone: form.phone,
      email: form.email,
      whatsapp: form.whatsapp,
      instagram_url: form.instagram_url,
      facebook_url: form.facebook_url,
      address: form.address,
      shipping_origin_postal_code: form.shipping_origin_postal_code,
      about_content: form.about_content,
      info_content: form.info_content,
      info_faqs: form.info_faqs,
      admin_notify_email: form.admin_notify_email,
      transfer_alias: form.transfer_alias,
      transfer_holder: form.transfer_holder,
      transfer_cbu: form.transfer_cbu,
      transfer_bank: form.transfer_bank,
      transfer_notes: form.transfer_notes,
    } as any).eq("id", form.id);
    if (error) return toast.error(error.message);
    toast.success("Guardado");
    qc.invalidateQueries({ queryKey: ["site_settings"] });
    qc.invalidateQueries({ queryKey: ["site_settings_admin"] });
  };

  if (isLoading) return <p>Cargando...</p>;

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-3xl font-bold">Marca y datos del sitio</h1>

      <ImageUploader bucket="branding" value={form.logo_url} onChange={(url) => set("logo_url", url)} label="Logo" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label>Nombre de la tienda</Label><Input className="mt-2" value={form.site_name || ""} onChange={(e) => set("site_name", e.target.value)} /></div>
        <div><Label>Teléfono</Label><Input className="mt-2" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} /></div>
        <div><Label>Email</Label><Input className="mt-2" type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} /></div>
        <div><Label>WhatsApp (con código país)</Label><Input className="mt-2" placeholder="5491100000000" value={form.whatsapp || ""} onChange={(e) => set("whatsapp", e.target.value)} /></div>
        <div><Label>Dirección</Label><Input className="mt-2" value={form.address || ""} onChange={(e) => set("address", e.target.value)} /></div>
        <div><Label>Instagram URL</Label><Input className="mt-2" value={form.instagram_url || ""} onChange={(e) => set("instagram_url", e.target.value)} /></div>
        <div><Label>Facebook URL</Label><Input className="mt-2" value={form.facebook_url || ""} onChange={(e) => set("facebook_url", e.target.value)} /></div>
        <div><Label>CP de origen (para cotizar envíos)</Label><Input className="mt-2" placeholder="1414" value={form.shipping_origin_postal_code || ""} onChange={(e) => set("shipping_origin_postal_code", e.target.value)} /></div>
        <div className="sm:col-span-2">
          <Label>📧 Email para notificaciones de ventas</Label>
          <Input className="mt-2" type="text" placeholder="tumail@gmail.com (o varios separados por coma)" value={form.admin_notify_email || ""} onChange={(e) => set("admin_notify_email", e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">Te llega un mail cada vez que entra una compra y otro cuando se confirma el pago. Activá las notificaciones del mail en tu celular para recibirlo como push.</p>
        </div>
      </div>

      <div className="space-y-4 border-t pt-6">
        <h2 className="text-xl font-bold">💸 Datos para transferencia bancaria</h2>
        <p className="text-sm text-muted-foreground">Se muestran al cliente después de confirmar el pedido si eligió "Transferencia".</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Alias</Label><Input className="mt-2" placeholder="genesis.impresiones" value={form.transfer_alias || ""} onChange={(e) => set("transfer_alias", e.target.value)} /></div>
          <div><Label>Titular</Label><Input className="mt-2" placeholder="Nombre y apellido" value={form.transfer_holder || ""} onChange={(e) => set("transfer_holder", e.target.value)} /></div>
          <div><Label>CBU / CVU</Label><Input className="mt-2" value={form.transfer_cbu || ""} onChange={(e) => set("transfer_cbu", e.target.value)} /></div>
          <div><Label>Banco</Label><Input className="mt-2" value={form.transfer_bank || ""} onChange={(e) => set("transfer_bank", e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Instrucciones adicionales</Label><Textarea className="mt-2" value={form.transfer_notes || ""} onChange={(e) => set("transfer_notes", e.target.value)} placeholder="Ej: Enviar comprobante por WhatsApp para confirmar el pedido." /></div>
        </div>
      </div>

      <div className="space-y-4 border-t pt-6">
        <h2 className="text-xl font-bold">Página "Conocenos"</h2>
        <div><Label>Texto de la sección</Label><Textarea className="mt-2 min-h-[160px]" value={form.about_content || ""} onChange={(e) => set("about_content", e.target.value)} placeholder="Contanos quiénes son..." /></div>
      </div>

      <div className="space-y-4 border-t pt-6">
        <h2 className="text-xl font-bold">Página "Información útil"</h2>
        <div><Label>Texto introductorio</Label><Textarea className="mt-2 min-h-[120px]" value={form.info_content || ""} onChange={(e) => set("info_content", e.target.value)} placeholder="Texto que aparece antes de las preguntas frecuentes..." /></div>
        <div>
          <Label>Preguntas frecuentes</Label>
          <div className="mt-2 space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-3">
                <div><Label className="text-xs">Pregunta</Label><Input className="mt-1" value={faq.question} onChange={(e) => updateFaq(i, "question", e.target.value)} /></div>
                <div><Label className="text-xs">Respuesta</Label><Textarea className="mt-1" value={faq.answer} onChange={(e) => updateFaq(i, "answer", e.target.value)} /></div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeFaq(i)} className="text-destructive">Quitar</Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addFaq}>Agregar pregunta</Button>
          </div>
        </div>
      </div>

      <Button size="lg" onClick={save}>Guardar cambios</Button>
    </div>
  );
};

export default AdminSite;
