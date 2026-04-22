import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ClientProfile } from "../types";
import {
  clearClientProfile,
  CLIENT_PROFILE_UPDATED_EVENT,
  loadClientProfile,
} from "../lib/clientProfileStorage";

type ClientProfileContextValue = {
  profile: ClientProfile;
  logout: () => void;
};

const ClientProfileContext = createContext<ClientProfileContextValue | null>(null);

/**
 * `useSyncExternalStore` + `getSnapshot` que faz `JSON.parse` devolvia um objeto novo a cada leitura
 * (referência instável) — o React pode abortar updates e ficar com tela em branco no dashboard.
 * `useState` + evento de atualização do perfil é o padrão seguro aqui (perfil em sessionStorage).
 */
export function ClientProfileProvider({
  children,
  initialProfile,
}: {
  children: ReactNode;
  initialProfile: ClientProfile;
}) {
  const [profile, setProfile] = useState<ClientProfile>(() => loadClientProfile() ?? initialProfile);

  useEffect(() => {
    const sync = () => {
      const next = loadClientProfile();
      if (next) setProfile(next);
    };
    sync();
    window.addEventListener(CLIENT_PROFILE_UPDATED_EVENT, sync);
    return () => window.removeEventListener(CLIENT_PROFILE_UPDATED_EVENT, sync);
  }, []);

  const logout = useCallback(() => {
    clearClientProfile();
    window.location.assign("/app/entrar");
  }, []);

  const value = useMemo(() => ({ profile, logout }), [profile, logout]);

  return <ClientProfileContext.Provider value={value}>{children}</ClientProfileContext.Provider>;
}

export function useClientProfile(): ClientProfileContextValue {
  const v = useContext(ClientProfileContext);
  if (!v) throw new Error("useClientProfile só pode ser usado dentro do portal do cliente autenticado.");
  return v;
}
