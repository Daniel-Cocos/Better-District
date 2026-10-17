// Keeps place search inside the city (west, north, east, south)
const VIEWBOX = '-1.48,50.96,-1.33,50.87'

/**
 * OpenStreetMap's free geocoder, limited to Southampton. Call once per search,
 * never per keystroke. Resolves to null when nothing matches; rejects when offline.
 */
export async function searchPlace(query: string): Promise<[number, number] | null> {
  const params = new URLSearchParams({ q: query, format: 'json', limit: '1', viewbox: VIEWBOX, bounded: '1' })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`)
  const [hit] = (await res.json()) as { lat: string; lon: string }[]
  return hit ? [Number(hit.lat), Number(hit.lon)] : null
}
