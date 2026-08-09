import { useEffect, useRef } from "react";

import { formatMultiplier } from "@/lib/game-math";

type Phase = "idle" | "betting" | "running" | "crashed";

type Star = { x: number; y: number; z: number; r: number; tw: number };
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hue: number;
  size: number;
};

/**
 * Cinematic space launch stage. Everything here is presentation only —
 * the multiplier and phase come from the server-authoritative game state.
 */
export function RocketStage({
  phase,
  multiplier,
  countdownLabel,
  secondsLeft,
}: {
  phase: Phase;
  multiplier: number;
  countdownLabel?: string;
  secondsLeft?: number | null;
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

    const stars: Star[] = Array.from({ length: 190 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: 0.25 + Math.random() * 1,
      r: 0.4 + Math.random() * 1.4,
      tw: Math.random() * Math.PI * 2,
    }));
    let particles: Particle[] = [];
    let smoke: Particle[] = [];
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
          crashParticles = Array.from({ length: 120 }, () => {
            const a = Math.random() * Math.PI * 2;
            const s = 0.05 + Math.random() * 0.55;
            return {
              x: 0,
              y: 0,
              vx: Math.cos(a) * s,
              vy: Math.sin(a) * s,
              life: 1,
              hue: 20 + Math.random() * 40,
              size: 1 + Math.random() * 3,
            };
          });
        }
        if (p === "betting" || p === "idle") {
          particles = [];
          smoke = [];
          crashParticles = [];
        }
        lastPhase = p;
      }

      // Flight progress drives camera speed and rocket position.
      const climb = Math.min(1, Math.log(Math.max(1, m)) / Math.log(12));
      const speed = p === "running" ? 0.06 + climb * 0.55 : 0.02;

      ctx.clearRect(0, 0, width, height);

      // Deep space gradient.
      const bg = ctx.createLinearGradient(0, 0, width * 0.4, height);
      bg.addColorStop(0, "rgba(9,22,26,1)");
      bg.addColorStop(0.5, "rgba(8,20,18,1)");
      bg.addColorStop(1, "rgba(3,9,10,1)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Distant planet arc (top-left) — slow parallax drift.
      const drift = Math.sin(now / 9000) * 12;
      const pr = Math.max(width, height) * 0.62;
      const pcx = width * 0.16 + drift;
      const pcy = -pr * 0.72 + climb * 26;
      const planet = ctx.createRadialGradient(pcx - pr * 0.3, pcy + pr * 0.5, 0, pcx, pcy, pr);
      planet.addColorStop(0, "rgba(36,72,74,0.55)");
      planet.addColorStop(0.7, "rgba(14,34,36,0.5)");
      planet.addColorStop(1, "rgba(6,16,18,0)");
      ctx.fillStyle = planet;
      ctx.beginPath();
      ctx.arc(pcx, pcy, pr, 0, Math.PI * 2);
      ctx.fill();

      // Nebula haze band.
      const neb = ctx.createRadialGradient(
        width * 0.75,
        height * 0.2,
        0,
        width * 0.75,
        height * 0.2,
        width * 0.5,
      );
      neb.addColorStop(0, "rgba(30,120,110,0.18)");
      neb.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb;
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
      glow.addColorStop(0, `rgba(${p === "crashed" ? "255,90,60" : "40,230,120"},${heat})`);
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

      // Parallax starfield streaming down-left as the rocket climbs right.
      for (const s of stars) {
        s.y += ((speed * s.z * dt) / 16 / height) * 60;
        s.x -= ((speed * s.z * dt) / 16 / width) * 34;
        if (s.y > 1) {
          s.y = 0;
          s.x = Math.random();
        }
        if (s.x < 0) s.x += 1;
        s.tw += dt / 400;
        const trail = p === "running" ? s.z * climb * 30 : 0;
        ctx.globalAlpha = (0.2 + s.z * 0.5) * (0.7 + Math.sin(s.tw) * 0.3);
        ctx.strokeStyle = "rgba(214,235,255,0.9)";
        ctx.lineWidth = s.r * 0.9;
        ctx.beginPath();
        ctx.moveTo(s.x * width + trail * 0.55, s.y * height - trail);
        ctx.lineTo(s.x * width, s.y * height);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Rocket travels along a rising diagonal, like the reference launch shot.
      const rx = width * (0.44 + climb * 0.16);
      const ry = height * (0.74 - climb * 0.42);
      const angle = -Math.PI / 4 + (1 - climb) * 0.12;

      // Nozzle sits behind the rocket along its axis.
      const nozzleX = rx - Math.cos(angle) * 34;
      const nozzleY = ry - Math.sin(angle) * 34;

      if (p !== "crashed") {
        const intensity = p === "running" ? 1 : 0.28;
        for (let i = 0; i < (p === "running" ? 6 : 2); i++) {
          const spread = (Math.random() - 0.5) * 0.5;
          const sp = (1.6 + Math.random() * 2.6 + climb * 3) * intensity;
          particles.push({
            x: nozzleX + (Math.random() - 0.5) * 8,
            y: nozzleY + (Math.random() - 0.5) * 8,
            vx: -Math.cos(angle + spread) * sp,
            vy: -Math.sin(angle + spread) * sp,
            life: 1,
            hue: 118 + Math.random() * 48,
            size: 1.4 + Math.random() * 2.6,
          });
        }
        if (Math.random() < (p === "running" ? 0.9 : 0.3)) {
          const spread = (Math.random() - 0.5) * 0.8;
          smoke.push({
            x: nozzleX,
            y: nozzleY,
            vx: -Math.cos(angle + spread) * (0.6 + Math.random() * 1.1),
            vy: -Math.sin(angle + spread) * (0.6 + Math.random() * 1.1),
            life: 1,
            hue: 150,
            size: 12 + Math.random() * 26,
          });
        }
      }

      // Billowing exhaust cloud behind the flame.
      smoke = smoke.filter((pt) => pt.life > 0);
      for (const pt of smoke) {
        pt.x += pt.vx * (dt / 16);
        pt.y += pt.vy * (dt / 16);
        pt.size += 0.5 * (dt / 16);
        pt.life -= 0.014 * (dt / 16);
        const a = Math.max(0, pt.life);
        const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, pt.size);
        g.addColorStop(0, `rgba(90,240,150,${a * 0.22})`);
        g.addColorStop(1, "rgba(20,60,45,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }

      particles = particles.filter((pt) => pt.life > 0);
      ctx.globalCompositeOperation = "lighter";
      for (const pt of particles) {
        pt.x += pt.vx * (dt / 16);
        pt.y += pt.vy * (dt / 16);
        pt.life -= 0.026 * (dt / 16);
        ctx.globalAlpha = Math.max(0, pt.life) * 0.7;
        ctx.fillStyle = `hsl(${pt.hue} 100% ${58 + pt.life * 30}%)`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * (0.4 + pt.life), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

      if (p !== "crashed") {
        drawRocket(ctx, rx, ry, angle, p === "running", now);
      } else {
        crashParticles = crashParticles.filter((pt) => pt.life > 0);
        ctx.globalCompositeOperation = "lighter";
        for (const pt of crashParticles) {
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          pt.vy += 0.0009 * dt;
          pt.life -= 0.0012 * dt;
          ctx.globalAlpha = Math.max(0, pt.life);
          ctx.fillStyle = `hsl(${pt.hue} 100% ${50 + pt.life * 25}%)`;
          ctx.beginPath();
          ctx.arc(rx + pt.x, ry + pt.y, pt.size * (0.5 + pt.life), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
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

      {/* Countdown dial — top-left, like the reference launch console. */}
      {phase === "betting" ? (
        <div className="pointer-events-none absolute start-4 top-4 w-[168px] rounded-2xl border border-border/70 bg-background/70 p-4 text-center backdrop-blur-md sm:start-6 sm:top-6">
          <CountdownRing seconds={secondsLeft ?? null} />
          <p className="mt-2 text-xs font-bold text-primary">Place your bet</p>
        </div>
      ) : null}

      {/* Multiplier — right side, big and legible over the plume. */}
      <div className="pointer-events-none absolute inset-y-0 end-4 flex flex-col items-end justify-center text-end sm:end-10">
        <p
          dir="ltr"
          className={`font-display text-5xl font-black tabular-nums drop-shadow-[0_0_32px_rgba(40,230,120,0.45)] sm:text-7xl ${
            crashed ? "text-destructive" : "text-foreground"
          }`}
        >
          {formatMultiplier(multiplier)}
        </p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          {phase === "running"
            ? "Current multiplier"
            : crashed
              ? "Crashed"
              : (countdownLabel ?? "Current multiplier")}
        </p>
      </div>
    </div>
  );
}

function CountdownRing({ seconds }: { seconds: number | null }) {
  const total = 10;
  const value = seconds === null ? total : Math.max(0, Math.min(total, seconds));
  const ticks = 40;
  const filled = Math.round((value / total) * ticks);
  return (
    <div className="relative mx-auto grid size-[104px] place-items-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
        {Array.from({ length: ticks }, (_, i) => {
          const a = (i / ticks) * Math.PI * 2;
          const round = (n: number) => Number(n.toFixed(3));
          const x1 = round(50 + Math.cos(a) * 43);
          const y1 = round(50 + Math.sin(a) * 43);
          const x2 = round(50 + Math.cos(a) * 48);
          const y2 = round(50 + Math.sin(a) * 48);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeWidth={3}
              strokeLinecap="round"
              className={i < filled ? "stroke-primary" : "stroke-border"}
            />
          );
        })}
      </svg>
      <div className="text-center leading-none">
        <p className="text-[10px] font-semibold text-muted-foreground">Next round in</p>
        <p className="font-display text-3xl font-black tabular-nums text-foreground">{value}</p>
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground">SEC</p>
      </div>
    </div>
  );
}

function drawRocket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  thrusting: boolean,
  now: number,
) {
  const bob = thrusting ? Math.sin(now / 90) * 1.5 : Math.sin(now / 700) * 7;
  ctx.save();
  ctx.translate(x, y + bob);
  // Canvas rocket is authored nose-up, so rotate onto the flight vector.
  ctx.rotate(angle + Math.PI / 2 + (thrusting ? Math.sin(now / 260) * 0.03 : 0));
  const s = 1.45;
  ctx.scale(s, s);

  // Engine flame.
  if (thrusting) {
    const flame = 30 + Math.sin(now / 42) * 12;
    const g = ctx.createLinearGradient(0, 16, 0, 16 + flame);
    g.addColorStop(0, "rgba(235,255,220,0.95)");
    g.addColorStop(0.35, "rgba(90,245,150,0.8)");
    g.addColorStop(1, "rgba(30,200,120,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-8, 15);
    ctx.quadraticCurveTo(0, 16 + flame, 8, 15);
    ctx.closePath();
    ctx.fill();
  }

  // Fins.
  const fin = ctx.createLinearGradient(-16, 0, 16, 0);
  fin.addColorStop(0, "#12a352");
  fin.addColorStop(1, "#3ff08a");
  ctx.fillStyle = fin;
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.quadraticCurveTo(-18, 12, -14, 19);
  ctx.lineTo(-6, 15);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6, 2);
  ctx.quadraticCurveTo(18, 12, 14, 19);
  ctx.lineTo(6, 15);
  ctx.closePath();
  ctx.fill();

  // Chrome body.
  const body = ctx.createLinearGradient(-9, 0, 9, 0);
  body.addColorStop(0, "#8e9bb4");
  body.addColorStop(0.35, "#ffffff");
  body.addColorStop(0.6, "#e6ecf5");
  body.addColorStop(1, "#7d8aa3");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.quadraticCurveTo(10, -12, 9, 15);
  ctx.lineTo(-9, 15);
  ctx.quadraticCurveTo(-10, -12, 0, -32);
  ctx.closePath();
  ctx.fill();

  // Green nose cone.
  const nose = ctx.createLinearGradient(-6, -32, 6, -14);
  nose.addColorStop(0, "#5ef2a0");
  nose.addColorStop(1, "#0f8f49");
  ctx.fillStyle = nose;
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.quadraticCurveTo(7, -22, 5.5, -14);
  ctx.lineTo(-5.5, -14);
  ctx.quadraticCurveTo(-7, -22, 0, -32);
  ctx.closePath();
  ctx.fill();

  // Green banding near the base.
  ctx.fillStyle = "rgba(35,215,120,0.9)";
  ctx.fillRect(-8.4, 8, 16.8, 4);

  // Porthole.
  const glass = ctx.createRadialGradient(-1.4, -6.5, 0, 0, -5, 5.2);
  glass.addColorStop(0, "#0b2a25");
  glass.addColorStop(1, "#04120f");
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.arc(0, -5, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,250,180,0.85)";
  ctx.lineWidth = 1.3;
  ctx.stroke();

  ctx.restore();
}