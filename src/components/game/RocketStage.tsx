import { useEffect, useRef } from "react";

import { formatMultiplier } from "@/lib/game-math";

type Phase = "idle" | "betting" | "running" | "crashed";

type Star = { x: number; y: number; z: number; r: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; hue: number };

/**
 * Cinematic space launch stage. Everything here is presentation only —
 * the multiplier and phase come from the server-authoritative game state.
 */
export function RocketStage({
  phase,
  multiplier,
  countdownLabel,
}: {
  phase: Phase;
  multiplier: number;
  countdownLabel?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ phase, multiplier });
  stateRef.current = { phase, multiplier };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const stars: Star[] = Array.from({ length: 160 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: 0.25 + Math.random() * 1,
      r: 0.4 + Math.random() * 1.4,
    }));
    let particles: Particle[] = [];
    let crashParticles: Particle[] = [];
    let lastPhase: Phase = phase;
    let crashAt = 0;
    let raf = 0;
    let prev = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(48, now - prev);
      prev = now;
      const { phase: p, multiplier: m } = stateRef.current;

      if (p !== lastPhase) {
        if (p === "crashed") {
          crashAt = now;
          crashParticles = Array.from({ length: 90 }, () => {
            const a = Math.random() * Math.PI * 2;
            const s = 0.05 + Math.random() * 0.55;
            return {
              x: 0,
              y: 0,
              vx: Math.cos(a) * s,
              vy: Math.sin(a) * s,
              life: 1,
              hue: 20 + Math.random() * 40,
            };
          });
        }
        if (p === "betting" || p === "idle") {
          particles = [];
          crashParticles = [];
        }
        lastPhase = p;
      }

      // Flight progress drives camera speed and rocket position.
      const climb = Math.min(1, Math.log(Math.max(1, m)) / Math.log(12));
      const speed = p === "running" ? 0.06 + climb * 0.55 : 0.02;

      ctx.clearRect(0, 0, width, height);

      // Deep space gradient.
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "rgba(18,10,44,1)");
      bg.addColorStop(0.55, "rgba(26,13,58,1)");
      bg.addColorStop(1, "rgba(10,7,26,1)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Aurora glow that intensifies with the multiplier.
      const glow = ctx.createRadialGradient(
        width * 0.5,
        height * (0.95 - climb * 0.35),
        0,
        width * 0.5,
        height * (0.95 - climb * 0.35),
        Math.max(width, height) * (0.45 + climb * 0.35),
      );
      const heat = p === "crashed" ? 0.45 : 0.18 + climb * 0.35;
      glow.addColorStop(0, `rgba(${p === "crashed" ? "255,90,60" : "150,90,255"},${heat})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      // Camera shake on crash.
      const sinceCrash = now - crashAt;
      let shake = 0;
      if (p === "crashed" && sinceCrash < 600) {
        shake = (1 - sinceCrash / 600) * 12;
      }
      ctx.save();
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

      // Parallax starfield streaming downward.
      for (const s of stars) {
        s.y += (speed * s.z * dt) / 16 / height * 60;
        if (s.y > 1) {
          s.y = 0;
          s.x = Math.random();
        }
        const trail = p === "running" ? s.z * climb * 26 : 0;
        ctx.globalAlpha = 0.25 + s.z * 0.55;
        ctx.strokeStyle = "rgba(214,225,255,0.9)";
        ctx.lineWidth = s.r * 0.9;
        ctx.beginPath();
        ctx.moveTo(s.x * width, s.y * height - trail);
        ctx.lineTo(s.x * width, s.y * height);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Rocket anchor point.
      const rx = width * 0.5;
      const ry = height * (0.78 - climb * 0.42);

      if (p === "running") {
        for (let i = 0; i < 4; i++) {
          particles.push({
            x: rx + (Math.random() - 0.5) * 7,
            y: ry + 20,
            vx: (Math.random() - 0.5) * 0.5,
            vy: 1.6 + Math.random() * 2.4 + climb * 3,
            life: 1,
            hue: 200 + Math.random() * 90,
          });
        }
      }

      particles = particles.filter((pt) => pt.life > 0);
      for (const pt of particles) {
        pt.x += pt.vx * (dt / 16);
        pt.y += pt.vy * (dt / 16);
        pt.life -= 0.022 * (dt / 16);
        ctx.globalAlpha = Math.max(0, pt.life) * 0.75;
        ctx.fillStyle = `hsl(${pt.hue} 100% ${55 + pt.life * 30}%)`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1 + pt.life * 3.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (p !== "crashed") {
        drawRocket(ctx, rx, ry, p === "running", now);
      } else {
        crashParticles = crashParticles.filter((pt) => pt.life > 0);
        for (const pt of crashParticles) {
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          pt.vy += 0.0009 * dt;
          pt.life -= 0.0012 * dt;
          ctx.globalAlpha = Math.max(0, pt.life);
          ctx.fillStyle = `hsl(${pt.hue} 100% ${50 + pt.life * 25}%)`;
          ctx.beginPath();
          ctx.arc(rx + pt.x, ry + pt.y, 1 + pt.life * 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  const crashed = phase === "crashed";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border shadow-orbit">
      <canvas ref={canvasRef} className="block h-[340px] w-full sm:h-[440px]" />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-muted-foreground">
          {phase === "betting"
            ? (countdownLabel ?? "Boarding")
            : phase === "running"
              ? "In flight"
              : crashed
                ? "Ignition lost"
                : "Prepping launch"}
        </p>
        <p
          className={`mt-2 font-display text-6xl font-extrabold tabular-nums drop-shadow-[0_0_28px_rgba(150,90,255,0.55)] sm:text-7xl ${
            crashed ? "text-destructive" : "text-thrust"
          }`}
        >
          {formatMultiplier(multiplier)}
        </p>
      </div>
    </div>
  );
}

function drawRocket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  thrusting: boolean,
  now: number,
) {
  ctx.save();
  ctx.translate(x, y + (thrusting ? Math.sin(now / 90) * 1.5 : Math.sin(now / 600) * 6));
  const tilt = thrusting ? Math.sin(now / 220) * 0.05 : 0;
  ctx.rotate(tilt);

  // Exhaust flame.
  if (thrusting) {
    const flame = 26 + Math.sin(now / 45) * 10;
    const g = ctx.createLinearGradient(0, 16, 0, 16 + flame);
    g.addColorStop(0, "rgba(255,240,180,0.95)");
    g.addColorStop(0.4, "rgba(255,140,60,0.7)");
    g.addColorStop(1, "rgba(255,60,60,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-7, 16);
    ctx.quadraticCurveTo(0, 16 + flame, 7, 16);
    ctx.closePath();
    ctx.fill();
  }

  // Fins.
  ctx.fillStyle = "#8b5cf6";
  ctx.beginPath();
  ctx.moveTo(-6, 4);
  ctx.lineTo(-15, 18);
  ctx.lineTo(-6, 16);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6, 4);
  ctx.lineTo(15, 18);
  ctx.lineTo(6, 16);
  ctx.closePath();
  ctx.fill();

  // Body.
  const body = ctx.createLinearGradient(-8, 0, 8, 0);
  body.addColorStop(0, "#cfd8ff");
  body.addColorStop(0.5, "#ffffff");
  body.addColorStop(1, "#9aa5d8");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.quadraticCurveTo(9, -10, 8, 16);
  ctx.lineTo(-8, 16);
  ctx.quadraticCurveTo(-9, -10, 0, -30);
  ctx.closePath();
  ctx.fill();

  // Nose cone + window.
  ctx.fillStyle = "#f43f8e";
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.quadraticCurveTo(6, -20, 4.5, -14);
  ctx.lineTo(-4.5, -14);
  ctx.quadraticCurveTo(-6, -20, 0, -30);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#22d3ee";
  ctx.beginPath();
  ctx.arc(0, -4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}