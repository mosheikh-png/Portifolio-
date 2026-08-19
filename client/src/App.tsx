import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useRef } from "react";
import CinematicTransition from "@/components/CinematicTransition";
import ErrorBoundary from "./components/ErrorBoundary";
import SoundLayer from "./components/SoundLayer";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { MotionPreferenceProvider, useMotionPreference } from "@/contexts/MotionPreferenceContext";
import { SoundProvider } from "@/contexts/SoundContext";

const GLOBAL_TEXTURE = "/manus-storage/mohamed-adel-global-texture_412cfe13.png";
const GLOBAL_STAR = "/manus-storage/mohamed-adel-rotating-star_63c85c1a.png";
function GlobalVisualCanvas() {
  const fabricRef = useRef<HTMLDivElement>(null);
  const { animationsEnabled } = useMotionPreference();

  useEffect(() => {
    const supportsFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!animationsEnabled || !supportsFinePointer) return;
    const fabric = fabricRef.current;
    if (!fabric) return;

    const target = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 };
    const current = { ...target };
    let animationFrame = 0;

    const handleMove = (event: PointerEvent) => {
      target.x = event.clientX;
      target.y = event.clientY;
    };

    const render = () => {
      current.x += (target.x - current.x) * 0.075;
      current.y += (target.y - current.y) * 0.075;
      const travel = Math.hypot(target.x - current.x, target.y - current.y);
      const x = (current.x / window.innerWidth) * 100;
      const y = (current.y / window.innerHeight) * 100;
      const opacity = Math.min(0.17, Math.max(0.018, travel / 780));

      fabric.style.setProperty("--fabric-x", `${x.toFixed(3)}%`);
      fabric.style.setProperty("--fabric-y", `${y.toFixed(3)}%`);
      fabric.style.setProperty("--fabric-opacity", opacity.toFixed(3));
      animationFrame = window.requestAnimationFrame(render);
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    animationFrame = window.requestAnimationFrame(render);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [animationsEnabled]);

  // make sure to consider if you need authentication for certain routes
  return (
    <div className="global-visual-canvas" aria-hidden="true">
      <div className="global-texture" style={{ backgroundImage: `url(${GLOBAL_TEXTURE})` }} />
      <div ref={fabricRef} className="fabric-surface" />
      <div className="global-star"><img src={GLOBAL_STAR} alt="" /></div>
    </div>
  );
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><LanguageProvider><MotionPreferenceProvider><SoundProvider><GlobalVisualCanvas /><SoundLayer /><TooltipProvider><Toaster /><CinematicTransition /></TooltipProvider></SoundProvider></MotionPreferenceProvider></LanguageProvider></ThemeProvider></ErrorBoundary>;
}
