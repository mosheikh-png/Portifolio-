import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { Route, Switch, useLocation } from "wouter";
import { useMotionPreference } from "@/contexts/MotionPreferenceContext";
import { useSound } from "@/contexts/SoundContext";
import { soundEngine, type TransitionEvent as SoundEvent } from "@/lib/sound-engine";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import styles from "./glass-transition.module.css";

const About = lazy(() => import("@/pages/About"));
const Contact = lazy(() => import("@/pages/Contact"));
const Work = lazy(() => import("@/pages/Work"));
const WorkCategory = lazy(() => import("@/pages/WorkCategory"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));

type Phase = "idle" | "covering" | "revealing";

const SLICE_COUNT = 5;
const MOBILE_SLICE_COUNT = 2;
const COVER_MS = 350;
const REVEAL_MS = 300;
const STAGGER_MS = 20;

function getSliceCount() {
  if (typeof window === "undefined") return SLICE_COUNT;
  return window.innerWidth <= 600 ? MOBILE_SLICE_COUNT : SLICE_COUNT;
}

function getCoverDuration() {
  return COVER_MS + (getSliceCount() - 1) * STAGGER_MS;
}

function getRevealDuration() {
  return REVEAL_MS + (getSliceCount() - 1) * STAGGER_MS;
}

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

function fire(event: SoundEvent) {
  try { soundEngine.getTransitionManager().trigger(event); } catch { /* silent */ }
}

export default function CinematicTransition() {
  const [location] = useLocation();
  const { animationsEnabled } = useMotionPreference();
  const { play } = useSound();
  const [phase, setPhase] = useState<Phase>("idle");
  const [displayLocation, setDisplayLocation] = useState(location);
  const [sliceCount, setSliceCount] = useState(SLICE_COUNT);

  const animating = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    setSliceCount(getSliceCount());
    const onResize = () => setSliceCount(getSliceCount());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (location === displayLocation) return;

    if (!animationsEnabled) {
      play("navigate");
      setDisplayLocation(location);
      return;
    }

    if (animating.current) return;
    animating.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    setPhase("covering");
    document.documentElement.classList.add("transitioning");
    fire("coverStart");

    const coverDuration = getCoverDuration();
    const revealDuration = getRevealDuration();

    const switchTimer = setTimeout(() => {
      setDisplayLocation(location);
      setPhase("revealing");
    }, coverDuration);

    const idleTimer = setTimeout(() => {
      setPhase("idle");
      animating.current = false;
      document.documentElement.classList.remove("transitioning");
    }, coverDuration + revealDuration);

    timers.current.push(switchTimer, idleTimer);
  }, [location, displayLocation, animationsEnabled, play]);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    document.documentElement.classList.remove("transitioning");
  }, []);

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
      <div className="route-page">
        {phase === "idle" ? renderPage(displayLocation) : renderPage(location)}
      </div>

      {phase !== "idle" && (
        <div
          className={`${styles.container} ${phase === "covering" ? styles.covering : styles.revealing}`}
          aria-hidden="true"
        >
          {Array.from({ length: sliceCount }, (_, i) => (
            <div key={i} className={styles.slice} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>
      )}
    </>
  );
}
