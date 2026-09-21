import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

const AdminLogin = () => {
  const { session, isAdmin, loading } = useAuth();

  if (loading) return <div className="container py-20 text-center">Cargando...</div>;
  if (session && isAdmin) return <Navigate to="/admin" replace />;

  const onGoogle = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/admin" });
    if (r.error) toast.error("No se pudo iniciar sesión");
  };

  return (
    <div className="container py-20 max-w-md">
      <div className="rounded-3xl border bg-card p-8 text-center">
        <h1 className="text-2xl font-bold">Panel de administración</h1>
        <p className="mt-2 text-sm text-muted-foreground">Iniciá sesión con tu cuenta de Google.</p>
        <Button size="lg" className="mt-6 w-full rounded-full" onClick={onGoogle}>
          Continuar con Google
        </Button>
        {session && !isAdmin && (
          <p className="mt-4 text-sm text-destructive">Tu cuenta no tiene permisos de admin.</p>
        )}
      </div>
    </div>
  );
};

export default AdminLogin;
