"use client";

import { useEffect, useRef } from "react";

import { BUCKET_COLORS } from "@/lib/chart-palette";

/**
 * The product's thesis as motion.
 *
 * Particles are round-ups. Each belongs to one of the three buckets and wants
 * to sit in that bucket's band. Left alone they drift - the way a portfolio
 * drifts off target as markets move. Periodically the agent ticks, and
 * everything is pulled back toward where it should be.
 *
 * That is Pipdrift in one image, which is the only reason a decorative canvas
 * earns its place on a sign-in screen. It is drawn rather than shipped as a
 * video or a generated still because it weighs nothing, themes itself from the
 * real bucket palette, and never shows a portfolio that does not exist.
 *
 * Reduced motion gets one settled frame: the same picture, holding still.
 */

const BANDS = [
  { color: BUCKET_COLORS.equities, centre: 0.28, share: 0.45 },
  { color: BUCKET_COLORS.bonds, centre: 0.55, share: 0.35 },
  { color: BUCKET_COLORS.emerging, centre: 0.8, share: 0.2 },
];

const PARTICLE_COUNT = 190;
const TICK_INTERVAL_MS = 4200;

type Particle = {
  band: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
};

export function DriftCanvas({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let frame = 0;
    let lastTick = 0;
    let pulse = 0;

    const random = (min: number, max: number) => min + Math.random() * (max - min);

    function seed() {
      particles = Array.from({ length: PARTICLE_COUNT }, () => {
        // Weight membership by the bucket's actual target share.
        const roll = Math.random();
        const band = roll < 0.45 ? 0 : roll < 0.8 ? 1 : 2;

        return {
          band,
          x: random(0, width),
          y: BANDS[band].centre * height + random(-40, 40),
          vx: random(-0.18, 0.18),
          vy: random(-0.12, 0.12),
          radius: random(0.8, 2.4),
          alpha: random(0.25, 0.85),
        };
      });
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();

      // The panel is hidden below lg, so on a narrow screen this element is
      // 0x0 at mount. Sizing a canvas to zero and never revisiting it is how a
      // visual silently stays blank after the viewport grows past the
      // breakpoint - bail now and let the ResizeObserver call us back.
      if (rect.width < 1 || rect.height < 1) return false;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      width = rect.width;
      height = rect.height;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      context!.setTransform(dpr, 0, 0, dpr, 0, 0);

      seed();
      return true;
    }

    function draw(now: number) {
      context!.clearRect(0, 0, width, height);

      // A rebalance tick, on a timer, pulling everything back toward target.
      const ticking = now - lastTick > TICK_INTERVAL_MS;
      if (ticking) {
        lastTick = now;
        pulse = 1;
      }
      pulse *= 0.94;

      // The bands themselves: where each bucket wants to be.
      for (const band of BANDS) {
        const y = band.centre * height;
        const gradient = context!.createLinearGradient(0, y - 40, 0, y + 40);
        gradient.addColorStop(0, `${band.color}00`);
        gradient.addColorStop(0.5, `${band.color}${pulse > 0.05 ? "26" : "14"}`);
        gradient.addColorStop(1, `${band.color}00`);
        context!.fillStyle = gradient;
        context!.fillRect(0, y - 40, width, 80);
      }

      for (const p of particles) {
        const target = BANDS[p.band].centre * height;

        // Constant outward drift, plus a restoring pull that strengthens during
        // a tick - drift and correction, which is the whole product.
        const pullStrength = 0.0006 + pulse * 0.012;
        p.vy += (target - p.y) * pullStrength;
        p.vy += random(-0.008, 0.008);
        p.vx += random(-0.006, 0.006);

        p.vx *= 0.985;
        p.vy *= 0.975;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        context!.globalAlpha = p.alpha * (0.55 + pulse * 0.45);
        context!.fillStyle = BANDS[p.band].color;
        context!.beginPath();
        context!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        context!.fill();
      }

      context!.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    }

    function drawStill() {
      // Settle the simulation without painting, then paint once.
      lastTick = -Infinity;
      for (let i = 0; i < 240; i++) {
        for (const p of particles) {
          const target = BANDS[p.band].centre * height;
          p.vy += (target - p.y) * 0.004;
          p.vy *= 0.9;
          p.y += p.vy;
          p.x += p.vx;
        }
      }
      draw(0);
      cancelAnimationFrame(frame);
      frame = 0;
    }

    function start() {
      if (!resize()) return;

      if (reduced.matches) {
        drawStill();
        return;
      }

      // Paint once synchronously before handing over to rAF. A page loaded in a
      // background tab gets no animation frames at all, and would otherwise show
      // an empty panel until the moment it is focused.
      if (!frame) draw(performance.now());
    }

    start();

    // Observe the element, not the window: this box changes when the layout
    // crosses the lg breakpoint, which no window resize event describes.
    const observer = new ResizeObserver(() => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      start();
    });
    observer.observe(canvas);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`pointer-events-none block h-full w-full ${className}`}
    />
  );
}
