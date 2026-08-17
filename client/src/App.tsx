import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useEffect, useRef } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { MotionPreferenceProvider, useMotionPreference } from "@/contexts/MotionPreferenceContext";

const About = lazy(() => import("@/pages/About"));
const Contact = lazy(() => import("@/pages/Contact"));
const Work = lazy(() => import("@/pages/Work"));
const WorkCategory = lazy(() => import("@/pages/WorkCategory"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));

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

function Router() {
  const [location] = useLocation();
  const { animationsEnabled } = useMotionPreference();
  const reduceMotion = !animationsEnabled;
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.44, ease: "circOut" as const };

  return (
    <>
    <AnimatePresence mode="wait">
      <motion.div key={location} className="route-page" initial={{ opacity: 0, y: reduceMotion ? 0 : 16, filter: reduceMotion ? "none" : "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: reduceMotion ? 0 : -10, filter: reduceMotion ? "none" : "blur(3px)" }} transition={transition}>
        <Suspense fallback={<div className="route-loading" aria-live="polite" aria-label="Loading page" />}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/work" component={Work} />
            <Route path="/work/:categorySlug" component={WorkCategory} />
            <Route path="/about" component={About} />
            <Route path="/contact" component={Contact} />
            <Route path="/admin" component={AdminDashboard} />
            <Route path="/admin/projects" component={AdminDashboard} />
            <Route path="/admin/contact" component={AdminDashboard} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </motion.div>
    </AnimatePresence>
    {!reduceMotion && <motion.div key={`route-sweep-${location}`} className="route-sweep" initial={{ scaleX: 0 }} animate={{ scaleX: [0, 1, 0] }} transition={{ duration: 0.64, times: [0, 0.32, 1], ease: "circOut" }} />}
    </>
  );
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><LanguageProvider><MotionPreferenceProvider><GlobalVisualCanvas /><TooltipProvider><Toaster /><Router /></TooltipProvider></MotionPreferenceProvider></LanguageProvider></ThemeProvider></ErrorBoundary>;
}
