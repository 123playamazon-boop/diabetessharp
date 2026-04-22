import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type GuardState = {
  active: boolean;
  message: string;
};

const defaultMessage =
  "Há alterações neste envio que podem não estar guardadas. Sair mesmo assim?";

const NavigationGuardContext = createContext<{
  setNavigationGuard: (next: { active: boolean; message?: string }) => void;
  releaseNavigationGuard: () => void;
  guard: GuardState;
} | null>(null);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const [guard, setGuard] = useState<GuardState>({ active: false, message: defaultMessage });
  /** Evita reativar o bloqueio no mesmo ciclo em que o usuário confirmou a saída (SPA). */
  const suppressRearmUntilRef = useRef(0);

  const setNavigationGuard = useCallback((next: { active: boolean; message?: string }) => {
    if (next.active && Date.now() < suppressRearmUntilRef.current) return;
    setGuard({
      active: next.active,
      message: (next.message ?? defaultMessage).trim() || defaultMessage,
    });
  }, []);

  const releaseNavigationGuard = useCallback(() => {
    suppressRearmUntilRef.current = Date.now() + 900;
    setGuard({ active: false, message: defaultMessage });
  }, []);

  const value = useMemo(
    () => ({ setNavigationGuard, releaseNavigationGuard, guard }),
    [guard, releaseNavigationGuard, setNavigationGuard],
  );

  return <NavigationGuardContext.Provider value={value}>{children}</NavigationGuardContext.Provider>;
}

export function useNavigationGuard() {
  const ctx = useContext(NavigationGuardContext);
  if (!ctx) {
    throw new Error("useNavigationGuard must be used within NavigationGuardProvider");
  }
  return ctx;
}
