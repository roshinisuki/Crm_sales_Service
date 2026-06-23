"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { HandshakeLoader } from "@/components/HandshakeLoader";
import { CRMSpinner } from "@/components/CRMSpinner";
import { useThemeAccent } from "@/lib/theme-accents";

export type GlobalLoadingType = "handshake" | "pulse";

interface GlobalLoadingState {
  active: boolean;
  label: string;
  type: GlobalLoadingType;
}

interface GlobalLoadingContextValue {
  startLoading: (label?: string, type?: GlobalLoadingType) => void;
  stopLoading: () => void;
  isLoading: boolean;
}

const GlobalLoadingContext = createContext<GlobalLoadingContextValue>({
  startLoading: () => {},
  stopLoading: () => {},
  isLoading: false,
});

const SHOW_DELAY_MS = 400;

export function GlobalLoadingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GlobalLoadingState>({
    active: false,
    label: "Loading...",
    type: "pulse",
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accent = useThemeAccent();
  const isDark =
    typeof window !== "undefined" &&
    document.documentElement.classList.contains("dark");
  const overlayBg = isDark
    ? "rgba(10,10,10,0.55)"
    : "rgba(255,255,255,0.45)";

  const startLoading = useCallback(
    (label: string = "Loading...", type: GlobalLoadingType = "pulse") => {
      // Cancel any previously armed timer
      if (timerRef.current) clearTimeout(timerRef.current);
      // Only reveal the overlay if the operation is still running after 3 s
      timerRef.current = setTimeout(() => {
        setState({ active: true, label, type });
      }, SHOW_DELAY_MS);
    },
    []
  );

  const stopLoading = useCallback(() => {
    // Cancel the pending timer — if we beat 3 s the overlay was never shown
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setState((s) => ({ ...s, active: false }));
  }, []);

  return (
    <GlobalLoadingContext.Provider
      value={{ startLoading, stopLoading, isLoading: state.active }}
    >
      {children}

      {state.active && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 16,
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
            background: overlayBg,
          }}
          aria-live="polite"
          aria-label={state.label || "Loading"}
          role="status"
        >
          {state.type === "handshake" ? (
            <HandshakeLoader
              size={48}
              variant="ripple"
              accent={accent}
              label={state.label}
            />
          ) : (
            <CRMSpinner
              size={52}
              accent={accent}
              label={state.label}
            />
          )}
        </div>
      )}
    </GlobalLoadingContext.Provider>
  );
}

export function useGlobalLoading(): GlobalLoadingContextValue {
  return useContext(GlobalLoadingContext);
}
