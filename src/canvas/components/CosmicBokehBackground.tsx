import { memo } from 'react';

interface BokehDot {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  blur: number;
}

const BOKEH_DOTS: BokehDot[] = Array.from({ length: 40 }, (_, i) => {
  const seed = (i + 1) * 19.37;
  const rand = (o: number) => {
    const v = Math.sin(seed + o * 91.73) * 43758.5453;
    return v - Math.floor(v);
  };
  const isWarm = rand(1) > 0.35;
  const isLarge = i % 8 === 0;
  return {
    x: rand(2) * 100,
    y: rand(3) * 100,
    size: isLarge ? 16 + rand(4) * 24 : 2.5 + rand(4) * 4.5,
    color: isWarm ? '#c98a5b' : '#fff7ef',
    opacity: isLarge ? 0.14 + rand(5) * 0.12 : 0.22 + rand(5) * 0.28,
    blur: isLarge ? 3 : 0,
  };
});

export const CosmicBokehBackground = memo(function CosmicBokehBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 22% 28%, rgba(255, 245, 235, 0.55) 0%, transparent 54%), radial-gradient(circle at 78% 72%, rgba(209, 152, 110, 0.24) 0%, transparent 50%), #e8d1bd',
      }}
      aria-hidden="true"
    >
      {BOKEH_DOTS.map((dot, idx) => (
        <span
          key={idx}
          style={{
            position: 'absolute',
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: `${dot.size}px`,
            height: `${dot.size}px`,
            borderRadius: '9999px',
            backgroundColor: dot.color,
            opacity: dot.opacity,
            filter: dot.blur ? `blur(${dot.blur}px)` : undefined,
          }}
        />
      ))}
    </div>
  );
});
