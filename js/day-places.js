async function loadDayPlaces(dayId) {
  if (!dayId) return [];
  const { data, error } = await db.rpc('get_day_places', { p_day_id: dayId });
  if (error) {
    console.error('loadDayPlaces error:', error);
    return [];
  }
  return data || [];
}

async function addPlace(dayId, data) {
  const { data: row, error } = await db.rpc('add_day_place', {
    p_day_id: dayId,
    p_name: data.name,
    p_acts: data.acts || [],
    p_expense: data.expense || 0,
    p_split_among: data.split_among || [],
    p_lat: data.lat || null,
    p_lng: data.lng || null,
    p_img: data.img || null,
  });
  if (error) throw error;
  return row;
}

async function updatePlace(id, data) {
  const { data: row, error } = await db.rpc('update_day_place', {
    p_id: id,
    p_name: data.name,
    p_acts: data.acts || [],
    p_expense: data.expense || 0,
    p_split_among: data.split_among || [],
    p_lat: data.lat || null,
    p_lng: data.lng || null,
    p_img: data.img || null,
  });
  if (error) throw error;
  return row;
}

async function deletePlace(id) {
  const { error } = await db.rpc('delete_day_place', { p_id: id });
  if (error) throw error;
}

async function reverseGeocodePlace(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}` +
    '&format=json&accept-language=th&zoom=18';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'LetsGoJapanTrip/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.error) return null;
    return data.name || (data.display_name || '').split(',')[0].trim() || null;
  } catch {
    return null;
  }
}

async function searchPlaceName(query) {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const url =
    'https://nominatim.openstreetmap.org/search?q=' +
    encodeURIComponent(q) +
    '&limit=5&format=json&accept-language=th,en,ja';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'LetsGoJapanTrip/1.0' } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((f) => ({
      name: f.display_name.split(',')[0],
      label: f.display_name,
      lat: parseFloat(f.lat),
      lng: parseFloat(f.lon),
    }));
  } catch {
    return [];
  }
}

async function fetchPlaceImage(placeName) {
  const name = (placeName || '').trim();
  if (!name) return null;

  if (window.UNSPLASH_ACCESS_KEY) {
    try {
      const url =
        'https://api.unsplash.com/search/photos?query=' +
        encodeURIComponent(name + ' Japan') +
        '&per_page=1&orientation=landscape&client_id=' +
        window.UNSPLASH_ACCESS_KEY;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length) {
          return data.results[0].urls.regular;
        }
      }
    } catch {
      /* fall through to Wikipedia */
    }
  }

  try {
    const summaryUrl =
      'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(name);
    const res = await fetch(summaryUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.originalimage && data.originalimage.source) {
        return data.originalimage.source;
      }
      if (data.thumbnail && data.thumbnail.source) {
        return data.thumbnail.source;
      }
    }
  } catch {
    /* fall through to search */
  }

  try {
    const searchUrl =
      'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' +
      encodeURIComponent(name + ' Japan') +
      '&format=json&origin=*';
    const res = await fetch(searchUrl);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.query && data.query.search;
    if (!results || !results.length) return null;

    const title = results[0].title;
    const summaryRes = await fetch(
      'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title),
    );
    if (!summaryRes.ok) return null;
    const summaryData = await summaryRes.json();
    if (summaryData.originalimage && summaryData.originalimage.source) {
      return summaryData.originalimage.source;
    }
    return (summaryData.thumbnail && summaryData.thumbnail.source) || null;
  } catch {
    return null;
  }
}

const _boundaryCache = new Map();
async function fetchDayBoundary(placeName) {
  const name = (placeName || '').trim();
  if (!name) return null;
  if (_boundaryCache.has(name)) return _boundaryCache.get(name);
  const url =
    'https://nominatim.openstreetmap.org/search?q=' +
    encodeURIComponent(name) +
    '&format=json&polygon_geojson=1&limit=1';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'LetsGoJapanTrip/1.0' } });
    if (!res.ok) {
      _boundaryCache.set(name, null);
      return null;
    }
    const data = await res.json();
    if (!data || !data.length) {
      _boundaryCache.set(name, null);
      return null;
    }
    const geojson = data[0].geojson;
    if (!geojson) {
      _boundaryCache.set(name, null);
      return null;
    }
    let coords;
    if (geojson.type === 'Polygon') {
      coords = geojson.coordinates[0].map((c) => [c[1], c[0]]);
    } else if (geojson.type === 'MultiPolygon') {
      const largest = geojson.coordinates.reduce((a, b) => (a[0].length > b[0].length ? a : b));
      coords = largest[0].map((c) => [c[1], c[0]]);
    }
    const result = coords || null;
    _boundaryCache.set(name, result);
    return result;
  } catch {
    _boundaryCache.set(name, null);
    return null;
  }
}

const _thumbCache = new Map();
async function fetchPlaceThumbnail(name) {
  if (_thumbCache.has(name)) return _thumbCache.get(name);
  const url = await fetchPlaceImage(name);
  if (url) _thumbCache.set(name, url);
  return url || null;
}
