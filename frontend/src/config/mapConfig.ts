// Configuration for WasteTrace AI Geospatial & Mapping Services
// Focused on East Delhi (Laxmi Nagar, Nirman Vihar, Preet Vihar, Shakarpur, Pandav Nagar)

export const MAP_CONFIG = {
  // Default coordinates: Laxmi Nagar, East Delhi
  defaultCenter: [28.6304, 77.2777] as [number, number],
  defaultZoom: 14,
  minZoom: 10,
  maxZoom: 19,

  // Replaceable tile provider configuration
  tileLayerUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileLayerAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors | WasteTrace Delhi MVP',

  // Bounding box for Delhi NCR region to validate user coordinates
  delhiBounds: {
    minLat: 28.40,
    maxLat: 28.88,
    minLng: 76.84,
    maxLng: 77.50,
  }
};

export interface DelhiLandmark {
  name: string;
  locality: string;
  zone: string;
  latitude: number;
  longitude: number;
  address: string;
}

// Curated high-precision Delhi reference points for instantaneous search & offline fallback
export const CURATED_DELHI_LOCATIONS: DelhiLandmark[] = [
  {
    name: 'Laxmi Nagar Metro Station (Gate 2)',
    locality: 'Laxmi Nagar',
    zone: 'East Delhi - Zone A',
    latitude: 28.6304,
    longitude: 77.2777,
    address: 'Vikas Marg, Laxmi Nagar, East Delhi 110092'
  },
  {
    name: 'V3S Mall / Nirman Vihar Metro',
    locality: 'Nirman Vihar',
    zone: 'East Delhi - Zone A',
    latitude: 28.6369,
    longitude: 77.2842,
    address: 'Vikas Marg near Concourse, Nirman Vihar, East Delhi 110092'
  },
  {
    name: 'Preet Vihar Commercial Centre (Metro Pillar 104)',
    locality: 'Preet Vihar',
    zone: 'East Delhi - Zone B',
    latitude: 28.6416,
    longitude: 77.2965,
    address: 'Vikas Marg Commercial Arcade, Preet Vihar, East Delhi 110092'
  },
  {
    name: 'Shakarpur Main Market & School Block',
    locality: 'Shakarpur',
    zone: 'East Delhi - Zone A',
    latitude: 28.6258,
    longitude: 77.2772,
    address: 'School Block Road, Shakarpur, East Delhi 110092'
  },
  {
    name: 'Pandav Nagar Culvert & Mother Dairy Plant',
    locality: 'Pandav Nagar',
    zone: 'East Delhi - Zone C',
    latitude: 28.6200,
    longitude: 77.2830,
    address: 'Mother Dairy Flyover & Stormwater Canal, Pandav Nagar, East Delhi 110092'
  },
  {
    name: 'Patparganj Industrial Area (Road 57)',
    locality: 'Patparganj',
    zone: 'East Delhi - Zone D',
    latitude: 28.6300,
    longitude: 77.3000,
    address: 'Road No. 57 Commercial Yard, Patparganj, East Delhi 110092'
  },
  {
    name: 'Swasthya Vihar Community Green Park',
    locality: 'Swasthya Vihar',
    zone: 'East Delhi - Zone B',
    latitude: 28.6380,
    longitude: 77.2900,
    address: 'Main Park Boundary Road, Swasthya Vihar, East Delhi 110092'
  },
  {
    name: 'Anand Vihar ISBT & Railway Terminal Footpath',
    locality: 'Anand Vihar',
    zone: 'East Delhi - Zone E',
    latitude: 28.6470,
    longitude: 77.3150,
    address: 'Inter-State Bus Terminal Concourse, Anand Vihar, East Delhi 110092'
  },
  {
    name: 'Akshardham Metro Station / Mandir Marg',
    locality: 'Pandav Nagar / Akshardham',
    zone: 'East Delhi - Zone C',
    latitude: 28.6180,
    longitude: 77.2785,
    address: 'NH-24 Corridor, near Akshardham Metro, East Delhi 110092'
  },
  {
    name: 'ITO Chungi & Geeta Colony Pusta Road',
    locality: 'Geeta Colony',
    zone: 'East Delhi - Zone F',
    latitude: 28.6450,
    longitude: 77.2700,
    address: 'Pusta Road, Geeta Colony, East Delhi 110031'
  },
  {
    name: 'Mayur Vihar Phase 1 Pocket 1 Commercial Market',
    locality: 'Mayur Vihar',
    zone: 'East Delhi - Zone G',
    latitude: 28.6050,
    longitude: 77.2950,
    address: 'Pocket 1 DDA Market, Mayur Vihar Phase 1, East Delhi 110091'
  }
];

