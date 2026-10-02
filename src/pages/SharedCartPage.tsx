import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart, type CartItem } from "@/contexts/CartContext";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SHARED_CART_TOKEN_KEY } from "@/lib/sharedCart";

const SharedCartPage = () => {
  const { token } = useParams();
  const nav = useNavigate();
  const { replace } = useCart();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const data = await api.get<{ items: CartItem[] }>(`/shared-carts/${token}`);
        replace(data.items);
        sessionStorage.setItem(SHARED_CART_TOKEN_KEY, token);
        nav("/carrito", { replace: true });
      } catch (err) {
        if (err instanceof ApiError && err.status === 410) {
          setError("Este carrito ya fue utilizado. Si necesitás volver a comprar, pedile un link nuevo a quien te lo compartió.");
        } else if (err instanceof ApiError && err.status === 404) {
          setError("No encontramos este carrito. El link puede estar mal copiado o haber expirado.");
        } else {
          setError("No pudimos cargar el carrito. Probá de nuevo en un rato.");
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!error) {
    return (
      <div className="container py-20 text-center text-sm text-muted-foreground">Cargando tu carrito…</div>
    );
  }

  return (
    <div className="container py-20 text-center">
      <h1 className="text-2xl font-bold">No pudimos abrir este carrito</h1>
      <p className="mt-2 text-muted-foreground">{error}</p>
      <Button asChild className="mt-6 rounded-full" size="lg"><Link to="/">Ir a la tienda</Link></Button>
    </div>
  );
};

export default SharedCartPage;
