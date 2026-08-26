"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Parallax: different speed → different depth.
 *
 * `speed` is a fraction of the element's own scroll travel. Negative values
 * lag behind the page (reads as distant), positive values run ahead (reads as
 * near). Keep it small - the guide's warning that movement should support the
 * content rather than fight it is the whole difference between depth and
 * seasickness.
 *
 * The transform is written directly to the node inside a rAF rather than
 * through React state: this updates on every scroll frame, and re-rendering a
 * component tree that often is exactly the work worth avoiding.
 */
export function Parallax({
  children,
  speed = -0.06,
  className = "",
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Touch devices scroll with momentum that makes small parallax read as
    // jitter, and the effect costs more than it gives on a narrow screen.
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight;

      // -1 well below the fold, 0 centred, 1 well above it.
      const centre = rect.top + rect.height / 2;
      const fromCentre = (centre - viewport / 2) / viewport;

      node.style.transform = `translate3d(0, ${(fromCentre * speed * viewport).toFixed(2)}px, 0)`;
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
      node.style.transform = "";
    };
  }, [speed]);

  return (
    <div ref={ref} className={`will-change-transform ${className}`}>
      {children}
    </div>
  );
}
