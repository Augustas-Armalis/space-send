"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks";

/* The ambient deep-space layer. 50–80 pinpoint stars, 1–2px, opacity 0.1–0.4,
   drifting almost imperceptibly. If you can clearly see them at first glance,
   it's too much. Disabled under prefers-reduced-motion. */

interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
  vx: number;
  vy: number;
  tw: number; // twinkle phase
}

export function Starfield({ density = 70 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let stars: Star[] = [];
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const count = window.innerWidth < 768 ? Math.round(density * 0.6) : density;

    const seed = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1 + 0.4,
        o: Math.random() * 0.3 + 0.1,
        vx: (Math.random() - 0.5) * 0.02,
        vy: (Math.random() - 0.5) * 0.02,
        tw: Math.random() * Math.PI * 2,
      }));
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0) s.x = w;
        if (s.x > w) s.x = 0;
        if (s.y < 0) s.y = h;
        if (s.y > h) s.y = 0;
        const twinkle = 0.7 + 0.3 * Math.sin(t * 0.0005 + s.tw);
        ctx.globalAlpha = s.o * twinkle;
        // A whisper of cold tint on the brighter stars.
        ctx.fillStyle = s.r > 1 ? "rgba(180,225,255,1)" : "rgba(255,255,255,1)";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    seed();
    if (reduced) {
      // Single static frame.
      draw(0);
      cancelAnimationFrame(raf);
      // draw() requested another frame; cancel it to keep it static.
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(draw);
    }

    const onResize = () => {
      seed();
      if (reduced) draw(0);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [density, reduced]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{ opacity: 0.9 }}
    />
  );
}
