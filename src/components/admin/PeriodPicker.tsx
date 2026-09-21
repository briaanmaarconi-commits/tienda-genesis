import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";

export type PeriodRange = { from: Date; to: Date };

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const toDateInput = (d: Date) => d.toISOString().slice(0, 10);

const mondayOf = (d: Date) => {
  const x = startOfDay(d);
  const isoDay = (x.getDay() + 6) % 7; // 0 = Monday
  return addDays(x, -isoDay);
};

const parseIsoWeek = (value: string): Date => {
  const [yearStr, weekStr] = value.split("-W");
  const year = Number(yearStr);
  const week = Number(weekStr);
  const jan4 = new Date(year, 0, 4);
  const week1Monday = mondayOf(jan4);
  return addDays(week1Monday, (week - 1) * 7);
};

export const previousPeriod = (from: Date, to: Date): PeriodRange => {
  const days = Math.round((endOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000) + 1;
  const prevTo = endOfDay(addDays(from, -1));
  const prevFrom = startOfDay(addDays(prevTo, -(days - 1)));
  return { from: prevFrom, to: prevTo };
};

type Mode = "day" | "week" | "month" | "last30" | "custom";

const modes: { value: Mode; label: string }[] = [
  { value: "last30", label: "Últimos 30 días" },
  { value: "day", label: "Día específico" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "custom", label: "Rango personalizado" },
];

export default function PeriodPicker({ onChange }: { onChange: (range: PeriodRange) => void }) {
  const now = useMemo(() => new Date(), []);
  const [mode, setMode] = useState<Mode>("last30");
  const [day, setDay] = useState(toDateInput(now));
  const [week, setWeek] = useState(() => {
    const monday = mondayOf(now);
    const jan4 = new Date(monday.getFullYear(), 0, 4);
    const week1Monday = mondayOf(jan4);
    const weekNum = Math.round((monday.getTime() - week1Monday.getTime()) / (7 * 86400000)) + 1;
    return `${monday.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  });
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [customFrom, setCustomFrom] = useState(toDateInput(addDays(now, -29)));
  const [customTo, setCustomTo] = useState(toDateInput(now));

  const emit = (range: PeriodRange) => onChange(range);

  const apply = (m: Mode, vals: { day?: string; week?: string; month?: string; from?: string; to?: string }) => {
    if (m === "last30") {
      emit({ from: startOfDay(addDays(now, -29)), to: endOfDay(now) });
    } else if (m === "day") {
      const d = new Date(`${vals.day}T00:00:00`);
      emit({ from: startOfDay(d), to: endOfDay(d) });
    } else if (m === "week") {
      const monday = parseIsoWeek(vals.week!);
      emit({ from: startOfDay(monday), to: endOfDay(addDays(monday, 6)) });
    } else if (m === "month") {
      const [y, mo] = vals.month!.split("-").map(Number);
      emit({ from: new Date(y, mo - 1, 1), to: endOfDay(new Date(y, mo, 0)) });
    } else if (m === "custom") {
      emit({ from: startOfDay(new Date(`${vals.from}T00:00:00`)), to: endOfDay(new Date(`${vals.to}T00:00:00`)) });
    }
  };

  const changeMode = (m: Mode) => {
    setMode(m);
    apply(m, { day, week, month, from: customFrom, to: customTo });
  };

  // Emit initial range once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { emit({ from: startOfDay(addDays(now, -29)), to: endOfDay(now) }); }, []);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label className="text-xs">Ver por</Label>
        <select
          className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
          value={mode}
          onChange={(e) => changeMode(e.target.value as Mode)}
        >
          {modes.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {mode === "day" && (
        <div>
          <Label className="text-xs">Día</Label>
          <input type="date" className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
            value={day} onChange={(e) => { setDay(e.target.value); apply("day", { day: e.target.value }); }} />
        </div>
      )}

      {mode === "week" && (
        <div>
          <Label className="text-xs">Semana</Label>
          <input type="week" className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
            value={week} onChange={(e) => { setWeek(e.target.value); apply("week", { week: e.target.value }); }} />
        </div>
      )}

      {mode === "month" && (
        <div>
          <Label className="text-xs">Mes</Label>
          <input type="month" className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
            value={month} onChange={(e) => { setMonth(e.target.value); apply("month", { month: e.target.value }); }} />
        </div>
      )}

      {mode === "custom" && (
        <>
          <div>
            <Label className="text-xs">Desde</Label>
            <input type="date" className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
              value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); apply("custom", { from: e.target.value, to: customTo }); }} />
          </div>
          <div>
            <Label className="text-xs">Hasta</Label>
            <input type="date" className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
              value={customTo} onChange={(e) => { setCustomTo(e.target.value); apply("custom", { from: customFrom, to: e.target.value }); }} />
          </div>
        </>
      )}
    </div>
  );
}
