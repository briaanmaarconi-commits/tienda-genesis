import { Link, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, Menu, Search, ShoppingCart, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/contexts/CartContext";
import { formatPrice } from "@/lib/helpers";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "./Logo";

const links = [
  { to: "/", label: "Productos" },
  { to: "/ofertas", label: "Ofertas" },
  { to: "/lista-de-precios", label: "Lista de Precios" },
  { to: "/info", label: "Información" },
  { to: "/nosotros", label: "Conocenos" },
];

const Header = () => {
  const { count, total } = useCart();
  const { isAdmin, signOut } = useAuth();
  const nav = useNavigate();

  return (
    <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur border-b">
      <div className="container flex h-16 items-center gap-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <nav className="mt-8 flex flex-col gap-1">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} className="rounded-md px-3 py-2 text-base hover:bg-muted">
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Logo />

        <nav className="hidden md:flex items-center gap-1 ml-6">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `px-3 py-2 text-sm font-medium rounded-md hover:bg-muted ${isActive ? "text-primary" : ""}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isAdmin ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin"><LayoutDashboard /> <span className="hidden sm:inline">Admin</span></Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={async () => { await signOut(); nav("/"); }} aria-label="Salir">
                <LogOut />
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/login">
                <User />
                <span className="hidden sm:inline">Ingresar</span>
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label="Buscar">
            <Search />
          </Button>
          <Button variant="default" size="sm" asChild className="relative">
            <Link to="/carrito">
              <ShoppingCart />
              <span className="hidden sm:inline">{formatPrice(total)}</span>
              {count > 0 && (
                <span className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                  {count}
                </span>
              )}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
