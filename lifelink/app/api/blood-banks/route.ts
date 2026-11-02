import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type GeoResult = { lat: string; lon: string; display_name: string };
type OSMElement = {
  type: string; id: number; lat?: number; lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const MAX_RESULTS = 10;

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

const USER_AGENT = process.env.LIFELINK_OSM_USER_AGENT || 'LifeLinkPortfolioApp/1.1 (blood-bank discovery; configure LIFELINK_OSM_USER_AGENT with a maintainer contact)';
const responseCache = new Map<string, { expires: number; payload: unknown }>();
let lastGeocodeAt = 0;
let geocodeQueue: Promise<unknown> = Promise.resolve();

async function geocodeOnce(url: URL): Promise<GeoResult[]> {
  const task = geocodeQueue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastGeocodeAt));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    lastGeocodeAt = Date.now();
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(12000), cache: 'no-store' });
    if (!response.ok) throw new Error('Location lookup service is temporarily unavailable.');
    return await response.json() as GeoResult[];
  });
  geocodeQueue = task.then(() => undefined, () => undefined);
  return task;
}

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get('state')?.trim();
  const city = request.nextUrl.searchParams.get('city')?.trim();
  const sector = request.nextUrl.searchParams.get('sector')?.trim();
  if (!state || !city) {
    return NextResponse.json({ error: 'Please enter both state and city. Sector is optional.' }, { status: 400 });
  }
  if ([state, city, sector ?? ''].some(v => v.length > 100)) {
    return NextResponse.json({ error: 'Location fields must be 100 characters or fewer.' }, { status: 400 });
  }

  const locationQuery = [sector, city, state, 'India'].filter(Boolean).join(', ');
  const cacheKey = locationQuery.toLowerCase();
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return NextResponse.json(cached.payload);
  try {
    // One user-triggered geocoding request. Do not use this endpoint for autocomplete or bulk lookups.
    const geocodeUrl = new URL('https://nominatim.openstreetmap.org/search');
    geocodeUrl.searchParams.set('q', locationQuery);
    geocodeUrl.searchParams.set('format', 'jsonv2');
    geocodeUrl.searchParams.set('limit', '1');
    const geo = await geocodeOnce(geocodeUrl);
    if (!geo.length) return NextResponse.json({ error: 'We could not find that location. Check the state, city and sector spelling.' }, { status: 404 });

    const lat = Number(geo[0].lat);
    const lon = Number(geo[0].lon);
    const radius = 40000;
    const query = `[out:json][timeout:25];(node["amenity"="blood_bank"](around:${radius},${lat},${lon});way["amenity"="blood_bank"](around:${radius},${lat},${lon});relation["amenity"="blood_bank"](around:${radius},${lat},${lon});node["healthcare"="blood_bank"](around:${radius},${lat},${lon});way["healthcare"="blood_bank"](around:${radius},${lat},${lon});relation["healthcare"="blood_bank"](around:${radius},${lat},${lon});node["healthcare"="blood_donation"](around:${radius},${lat},${lon});way["healthcare"="blood_donation"](around:${radius},${lat},${lon});relation["healthcare"="blood_donation"](around:${radius},${lat},${lon}););out center tags;`;
    const overpassResponse = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'User-Agent': USER_AGENT },
      body: query,
      signal: AbortSignal.timeout(35000),
      cache: 'no-store',
    });
    if (!overpassResponse.ok) throw new Error('The open map directory is busy. Please try again in a minute.');
    const data = (await overpassResponse.json()) as { elements?: OSMElement[] };
    const seen = new Set<string>();
    const banks = (data.elements ?? []).flatMap((item) => {
      const itemLat = item.lat ?? item.center?.lat;
      const itemLon = item.lon ?? item.center?.lon;
      if (itemLat == null || itemLon == null) return [];
      const tags = item.tags ?? {};
      const name = tags.name || tags['name:en'] || tags.operator || 'Blood bank (name not listed)';
      const key = `${name.toLowerCase()}-${itemLat.toFixed(4)}-${itemLon.toFixed(4)}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        id: `${item.type}-${item.id}`,
        name,
        lat: itemLat,
        lon: itemLon,
        address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:city'] || tags['addr:district']].filter(Boolean).join(', '),
        phone: tags.phone || tags['contact:phone'] || '',
        website: tags.website || tags['contact:website'] || '',
        openingHours: tags.opening_hours || '',
        category: tags.healthcare || tags.amenity || 'blood_bank',
        source: 'OpenStreetMap',
      }];
    });
    const nearestTen = banks
      .map(bank => ({ ...bank, distanceKm: distanceKm(lat, lon, bank.lat, bank.lon) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, MAX_RESULTS);
    const payload = {
      searchedLocation: geo[0].display_name,
      origin: { lat, lon },
      radiusKm: radius / 1000,
      resultLimit: MAX_RESULTS,
      results: nearestTen,
      source: 'OpenStreetMap contributors',
      message: banks.length ? undefined : 'No blood banks are mapped in this area. This does not mean none exist. Check the official e-RaktKosh directory below.',
    };
    responseCache.set(cacheKey, { expires: Date.now() + 10 * 60 * 1000, payload });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not search blood banks right now.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
