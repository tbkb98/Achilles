// SES-12: plates per side for a barbell load.
export function plates(load, bar, inventory) {
  let side = Math.round((load - bar) * 500); // per side, in grams
  if (side < 0) return null;
  const out = [];
  for (const p of [...inventory].sort((a, b) => b - a)) {
    const g = Math.round(p * 1000);
    while (side >= g) { out.push(p); side -= g; }
  }
  return { plates: out, leftover: side / 1000 };
}
