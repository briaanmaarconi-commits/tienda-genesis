// Helpers to turn the storefront's free-text address and province name into
// the structured fields Correo Argentino's API expects.

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Province codes from the MiCorreo API documentation.
const PROVINCE_CODES: Record<string, string> = {
  salta: "A",
  "buenos aires": "B",
  "provincia de buenos aires": "B",
  "ciudad autonoma de buenos aires": "C",
  "capital federal": "C",
  caba: "C",
  "san luis": "D",
  "entre rios": "E",
  "la rioja": "F",
  "santiago del estero": "G",
  chaco: "H",
  "san juan": "J",
  catamarca: "K",
  "la pampa": "L",
  mendoza: "M",
  misiones: "N",
  formosa: "P",
  neuquen: "Q",
  "rio negro": "R",
  "santa fe": "S",
  tucuman: "T",
  chubut: "U",
  "tierra del fuego": "V",
  corrientes: "W",
  cordoba: "X",
  jujuy: "Y",
  "santa cruz": "Z",
};

export function provinceCodeFor(name: string | null | undefined): string | null {
  if (!name) return null;
  return PROVINCE_CODES[norm(name)] ?? null;
}

export type StreetParts = { streetName: string; streetNumber: string; floor: string; apartment: string };

/**
 * Splits "Av. Belgrano 1234, 2°B" / "Calle 12 Nº 345" / "Juan b justo 1594" into
 * street, number, floor and apartment. Anything in parentheses ("(entre X y Y)")
 * and trailing locality text after a comma is ignored for the street.
 */
export function splitStreetAddress(raw: string | null | undefined): StreetParts {
  const cleaned = String(raw ?? "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const segments = cleaned.split(",").map((s) => s.trim()).filter(Boolean);
  let street = segments[0] ?? "";
  const extra = segments.slice(1).join(" ");

  let floor = "";
  let apartment = "";
  const take = (re: RegExp, from: string): [string, string | null] => {
    const m = re.exec(from);
    return m ? [from.replace(re, " ").replace(/\s+/g, " ").trim(), m[1] ?? null] : [from, null];
  };

  // "2°B", "2º B" (floor + apartment letter) — in the street segment or the extras.
  const combo = /(?:^|\s)(\d{1,2}|PB)\s*[°º]\s*([A-Za-z]\d?)?(?=\s|$)/i;
  for (const holder of ["street", "extra"] as const) {
    const text = holder === "street" ? street : extra;
    const m = combo.exec(text);
    if (m && !floor) {
      floor = m[1];
      apartment = m[2] ?? apartment;
      if (holder === "street") street = text.replace(combo, " ").replace(/\s+/g, " ").trim();
    }
  }
  const scan = (text: string) => {
    let t = text;
    let v: string | null;
    if (!floor) { [t, v] = take(/\b(?:piso|p[°º]?)\s*\.?\s*(\w{1,3})\b/i, t); if (v) floor = v; }
    if (!apartment) { [t, v] = take(/\b(?:dpto|depto|dto|departamento|dep)\.?\s*(\w{1,3})\b/i, t); if (v) apartment = v; }
    return t;
  };
  street = scan(street);
  scan(extra);

  // "<name> [nº|nro|numero] <number>" at the end of the street segment.
  const m = /^(.*?)(?:[\s,]+n(?:[°ºo]|ro|úmero|umero)\.?)?[\s,]*(\d{1,6})\s*$/i.exec(street);
  let streetName = street;
  let streetNumber = "S/N";
  if (m && m[1].trim()) {
    streetName = m[1].trim();
    streetNumber = m[2];
  } else if (/s\/?n\b/i.test(street)) {
    streetName = street.replace(/\bs\/?n\b/i, "").trim();
  }
  return {
    streetName: streetName || String(raw ?? "").trim() || "S/N",
    streetNumber,
    floor: floor.slice(0, 3),
    apartment: apartment.slice(0, 3),
  };
}
