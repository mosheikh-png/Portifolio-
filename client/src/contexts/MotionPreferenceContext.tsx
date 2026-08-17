import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type MotionPreference = "system" | "enabled" | "reduced";

type MotionPreferenceContextValue = {
  preference: MotionPreference;
  animationsEnabled: boolean;
  setPreference: (preference: MotionPreference) => void;
};

const MotionPreferenceContext = createContext<MotionPreferenceContextValue | undefined>(undefined);
const STORAGE_KEY = "portfolio-motion-preference";

function getSystemReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getStoredPreference(): MotionPreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "enabled" || stored === "reduced" || stored === "system") return stored;
  // Preserve the intent of the legacy two-state control.
  return stored === "disabled" ? "reduced" : "enabled";
}

export function MotionPreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<MotionPreference>(getStoredPreference);
  const [systemReducedMotion, setSystemReducedMotion] = useState(getSystemReducedMotion);
  const animationsEnabled = preference === "enabled" || (preference === "system" && !systemReducedMotion);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, preference);
    document.documentElement.dataset.motion = animationsEnabled ? "full" : "reduced";
  }, [animationsEnabled, preference]);

  const value = useMemo(() => ({
    preference,
    animationsEnabled,
    setPreference,
  }), [animationsEnabled, preference]);

  return <MotionPreferenceContext.Provider value={value}>{children}</MotionPreferenceContext.Provider>;
}

export function useMotionPreference() {
  const context = useContext(MotionPreferenceContext);
  if (!context) throw new Error("useMotionPreference must be used within MotionPreferenceProvider");
  return context;
}
