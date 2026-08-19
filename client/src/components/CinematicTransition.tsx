import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { Route, Switch, useLocation } from "wouter";
import { useMotionPreference } from "@/contexts/MotionPreferenceContext";
import { useSound } from "@/contexts/SoundContext";
import { soundEngine, type TransitionEvent as SoundEvent } from "@/lib/sound-engine";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";

const About = lazy(() => import("@/pages/About"));
const Contact = lazy(() => import("@/pages/Contact"));
const Work = lazy(() => import("@/pages/Work"));
const WorkCategory = lazy(() => import("@/pages/WorkCategory"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));

type Phase = "idle" | "covering" | "switching" | "revealing";

const COVER_MS = 620;
const REVEAL_MS = 675;
const TOTAL_MS = 1350;

function matchRoute(loc: string) {
  if (loc === "/") return <Home />;
  if (loc === "/work") return <Work />;
  if (loc.startsWith("/work/")) return <WorkCategory />;
  if (loc === "/about") return <About />;
  if (loc === "/contact") return <Contact />;
  if (loc.startsWith("/admin")) return <AdminDashboard />;
  if (loc === "/404") return <NotFound />;
  return <NotFound />;
}

function triggerTransitionSound(event: SoundEvent) {
  try {
    soundEngine.getTransitionManager().trigger(event);
  } catch {
    // Fail silently
  }
}

export default function CinematicTransition() {
  const [location] = useLocation();
  const { animationsEnabled } = useMotionPreference();
  const { play } = useSound();
  const [phase, setPhase] = useState<Phase>("idle");
  const [displayLocation, setDisplayLocation] = useState(location);

  const isAnimating = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const frozenScrollY = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => {
    if (location === displayLocation) return;

    if (!animationsEnabled) {
      play("navigate");
      setDisplayLocation(location);
      return;
    }

    if (isAnimating.current) return;
    isAnimating.current = true;
    clearTimers();

    frozenScrollY.current = window.scrollY;

    setPhase("covering");
    document.documentElement.classList.add("cinematic-transitioning");
    triggerTransitionSound("coverStart");

    timers.current.push(
      setTimeout(() => {
        setDisplayLocation(location);
        setPhase("switching");
        triggerTransitionSound("switch");
      }, COVER_MS),
    );

    timers.current.push(
      setTimeout(() => {
        setPhase("revealing");
        triggerTransitionSound("revealStart");
      }, REVEAL_MS),
    );

    timers.current.push(
      setTimeout(() => {
        setPhase("idle");
        isAnimating.current = false;
        document.documentElement.classList.remove("cinematic-transitioning");
        triggerTransitionSound("complete");
      }, TOTAL_MS),
    );
  }, [location, displayLocation, animationsEnabled, play, clearTimers]);

  useEffect(() => {
    return () => {
      clearTimers();
      document.documentElement.classList.remove("cinematic-transitioning");
    };
  }, [clearTimers]);

  const renderPage = useCallback(
    (loc: string) => (
      <Suspense fallback={<div className="route-loading" aria-live="polite" aria-label="Loading page" />}>
        {matchRoute(loc)}
      </Suspense>
    ),
    [],
  );

  if (!animationsEnabled) {
    return (
      <div className="route-page">
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
      </div>
    );
  }

  return (
    <>
      {phase !== "idle" && (
        <div
          className="cinematic-old-page"
          aria-hidden="true"
          style={{ top: -frozenScrollY.current }}
        >
          <div className="route-page">{renderPage(displayLocation)}</div>
        </div>
      )}

      <div className={`cinematic-current-page ${phase === "covering" ? "phase-covering" : ""}`}>
        <div className="route-page">
          {phase === "idle" ? renderPage(displayLocation) : renderPage(location)}
        </div>
      </div>

      {phase !== "idle" && (
        <div className="cinematic-panel" aria-hidden="true" ref={panelRef}>
          <div className="cinematic-panel-inner">
            <div className="cinematic-scanlines" />
            <div className="cinematic-panel-highlight" />
          </div>
        </div>
      )}
    </>
  );
}
