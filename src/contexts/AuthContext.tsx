import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, ApiError } from "@/lib/api";

type ApiUser = { id: string; email: string; name: string | null; is_admin: boolean };
export type AdminUser = { id: string; email: string; name: string | null; isAdmin: boolean };

type AuthCtx = {
  session: AdminUser | null;
  user: AdminUser | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  session: null, user: null, isAdmin: false, loading: true, signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ user: ApiUser }>("/auth/me")
      .then((res) => setUser({ ...res.user, isAdmin: res.user.is_admin }))
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) console.error(err);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signOut = async () => {
    await api.post("/auth/logout").catch(() => {});
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ session: user, user, isAdmin: user?.isAdmin ?? false, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
