#!/bin/sh
cat > config.js << EOF
window.SUPABASE_URL=$(printf '%s' "$SUPABASE_URL" | sed "s/'/\\\\'/g");
window.SUPABASE_ANON_KEY=$(printf '%s' "$SUPABASE_ANON_KEY" | sed "s/'/\\\\'/g");
window.TRIP_ITINERARY_ID=$(printf '%s' "$TRIP_ITINERARY_ID" | sed "s/'/\\\\'/g");
window.TRIP_DEPARTURE_DATE=$(printf '%s' "$TRIP_DEPARTURE_DATE" | sed "s/'/\\\\'/g");
window.MAPTILER_KEY=$(printf '%s' "$MAPTILER_KEY" | sed "s/'/\\\\'/g");
window.UNSPLASH_ACCESS_KEY=$(printf '%s' "$UNSPLASH_ACCESS_KEY" | sed "s/'/\\\\'/g");
EOF
