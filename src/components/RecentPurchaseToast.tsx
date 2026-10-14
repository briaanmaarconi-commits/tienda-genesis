import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, X } from "lucide-react";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/timeAgo";

type Purchase = { first_name: string; product: string; quantity: number; at: string };

const DISMISS_KEY = "recent-purchase-dismissed";
const FIRST_DELAY_MS = 3_000;
const VISIBLE_MS = 4_500;
const GAP_MS = 6_000;
const MIN_PURCHASES = 3; // fewer than this looks staged
// Don't cover checkout controls or the post-payment screens.
const HIDDEN_ON = [/^\/carrito/, /^\/pago\//];

const readDismissed = () => {
  try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
};

const RecentPurchaseToast = () => {
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  const hiddenHere = HIDDEN_ON.some((re) => re.test(pathname));
  const { data } = useQuery({
    queryKey: ["recent_purchases"],
    queryFn: () => api.get<{ purchases: Purchase[] }>("/recent-purchases"),
    staleTime: 5 * 60_000,
    enabled: !dismissed,
  });
  const purchases = useMemo(() => data?.purchases ?? [], [data]);
  const active = !dismissed && !hiddenHere && purchases.length >= MIN_PURCHASES;

  useEffect(() => {
    if (!active) { setVisible(false); return; }
    let showTimer: ReturnType<typeof setTimeout>;
    let hideTimer: ReturnType<typeof setTimeout>;
    const cycle = (first: boolean) => {
      showTimer = setTimeout(() => {
        setVisible(true);
        hideTimer = setTimeout(() => {
          setVisible(false);
          setIndex((i) => (i + 1) % purchases.length);
          cycle(false);
        }, VISIBLE_MS);
      }, first ? FIRST_DELAY_MS : GAP_MS);
    };
    cycle(true);
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); setVisible(false); };
  }, [active, purchases.length]);

  if (!active || !visible) return null;
  const p = purchases[index % purchases.length];
  const label = p.quantity > 1 ? `${p.quantity} × ${p.product}` : p.product;

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* private mode */ }
    setDismissed(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-40 flex max-w-[calc(100vw-6.5rem)] items-center gap-3 rounded-2xl border bg-card p-3 pr-8 shadow-lg animate-in fade-in slide-in-from-bottom-2 sm:max-w-sm"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <ShoppingBag size={18} />
      </span>
      <div className="min-w-0 text-sm leading-snug">
        <p className="line-clamp-2"><span className="font-semibold">{p.first_name}</span> compró <span className="font-semibold">{label}</span></p>
        <p className="text-xs text-muted-foreground">{timeAgo(p.at)}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar aviso"
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default RecentPurchaseToast;
