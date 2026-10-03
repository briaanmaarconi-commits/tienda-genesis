type Option = { active: boolean; name: string; sortOrder: number; extraPrice: string | number; priceMultiplier: string | number };
type Group = { active: boolean; required: boolean; name: string; sortOrder: number; perUnit: boolean; isMultiplier: boolean; productAddonOptions: Option[] };
export type CatalogProduct = {
  id: string; active: boolean; productType: string; slug: string; name: string; description: string | null;
  productImages: { url: string; sortOrder: number }[];
  productPacks: { id: string; label: string | null; units: number | null; price: string | number; sortOrder: number }[];
  productAddonGroups: Group[];
};

const sorted = <T extends { sortOrder: number }>(items: T[]) => [...items].sort((a, b) => a.sortOrder - b.sortOrder);
const clean = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/\s+/g, " ").trim();
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const url = (value: string, origin: string) => {
  const parsed = new URL(value, origin);
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) throw new Error("Invalid catalog URL");
  return parsed.href;
};

export function buildMetaCatalog(products: CatalogProduct[], origin: string) {
  const items: Record<string, string>[] = [];
  const excluded: { product: string; reason: string }[] = [];
  const ids = new Set<string>();
  for (const p of products) {
    if (!p.active) continue;
    if (p.productType !== "standard") {
      excluded.push({ product: p.slug, reason: "Requires custom configuration" });
      continue;
    }
    // Fail the whole refresh on malformed sellable products instead of silently
    // removing their previously imported items from a replacement feed.
    if (!p.name.trim() || !p.slug || !p.productPacks.length) throw new Error(`Incomplete product: ${p.slug}`);
    const image = sorted(p.productImages)[0];
    if (!image?.url) throw new Error(`Missing image: ${p.slug}`);
    const defaults = sorted(p.productAddonGroups.filter(g => g.active && g.required)).map(group => {
      const option = sorted(group.productAddonOptions.filter(o => o.active))[0];
      if (!option) throw new Error(`Missing required option: ${p.slug}`);
      return { group, option };
    });
    for (const pack of sorted(p.productPacks)) {
      let amount = Number(pack.price), extra = 0, multiplier = 1;
      if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid price: ${pack.id}`);
      for (const { group, option } of defaults) {
        const value = Number(group.isMultiplier ? option.priceMultiplier : option.extraPrice);
        if (!Number.isFinite(value) || value < 0 || (group.isMultiplier && value === 0)) throw new Error(`Invalid option price: ${p.slug}`);
        if (group.isMultiplier) multiplier *= value;
        else extra += value * (group.perUnit ? (Number(pack.units) || 1) : 1);
      }
      amount = Math.round((amount + extra) * multiplier * 100) / 100;
      if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Nonpositive catalog price: ${pack.id}`);
      const label = clean(pack.label || `${pack.units || 1} unidades`);
      const configuration = defaults.map(({ group, option }) => `${group.name}: ${option.name}`).join(". ");
      const link = new URL(`/producto/${encodeURIComponent(p.slug)}`, origin);
      link.searchParams.set("pack", pack.id);
      link.searchParams.set("catalog", "meta");
      const id = `genesis-pack-${pack.id}`;
      if (ids.has(id)) throw new Error(`Duplicate catalog ID: ${id}`);
      ids.add(id);
      items.push({
        id,
        title: clean(`${p.name} · ${label}${configuration ? ` · ${defaults.map(d => d.option.name).join(" / ")}` : ""}`).slice(0, 150),
        description: clean(`${p.description || p.name}. ${label}. ${configuration}${configuration ? "." : ""} Personalización y adicionales disponibles en la web. Envío no incluido.`).slice(0, 5000),
        availability: "in stock", condition: "new", price: `${amount.toFixed(2)} ARS`,
        link: url(link.href, origin), image_link: url(image.url, origin), brand: "Génesis",
      });
    }
  }
  if (!items.length) throw new Error("Refusing to publish an empty catalog");
  const body = items.map(item => `    <item>\n${Object.entries(item).map(([key, value]) => `      <g:${key}>${xml(value)}</g:${key}>`).join("\n")}\n    </item>`).join("\n");
  return { items, excluded, xml: `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n    <title>Génesis — catálogo</title>\n    <link>${xml(url("/", origin))}</link>\n    <description>Productos y packs de Génesis</description>\n${body}\n  </channel>\n</rss>\n` };
}
