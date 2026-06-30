// realtime.js
function initRealtime() {
  db.channel('days-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'days',
      filter: 'itinerary_id=eq.' + window.TRIP_ITINERARY_ID,
    }, (payload) => {
      handleDayChange(payload);
    })
    .subscribe();
}

function handleDayChange(payload) {
  const { eventType } = payload;
  const newRow = payload.new;
  const oldRow = payload.old;

  if (eventType === 'UPDATE') {
    const idx = DAYS.findIndex(d => d.id === newRow.id);
    if (idx === -1) return;
    if (window._editingDayId === newRow.id) {
      showServerUpdatedIndicator(newRow);
      return;
    }
    DAYS[idx] = newRow;
    renderSidebar(DAYS);
    renderMap(DAYS);
  }

  if (eventType === 'INSERT') {
    DAYS.push(newRow);
    DAYS.sort((a, b) => a.day_index - b.day_index);
    renderSidebar(DAYS);
    renderMap(DAYS);
  }

  if (eventType === 'DELETE') {
    DAYS = DAYS.filter(d => d.id !== oldRow.id);
    renderSidebar(DAYS);
    renderMap(DAYS);
  }
}

// ─── Day Places Realtime ──────────────────────────
function initPlaceRealtime() {
  db.channel('day-places-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'day_places',
    }, (payload) => {
      handlePlaceChange(payload);
    })
    .subscribe();
}

function handlePlaceChange(payload) {
  if (!isDetailMode || detailDayIndex === null) return;
  // Only refresh if the change is for the currently viewed day
  const place = payload.new;
  const old = payload.old;
  const dayId = place ? place.day_id : (old ? old.day_id : null);
  if (dayId !== DAYS[detailDayIndex]?.id) return;

  // Debounce: reload places and re-render
  loadDayPlaces(dayId).then(fresh => {
    places = fresh;
    renderDayDetail(DAYS[detailDayIndex]);
    renderPlaceMap(DAYS[detailDayIndex]);
  });
}

function showServerUpdatedIndicator(newRow) {
  const indicator = document.getElementById('editor-server-update');
  if (!indicator) return;
  indicator.textContent = '\u26a0\ufe0f ข้อมูลบน server เปลี่ยนแล้วขณะที่คุณกำลังแก้';
  indicator.dataset.pendingRow = JSON.stringify(newRow);
  indicator.style.display = 'block';
}
