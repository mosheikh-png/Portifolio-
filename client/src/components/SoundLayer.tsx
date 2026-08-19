import { useCallback, useEffect, useRef } from "react";
import { soundEngine } from "@/lib/sound-engine";
import { useSound } from "@/contexts/SoundContext";

const HOVER_SELECTOR = [
  ".cover-action-card",
  ".work-card",
  ".category-back-link",
  ".contact-link-card",
  ".contact-email-large",
  ".cv-request-card",
  ".site-nav-v2 a",
  ".contact-chip-v2",
  ".work-meta-open",
].join(", ");

const CLICK_SELECTOR = [
  "a[href]",
  "button",
  ".work-card",
  ".cover-action-card",
  ".contact-link-card",
  ".cv-request-card",
].join(", ");

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

    const handlePointerOver = (e: PointerEvent) => {
      if (!hasFinePointer()) return;
      const target = (e.target as HTMLElement)?.closest?.(HOVER_SELECTOR);
      if (target) soundEngine.play("hover");
    };

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.(CLICK_SELECTOR);
      if (target) soundEngine.play("click");
    };

    document.addEventListener("pointerover", handlePointerOver, { passive: true });
    document.addEventListener("click", handleClick, { passive: true });
    return () => {
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("click", handleClick);
    };
  }, [enabled]);

  return null;
}
