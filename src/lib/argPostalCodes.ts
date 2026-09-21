// Inferencia aproximada de provincia argentina a partir de un CP de 4 dígitos.
// Cubre la mayoría de los rangos del Correo Argentino.
// Devuelve null si no se puede inferir.

const RANGES: Array<{ from: number; to: number; province: string }> = [
  // CABA
  { from: 1000, to: 1499, province: "Ciudad Autónoma de Buenos Aires" },
  // GBA y Pcia. Bs As
  { from: 1500, to: 1900, province: "Buenos Aires" },
  { from: 1901, to: 2499, province: "Buenos Aires" },
  // Santa Fe
  { from: 2500, to: 2599, province: "Buenos Aires" },
  { from: 2600, to: 3099, province: "Santa Fe" },
  // Entre Ríos
  { from: 3100, to: 3299, province: "Entre Ríos" },
  // Corrientes
  { from: 3300, to: 3499, province: "Corrientes" },
  // Misiones
  { from: 3300, to: 3399, province: "Misiones" }, // override parcial
  { from: 3300, to: 3399, province: "Misiones" },
  { from: 3500, to: 3599, province: "Chaco" },
  // Formosa
  { from: 3600, to: 3699, province: "Formosa" },
  // Misiones (rango real ~3300-3399 según localidad — usamos prefijo N para discriminar arriba)
  // Tucumán
  { from: 4000, to: 4199, province: "Tucumán" },
  // Salta
  { from: 4400, to: 4699, province: "Salta" },
  // Jujuy
  { from: 4600, to: 4699, province: "Jujuy" },
  // Santiago del Estero
  { from: 4200, to: 4399, province: "Santiago del Estero" },
  // Catamarca
  { from: 4700, to: 4799, province: "Catamarca" },
  // La Rioja
  { from: 5300, to: 5399, province: "La Rioja" },
  // Córdoba
  { from: 5000, to: 5299, province: "Córdoba" },
  { from: 5800, to: 5999, province: "Córdoba" },
  // San Luis
  { from: 5700, to: 5799, province: "San Luis" },
  // Mendoza
  { from: 5500, to: 5699, province: "Mendoza" },
  // San Juan
  { from: 5400, to: 5499, province: "San Juan" },
  // La Pampa
  { from: 6300, to: 6399, province: "La Pampa" },
  // Neuquén
  { from: 8300, to: 8399, province: "Neuquén" },
  // Río Negro
  { from: 8400, to: 8499, province: "Río Negro" },
  { from: 8500, to: 8599, province: "Río Negro" },
  // Chubut
  { from: 9000, to: 9299, province: "Chubut" },
  // Santa Cruz
  { from: 9300, to: 9499, province: "Santa Cruz" },
  // Tierra del Fuego
  { from: 9410, to: 9420, province: "Tierra del Fuego" },
  // Buenos Aires interior
  { from: 6000, to: 7999, province: "Buenos Aires" },
];

export function inferProvinceFromCP(cp: string): string | null {
  if (!cp) return null;
  const n = parseInt(cp.replace(/\D/g, "").slice(0, 4), 10);
  if (!n || isNaN(n)) return null;
  for (const r of RANGES) {
    if (n >= r.from && n <= r.to) return r.province;
  }
  return null;
}

export const AR_PROVINCES = [
  "Ciudad Autónoma de Buenos Aires",
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];
