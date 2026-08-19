import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { soundEngine, type SoundName } from "@/lib/sound-engine";
import { useMotionPreference } from "./MotionPreferenceContext";

const STORAGE_KEY = "portfolio-sound-enabled";

type SoundContextValue = {
  enabled: boolean;
  toggle: () => void;
  play: (name: SoundName) => void;
};

const SoundContext = createContext<SoundContextValue | undefined>(undefined);

export function SoundProvider({ children }: { children: ReactNode }) {
  const { animationsEnabled } = useMotionPreference();
  const [enabled, setEnabled] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === "true";
    return true;
  });

  useEffect(() => {
    soundEngine.setEnabled(enabled && animationsEnabled);
  }, [enabled, animationsEnabled]);

  useEffect(() => {
    if (!animationsEnabled) {
      soundEngine.setEnabled(false);
    } else {
      soundEngine.setEnabled(enabled);
    }
  }, [enabled, animationsEnabled]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const play = useCallback((name: SoundName) => {
    soundEngine.play(name);
  }, []);

  const value = useMemo(() => ({ enabled: enabled && animationsEnabled, toggle, play }), [enabled, animationsEnabled, toggle, play]);

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound() {
  const context = useContext(SoundContext);
  if (!context) throw new Error("useSound must be used within SoundProvider");
  return context;
}
