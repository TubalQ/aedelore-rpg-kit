"use client";

import { useEffect, useRef } from "react";

// Diskreta drivande guld-partiklar i hero:n. Sizear till sin förälder, respekterar
// prefers-reduced-motion, och städar upp vid unmount.
export function HeroMotes() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    const parent = canvas.parentElement;
    if (!ctx || !parent) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let raf = 0;

    const motes = Array.from({ length: 60 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: (Math.random() * 1.6 + 0.4) * dpr,
      s: Math.random() * 0.02 + 0.006,
      d: Math.random() * 0.4 - 0.2,
      o: Math.random() * 0.5 + 0.2,
    }));

    const size = () => {
      w = canvas.width = parent.offsetWidth * dpr;
      h = canvas.height = parent.offsetHeight * dpr;
      canvas.style.width = `${parent.offsetWidth}px`;
      canvas.style.height = `${parent.offsetHeight}px`;
    };
    size();
    window.addEventListener("resize", size);

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y -= m.s / 100;
        m.x += m.d / 1000;
        if (m.y < -0.02) {
          m.y = 1.02;
          m.x = Math.random();
        }
        const px = m.x * w;
        const py = m.y * h;
        const g = ctx.createRadialGradient(px, py, 0, px, py, m.r * 6);
        g.addColorStop(0, `rgba(224,196,120,${m.o})`);
        g.addColorStop(1, "rgba(224,196,120,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, m.r * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
    />
  );
}