// Helper to compute Euclidean approx distance for quick local snapping
export function getNearestDelhiLandmark(lat: number, lon: number): { landmark: DelhiLandmark; distanceKm: number } {
  let nearest = CURATED_DELHI_LOCATIONS[0];
  let minDiff = Infinity;

  for (const loc of CURATED_DELHI_LOCATIONS) {
    const dLat = loc.latitude - lat;
    const dLon = loc.longitude - lon;
    const distSq = dLat * dLat + dLon * dLon;
    if (distSq < minDiff) {
      minDiff = distSq;
      nearest = loc;
    }
  }

  // Rough distance in kilometers
  const distKm = Math.sqrt(minDiff) * 111.0;
  return { landmark: nearest, distanceKm: distKm };
}

// Reverse Geocoding with Nominatim + Local Delhi Landmark Fallback
export async function reverseGeocodeCoords(lat: number, lon: number): Promise<{
  address: string;
  source: 'Nominatim OpenStreetMap' | 'Curated Delhi Vicinity Fallback';
  isFallback: boolean;
}> {
  // Basic boundary check
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error('Coordinates are outside valid global bounds.');
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'WasteTrace-AI-Delhi-Hackathon/1.0'
        },
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        return {
          address: data.display_name,
          source: 'Nominatim OpenStreetMap',
          isFallback: false
        };
      }
    }
  } catch (e) {
    // Graceful fallback to nearest Delhi landmark
  }

  const { landmark, distanceKm } = getNearestDelhiLandmark(lat, lon);
  const approxDistanceText = distanceKm < 0.1 ? 'At' : `Approx ${(distanceKm * 1000).toFixed(0)}m from`;
  return {
    address: `${approxDistanceText} ${landmark.name}, ${landmark.address}`,
    source: 'Curated Delhi Vicinity Fallback',
    isFallback: true
  };
}

// Forward search with Nominatim + Curated Delhi local match
export async function searchDelhiAddress(query: string): Promise<Array<{
  displayName: string;
  latitude: number;
  longitude: number;
  source: string;
}>> {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return [];

  const results: Array<{ displayName: string; latitude: number; longitude: number; source: string }> = [];

  // 1. Check local curated landmarks first
  for (const loc of CURATED_DELHI_LOCATIONS) {
    if (
      loc.name.toLowerCase().includes(cleanQ) ||
      loc.locality.toLowerCase().includes(cleanQ) ||
      loc.address.toLowerCase().includes(cleanQ) ||
      loc.zone.toLowerCase().includes(cleanQ)
    ) {
      results.push({
        displayName: `${loc.name} (${loc.locality}, ${loc.zone})`,
        latitude: loc.latitude,
        longitude: loc.longitude,
        source: 'Curated Delhi Landmark'
      });
    }
  }

  // 2. Query Nominatim if online and query is substantial
  if (cleanQ.length >= 3) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      // Restrict search viewbox to Delhi NCR
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Delhi')}&format=json&limit=5&countrycodes=in`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'WasteTrace-AI-Delhi-Hackathon/1.0'
          },
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        for (const item of data) {
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          // Avoid duplicate entries
          if (!results.some(r => Math.abs(r.latitude - lat) < 0.001 && Math.abs(r.longitude - lon) < 0.001)) {
            results.push({
              displayName: item.display_name,
              latitude: lat,
              longitude: lon,
              source: 'OpenStreetMap Nominatim'
            });
          }
        }
      }
    } catch (e) {
      // Return local results if search fails
    }
  }

  return results;
}

