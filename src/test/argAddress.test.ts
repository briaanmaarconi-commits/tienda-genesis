import { describe, expect, it } from "vitest";
import { provinceCodeFor, splitStreetAddress } from "../../backend/src/lib/argAddress";

describe("splitStreetAddress", () => {
  it("splits street and number", () => {
    expect(splitStreetAddress("Juan b justo 1594")).toEqual({ streetName: "Juan b justo", streetNumber: "1594", floor: "", apartment: "" });
    expect(splitStreetAddress("Amancay 258")).toMatchObject({ streetName: "Amancay", streetNumber: "258" });
  });

  it("ignores locality text and parentheses (real orders)", () => {
    expect(splitStreetAddress("Cnel. Estomba 4795, Gregorio de Laferrere (entre colegiales y davinci)")).toMatchObject({
      streetName: "Cnel. Estomba",
      streetNumber: "4795",
    });
    expect(splitStreetAddress("avenida josé hernández 264")).toMatchObject({ streetName: "avenida josé hernández", streetNumber: "264" });
  });

  it("extracts floor and apartment in the common shapes", () => {
    expect(splitStreetAddress("Av. Belgrano 1234, 2°B")).toEqual({ streetName: "Av. Belgrano", streetNumber: "1234", floor: "2", apartment: "B" });
    expect(splitStreetAddress("Calle 12 Nº 345 piso 4 dpto C")).toEqual({ streetName: "Calle 12", streetNumber: "345", floor: "4", apartment: "C" });
    expect(splitStreetAddress("Mitre 50, depto 3")).toMatchObject({ streetName: "Mitre", streetNumber: "50", apartment: "3" });
  });

  it("falls back to S/N when there is no number and never returns an empty street", () => {
    expect(splitStreetAddress("Ruta 5 s/n")).toMatchObject({ streetNumber: "S/N" });
    expect(splitStreetAddress("ccc")).toEqual({ streetName: "ccc", streetNumber: "S/N", floor: "", apartment: "" });
    expect(splitStreetAddress("").streetName).toBe("S/N");
  });
});

describe("provinceCodeFor", () => {
  it("maps storefront province names regardless of case and accents", () => {
    expect(provinceCodeFor("Córdoba")).toBe("X");
    expect(provinceCodeFor("Ciudad autónoma de buenos aires ")).toBe("C");
    expect(provinceCodeFor("Buenos Aires")).toBe("B");
    expect(provinceCodeFor("Neuquén")).toBe("Q");
    expect(provinceCodeFor("Río Negro")).toBe("R");
    expect(provinceCodeFor("Entre Ríos")).toBe("E");
  });

  it("returns null for unknown or empty values", () => {
    expect(provinceCodeFor("Narnia")).toBeNull();
    expect(provinceCodeFor(null)).toBeNull();
  });
});
