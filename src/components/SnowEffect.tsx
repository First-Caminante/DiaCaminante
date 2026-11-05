import React, { useEffect, useRef } from 'react';

interface Snowflake {
  x: number;
  y: number;
  radius: number;
  speed: number;
  swaySpeed: number;
  swayAngle: number;
  opacity: number;
}

export const SnowEffect: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Nieve abundante y serena (capas múltiples para profundidad estética zen)
    const flakeCount = Math.min(220, Math.max(120, Math.floor((width * height) / 6000)));
    const flakes: Snowflake[] = [];

    for (let i = 0; i < flakeCount; i++) {
      const isForeground = i % 8 === 0;
      const isMidground = i % 3 === 0;
      
      const radius = isForeground
        ? Math.random() * 1.8 + 2.2
        : isMidground
        ? Math.random() * 1.2 + 1.2
        : Math.random() * 0.9 + 0.6;

      const speed = isForeground
        ? Math.random() * 0.9 + 0.65
        : isMidground
        ? Math.random() * 0.6 + 0.4
        : Math.random() * 0.35 + 0.2;

      const opacity = isForeground
        ? Math.random() * 0.4 + 0.6
        : isMidground
        ? Math.random() * 0.4 + 0.35
        : Math.random() * 0.3 + 0.2;

      flakes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius,
        speed,
        swaySpeed: Math.random() * 0.02 + 0.006,
        swayAngle: Math.random() * Math.PI * 2,
        opacity,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < flakes.length; i++) {
        const flake = flakes[i];

        flake.y += flake.speed;
        flake.swayAngle += flake.swaySpeed;
        flake.x += Math.sin(flake.swayAngle) * 0.5;

        // Si sale por el fondo, volver a la parte superior
        if (flake.y > height) {
          flake.y = -6;
          flake.x = Math.random() * width;
        }

        // Si sale por los costados
        if (flake.x > width) flake.x = 0;
        else if (flake.x < 0) flake.x = width;

        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240, 245, 255, ${flake.opacity})`;
        if (flake.radius > 2.0) {
          ctx.shadowBlur = 6;
          ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-90"
      aria-hidden="true"
    />
  );
};
