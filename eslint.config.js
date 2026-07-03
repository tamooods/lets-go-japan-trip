import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  prettier,
  {
    rules: {
      'no-unused-vars': ['warn', { args: 'none', vars: 'local' }],
      'no-redeclare': 'off',
      'no-console': 'off',
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // CDN libraries
        supabase: 'readonly',
        L: 'readonly',
        // db.js
        db: 'readonly',
        loadDays: 'readonly',
        loadMembers: 'readonly',
        // selection.js
        ensureMemberSelected: 'readonly',
        // script.js — DOM helpers
        el: 'readonly',
        append: 'readonly',
        // script.js — functions
        formatTimeAgo: 'readonly',
        haversineKm: 'readonly',
        renderSidebar: 'readonly',
        renderMap: 'readonly',
        goTo: 'readonly',
        initApp: 'readonly',
        initStatsWidget: 'readonly',
        setActive: 'readonly',
        enterDetail: 'readonly',
        exitDetail: 'readonly',
        renderDayDetail: 'readonly',
        renderPlaceMap: 'readonly',
        focusPlace: 'readonly',
        deletePlaceHandler: 'readonly',
        // realtime.js
        initRealtime: 'readonly',
        initPlaceRealtime: 'readonly',
        handleDayChange: 'readonly',
        handlePlaceChange: 'readonly',
        showServerUpdatedIndicator: 'readonly',
        // editor.js
        openEditor: 'readonly',
        closeEditor: 'readonly',
        saveEditor: 'readonly',
        openPlaceEditor: 'readonly',
        closePlaceEditor: 'readonly',
        savePlaceEditor: 'readonly',
        searchPlaceHandler: 'readonly',
        enablePlacePickMode: 'readonly',
        placePickHandler: 'readonly',
        renderSplitCheckboxes: 'readonly',
        // conflict.js
        openConflictModal: 'readonly',
        closeConflictModal: 'readonly',
        // auth.js
        initAuth: 'readonly',
        // day-places.js
        loadDayPlaces: 'readonly',
        addPlace: 'readonly',
        updatePlace: 'readonly',
        deletePlace: 'readonly',
        searchPlaceName: 'readonly',
        reverseGeocodePlace: 'readonly',
        // script.js — state globals
        DAYS: 'writable',
        map: 'writable',
        markers: 'writable',
        curIdx: 'writable',
        places: 'writable',
        placeMarkers: 'writable',
        isDetailMode: 'writable',
        detailDayIndex: 'writable',
        // config.js / config.example.js
        SUPABASE_URL: 'readonly',
        SUPABASE_ANON_KEY: 'readonly',
        TRIP_ITINERARY_ID: 'readonly',
        TRIP_DEPARTURE_DATE: 'readonly',
      },
    },
  },
  {
    ignores: ['config.js'],
  },
];
