/* Deterministic Orb identity from a seed — every Crew member is an Orb, but
   each one is distinct. We stay strictly inside the cold palette: hues are
   constrained to the green→blue arc (roughly 150°–215° in HSL). */

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface OrbIdentity {
  hueA: number;
  hueB: number;
  angle: number;
  gradient: string;
  glow: string;
  initials: string;
}

export function orbIdentity(seed: string, name?: string): OrbIdentity {
  const h = hashSeed(seed || "anon");
  // Constrain to the cold arc: green(150) → teal(168) → cyan(190) → blue(212).
  const hueA = 150 + (h % 35); // 150–185
  const hueB = 188 + ((h >> 8) % 27); // 188–215
  const angle = 90 + ((h >> 16) % 180);
  const gradient = `linear-gradient(${angle}deg, hsl(${hueA} 100% 60%), hsl(${hueB} 100% 55%))`;
  const glow = `hsl(${(hueA + hueB) / 2} 100% 60% / 0.35)`;
  return {
    hueA,
    hueB,
    angle,
    gradient,
    glow,
    initials: initialsFromName(name || seed),
  };
}

export function initialsFromName(name: string): string {
  const cleaned = name.replace(/^@/, "").trim();
  if (!cleaned) return "··";
  const parts = cleaned.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}
