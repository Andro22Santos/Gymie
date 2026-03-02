import React, { useEffect, useState } from 'react';

const COLORS = ['#00E04B', '#F97316', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#22D3EE'];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function Confetti({ active, onComplete }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!active) { setParticles([]); return; }

    const pts = Array.from({ length: 55 }, (_, i) => ({
      id: i,
      x: rand(5, 95),
      delay: rand(0, 600),
      duration: rand(900, 1500),
      color: COLORS[rand(0, COLORS.length - 1)],
      size: rand(6, 13),
      isCircle: rand(0, 1) === 0,
      rotation: rand(0, 360),
    }));
    setParticles(pts);

    const timer = setTimeout(() => {
      setParticles([]);
      onComplete?.();
    }, 2200);
    return () => clearTimeout(timer);
  }, [active, onComplete]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[250] overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${p.x}%`,
            top: '-16px',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.isCircle ? '50%' : '2px',
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.duration}ms`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
}
