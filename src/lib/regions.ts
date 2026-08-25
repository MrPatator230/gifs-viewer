/**
 * Approximate French region lookup from a geographic point.
 * GTFS feeds carry no region field, so we derive it from stop coordinates
 * by picking the nearest region centroid.
 */
const REGION_CENTERS: { name: string; lat: number; lon: number }[] = [
  { name: "Auvergne-Rhône-Alpes", lat: 45.5, lon: 4.5 },
  { name: "Bourgogne-Franche-Comté", lat: 47.2, lon: 4.8 },
  { name: "Bretagne", lat: 48.2, lon: -2.9 },
  { name: "Centre-Val de Loire", lat: 47.5, lon: 1.7 },
  { name: "Corse", lat: 42.15, lon: 9.1 },
  { name: "Grand Est", lat: 48.7, lon: 5.6 },
  { name: "Hauts-de-France", lat: 49.9, lon: 2.8 },
  { name: "Île-de-France", lat: 48.75, lon: 2.5 },
  { name: "Normandie", lat: 49.1, lon: 0.1 },
  { name: "Nouvelle-Aquitaine", lat: 45.2, lon: 0.2 },
  { name: "Occitanie", lat: 43.7, lon: 2.0 },
  { name: "Pays de la Loire", lat: 47.5, lon: -0.8 },
  { name: "Provence-Alpes-Côte d'Azur", lat: 43.9, lon: 6.0 },
];

export const UNKNOWN_REGION = "Région inconnue";

export function getRegionForPoint(lat: number, lon: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return UNKNOWN_REGION;
  // Outside metropolitan France bounds → unknown
  if (lat < 41 || lat > 51.5 || lon < -5.5 || lon > 10) return UNKNOWN_REGION;

  let best = UNKNOWN_REGION;
  let bestD = Infinity;
  for (const r of REGION_CENTERS) {
    // rough equirectangular distance
    const dx = (lon - r.lon) * Math.cos((lat * Math.PI) / 180);
    const dy = lat - r.lat;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = r.name;
    }
  }
  return best;
}
