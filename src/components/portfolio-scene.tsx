"use client";

import { useEffect, useRef, useState } from "react";

import { BUCKET_COLORS } from "@/lib/chart-palette";
import { DriftCanvas } from "./drift-canvas";

/**
 * A portfolio as an orbital system.
 *
 * Three rings, one per bucket, radius ordered by target weight and coloured
 * from the same palette the charts use. Particles orbit, and between agent
 * ticks they spread - drift. On a tick the rings pull tight again. It is the
 * rebalancing loop rendered as a physical system, which is the one thing worth
 * putting on a sign-in screen for a product nobody has used yet.
 *
 * Three draw calls, one per ring, using Points rather than meshes: a few
 * thousand orbiting particles cost nothing this way, and the whole scene stays
 * under a frame budget on integrated graphics.
 *
 * WebGL is not guaranteed - old hardware, blocklisted drivers, some remote
 * desktops. When it is missing this falls back to the 2D canvas rather than
 * leaving a dead panel.
 */

const RINGS = [
  { color: BUCKET_COLORS.equities, radius: 3.4, count: 1400, speed: 0.12, weight: 0.45 },
  { color: BUCKET_COLORS.bonds, radius: 2.5, count: 1000, speed: 0.17, weight: 0.35 },
  { color: BUCKET_COLORS.emerging, radius: 1.7, count: 700, speed: 0.23, weight: 0.2 },
];

const TICK_INTERVAL_S = 5.5;

export function PortfolioScene({ className = "" }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    // Imported inside the effect so three never reaches the server render and
    // stays out of the initial client bundle.
    void (async () => {
      let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch {
        if (!disposed) setFailed(true);
        return;
      }
      if (disposed) return;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        });
      } catch {
        if (!disposed) setFailed(true);
        return;
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 2.6, 8.4);
      camera.lookAt(0, 0, 0);

      const group = new THREE.Group();
      // Tilt the whole system so the rings read as ellipses rather than lines.
      group.rotation.x = 0.62;
      scene.add(group);

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

      type Ring = {
        points: import("three").Points;
        geometry: import("three").BufferGeometry;
        material: import("three").PointsMaterial;
        base: Float32Array;
        angles: Float32Array;
        jitter: Float32Array;
        speed: number;
        radius: number;
      };

      const rings: Ring[] = RINGS.map((spec) => {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(spec.count * 3);
        const angles = new Float32Array(spec.count);
        const jitter = new Float32Array(spec.count);

        for (let i = 0; i < spec.count; i++) {
          angles[i] = Math.random() * Math.PI * 2;
          // How far this particle wanders when the portfolio is left alone.
          jitter[i] = 0.35 + Math.random() * 0.9;
        }

        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
          color: new THREE.Color(spec.color),
          size: 0.035,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });

        const points = new THREE.Points(geometry, material);
        group.add(points);

        return {
          points,
          geometry,
          material,
          base: positions,
          angles,
          jitter,
          speed: spec.speed,
          radius: spec.radius,
        };
      });

      let elapsed = 0;
      let spread = 0;

      function update(delta: number) {
        elapsed += delta;

        // Drift grows steadily, then collapses when the agent ticks.
        const phase = (elapsed % TICK_INTERVAL_S) / TICK_INTERVAL_S;
        spread = phase < 0.82 ? phase / 0.82 : (1 - phase) / 0.18;

        for (const ring of rings) {
          const positions = ring.geometry.getAttribute("position")
            .array as Float32Array;

          for (let i = 0; i < ring.angles.length; i++) {
            ring.angles[i] += delta * ring.speed;

            const wander = ring.jitter[i] * spread;
            const radius = ring.radius + wander * 0.55;
            const angle = ring.angles[i];

            positions[i * 3] = Math.cos(angle) * radius;
            positions[i * 3 + 1] = Math.sin(angle * 1.7) * wander * 0.32;
            positions[i * 3 + 2] = Math.sin(angle) * radius;
          }

          ring.geometry.getAttribute("position").needsUpdate = true;
          // Rings brighten as they snap back, so a tick is legible as an event.
          ring.material.opacity = 0.55 + (1 - spread) * 0.4;
        }

        group.rotation.y += delta * 0.06;
      }

      function resize() {
        const rect = mount!.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return false;

        renderer.setSize(rect.width, rect.height, false);
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
        return true;
      }

      let frame = 0;
      let last = performance.now();

      function loop(now: number) {
        const delta = Math.min((now - last) / 1000, 0.05);
        last = now;
        update(delta);
        renderer.render(scene, camera);
        frame = requestAnimationFrame(loop);
      }

      function begin() {
        if (!resize()) return;

        if (reduced.matches) {
          // One settled frame: the rings tight, holding still.
          update(0.016);
          spread = 0;
          update(0);
          renderer.render(scene, camera);
          return;
        }

        // Paint once synchronously - a tab opened in the background gets no
        // animation frames, and would otherwise show an empty panel.
        update(0.016);
        renderer.render(scene, camera);
        if (!frame) {
          last = performance.now();
          frame = requestAnimationFrame(loop);
        }
      }

      begin();

      const observer = new ResizeObserver(() => {
        if (frame) {
          cancelAnimationFrame(frame);
          frame = 0;
        }
        begin();
      });
      observer.observe(mount!);

      cleanup = () => {
        if (frame) cancelAnimationFrame(frame);
        observer.disconnect();
        for (const ring of rings) {
          ring.geometry.dispose();
          ring.material.dispose();
        }
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) {
          mount!.removeChild(renderer.domElement);
        }
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  if (failed) return <DriftCanvas className={className} />;

  return (
    <div
      ref={mountRef}
      aria-hidden
      data-scene="portfolio"
      className={`pointer-events-none h-full w-full ${className}`}
    />
  );
}
