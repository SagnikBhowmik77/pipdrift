"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scroll-triggered reveal: trigger → start → animate.
 *
 * Built on IntersectionObserver rather than a scroll handler, so nothing runs
 * on every frame - the browser reports once when the element crosses the line.
 * Only `transform` and `opacity` change, which the compositor handles without
 * a layout pass.
 *
 * The shown flag is written straight to the DOM rather than held in React
 * state. This is a visual transition on one node, not application state: no
 * other component reads it, and routing it through a re-render would cost a
 * render pass per element for no benefit.
 *
 * Fires once. A section that re-animates every time it scrolls past stops
 * reading as an entrance and starts reading as a distraction.
 */

export type RevealProps = {
  children: ReactNode;
  /** Milliseconds to hold before starting - used to stagger a group. */
  delay?: number;
  /** Distance travelled, in pixels. Small is usually right. */
  distance?: number;
  /** How far into the viewport the element must come. Mirrors GSAP's `start`. */
  start?: string;
  as?: "div" | "section" | "li" | "article";
  className?: string;
};

export function Reveal({
  children,
  delay = 0,
  distance = 24,
  start = "0px 0px -12% 0px",
  as: Tag = "div",
  className = "",
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const show = () => node.setAttribute("data-shown", "true");

    // Someone who has asked for less motion gets the finished state, not a
    // faster animation. Same for a browser without IntersectionObserver -
    // content must never stay hidden behind a capability check.
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      show();
      return;
    }

    // Failsafe. Content hidden behind an observer that never fires is content
    // nobody can read - a worse outcome than an element appearing without its
    // animation. If the trigger has not run by now, show it anyway.
    const failsafe = window.setTimeout(show, 2500);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show();
          window.clearTimeout(failsafe);
          observer.disconnect();
        }
      },
      { rootMargin: start, threshold: 0.01 },
    );

    observer.observe(node);

    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
    };
  }, [start]);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      data-shown="false"
      className={`pd-reveal ${className}`}
      style={
        {
          "--pd-reveal-delay": `${delay}ms`,
          "--pd-reveal-distance": `${distance}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </Tag>
  );
}

/**
 * Staggers a group - the guide's "offsetting a group of elements for a
 * sequential feel". Capped so a long list never leaves the reader waiting on
 * the last item.
 */
export function RevealGroup({
  children,
  step = 90,
  maxDelay = 450,
  ...rest
}: Omit<RevealProps, "children" | "delay"> & {
  children: ReactNode[];
  step?: number;
  maxDelay?: number;
}) {
  return (
    <>
      {children.map((child, i) => (
        <Reveal key={i} delay={Math.min(i * step, maxDelay)} {...rest}>
          {child}
        </Reveal>
      ))}
    </>
  );
}
