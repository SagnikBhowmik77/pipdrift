"use client";

import { useEffect, useState } from "react";

/**
 * Scroll progress: position → a normalised 0-1 control signal.
 *
 * The guide's framing is the useful one - once you have a clean 0-1 value it
 * can drive any animatable property. Here it drives one thing, a hairline at
 * the top of the page, because a reader on a long page benefits from knowing
 * how much is left and gains nothing from a second element reacting to it.
 *
 * Reads are throttled to one per animation frame; a scroll listener that does
 * layout work on every event is the classic way to make a page feel heavy.
 */
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      setProgress(scrollable <= 0 ? 0 : doc.scrollTop / scrollable);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent"
    >
      <div
        className="h-full origin-left bg-mint/70"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
