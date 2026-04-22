import { Navigate, Outlet } from "react-router-dom";
import { ClientProfileProvider } from "../context/ClientProfileContext";
import { loadClientProfile } from "../lib/clientProfileStorage";

/** Exige perfil gravado (registo ou login); caso contrário manda para `/app/entrar`. */
export function ClientProtectedShell() {
  const profile = loadClientProfile();
  if (!profile) return <Navigate to="/app/entrar" replace />;
  return (
    <ClientProfileProvider initialProfile={profile}>
      <Outlet />
    </ClientProfileProvider>
  );
}
