import { useCallback, useEffect, useRef } from "react";
import { soundEngine } from "@/lib/sound-engine";
import { useSound } from "@/contexts/SoundContext";

const CLICK_SELECTOR = ".site-nav-v2 a, .contact-chip-v2, .cover-action-card".split(", ").join(", ");

function hasFinePointer(): boolean {
  try {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  } catch {
    return false;
  }
}

export default function SoundLayer() {
  const { enabled } = useSound();
  const hasInteracted = useRef(false);

  const handleFirstInteraction = useCallback(() => {
    if (!hasInteracted.current) {
      hasInteracted.current = true;
      soundEngine.unlock();
    }
  }, []);

  useEffect(() => {
    document.addEventListener("pointerdown", handleFirstInteraction, { once: true, capture: true });
    document.addEventListener("keydown", handleFirstInteraction, { once: true, capture: true });
    return () => {
      document.removeEventListener("pointerdown", handleFirstInteraction, true);
      document.removeEventListener("keydown", handleFirstInteraction, true);
    };
  }, [handleFirstInteraction]);

  useEffect(() => {
    if (!enabled) return;

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.(CLICK_SELECTOR);
      if (target) soundEngine.play("click");
    };

    document.addEventListener("click", handleClick, { passive: true });
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [enabled]);

  return null;
}
