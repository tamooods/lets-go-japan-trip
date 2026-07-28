function initRealtime() {
  db.channel('days-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'days',
        filter: 'itinerary_id=eq.' + window.TRIP_ITINERARY_ID,
      },
      (payload) => {
        handleDayChange(payload);
      },
    )
    .subscribe();
}

function handleDayChange(payload) {
  const { eventType } = payload;
  const newRow = payload.new;
  const oldRow = payload.old;
  const currentDetailId = isDetailMode ? DAYS[detailDayIndex]?.id : null;
  let updatedIdx = -1;

  if (eventType === 'UPDATE') {
    const idx = DAYS.findIndex((d) => d.id === newRow.id);
    if (idx === -1) return;
    if (window._editingDayId === newRow.id) {
      showServerUpdatedIndicator(newRow);
      return;
    }
    DAYS[idx] = newRow;
    updatedIdx = idx;
  }

  if (eventType === 'INSERT') {
    if (DAYS.some((d) => d.id === newRow.id)) return;
    DAYS.push(newRow);
    DAYS.sort((a, b) => a.day_index - b.day_index);
  }

  if (eventType === 'DELETE') {
    DAYS = DAYS.filter((d) => d.id !== oldRow.id);
  }

  // Detail view owns #dayList and the map markers while active — skip the
  // sidebar/day-marker re-render so it doesn't clobber that view, and keep
  // detailDayIndex pointing at the right row instead of a stale position.
  if (isDetailMode) {
    if (currentDetailId === null) return;
    const newIdx = DAYS.findIndex((d) => d.id === currentDetailId);
    if (newIdx === -1) {
      exitDetail();
    } else {
      detailDayIndex = newIdx;
    }
    return;
  }

  renderSidebar(DAYS);
  if (updatedIdx !== -1 && refreshMarker(updatedIdx)) return;
  renderMap(DAYS);
}

function initPlaceRealtime() {
  db.channel('day-places-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'day_places',
      },
      (payload) => {
        handlePlaceChange(payload);
      },
    )
    .subscribe();
}

function handlePlaceChange(payload) {
  if (!isDetailMode || detailDayIndex === null) return;
  const place = payload.new;
  const old = payload.old;
  const dayId = place ? place.day_id : old ? old.day_id : null;
  if (dayId !== DAYS[detailDayIndex]?.id) return;

  loadDayPlaces(dayId).then((fresh) => {
    places = fresh;
    renderDayDetail(DAYS[detailDayIndex]);
    renderPlaceMap(DAYS[detailDayIndex]);
  });
}

function showServerUpdatedIndicator(newRow) {
  const indicator = document.getElementById('editor-server-update');
  if (!indicator) return;
  indicator.textContent = '\u26a0\ufe0f ข้อมูลบน server เปลี่ยนแล้วขณะที่คุณกำลังแก้';
  indicator.style.display = 'block';
}
