import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const { loading, session, isAdmin } = useAuth();
  if (loading) return <div className="container py-20 text-center">Cargando...</div>;
  if (!session) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) return (
    <div className="container py-20 text-center">
      <h1 className="text-2xl font-bold">Acceso restringido</h1>
      <p className="mt-2 text-muted-foreground">Tu cuenta no tiene permisos de administrador.</p>
    </div>
  );
  return <>{children}</>;
};

export default AdminGuard;
