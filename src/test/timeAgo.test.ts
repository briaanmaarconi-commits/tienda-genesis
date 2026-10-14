import { describe, expect, it } from "vitest";
import { timeAgo } from "@/lib/timeAgo";

const now = Date.parse("2026-10-14T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();
const MIN = 60_000, H = 60 * MIN, D = 24 * H;

describe("timeAgo", () => {
  it("formats recent purchases in Spanish", () => {
    expect(timeAgo(ago(30_000), now)).toBe("hace instantes");
    expect(timeAgo(ago(15 * MIN), now)).toBe("hace 15 minutos");
    expect(timeAgo(ago(1 * H + 5 * MIN), now)).toBe("hace 1 hora");
    expect(timeAgo(ago(5 * H), now)).toBe("hace 5 horas");
    expect(timeAgo(ago(1 * D + 2 * H), now)).toBe("hace 1 día");
    expect(timeAgo(ago(9 * D), now)).toBe("hace 9 días");
  });

  it("never goes negative for clock skew", () => {
    expect(timeAgo(ago(-5 * MIN), now)).toBe("hace instantes");
  });
});
