function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Starfield({ count = 80, seed = 1729 }: { count?: number; seed?: number }) {
  const rand = mulberry32(seed);
  const stars = Array.from({ length: count }, () => ({
    x: rand() * 100,
    y: rand() * 100,
    r: rand() * 1.2 + 0.2,
    a: rand() * 0.6 + 0.15,
  }));
  return (
    <svg
      aria-hidden
      className="fixed inset-0 w-screen h-screen -z-10 pointer-events-none"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.1} fill="var(--star-color)" opacity={s.a} />
      ))}
    </svg>
  );
}
