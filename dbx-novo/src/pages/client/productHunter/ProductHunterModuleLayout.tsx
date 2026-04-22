import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useClientProfile } from "../../../context/ClientProfileContext";
import { pullClientProfileFromServer } from "../../../lib/clientProfileStorage";

/**
 * Gating MVP: Product Hunter reutiliza o mesmo sinal comercial que Direct Leads Pro —
 * `profile.amazonLeadsProActive === true`. Evita novo campo em clients.json e alterações no admin nesta fase.
 * Gating só no frontend; os endpoints `/api/client/product-hunter/*` não têm middleware dedicado —
 * se o módulo for vendido separadamente no futuro, acrescentar validação no servidor.
 */
export function ProductHunterModuleLayout() {
  const { profile } = useClientProfile();

  useEffect(() => {
    void pullClientProfileFromServer();
  }, []);

  if (profile.amazonLeadsProActive !== true) {
    return <Navigate to="/app/direct-leads-pro" replace />;
  }

  return <Outlet />;
}
