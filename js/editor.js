let _editingDay = null;

function openEditor(day) {
  _editingDay = day;
  window._editingDayId = day.id;
  const det = day.details;

  let place = det.place || '';
  if (!det.date && place.includes('_')) {
    place = place.split('_')[0].trim();
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(det.date || '') ? det.date : '';

  document.getElementById('editor-title').textContent = 'แก้ไข: ' + place;
  document.getElementById('editor-place').value = place;
  document.getElementById('editor-date').value = date;
  document.getElementById('editor-acts').value = (det.acts || []).join('\n');
  [
    ['editor-place', 'editor-place-error'],
    ['editor-date', 'editor-date-error'],
    ['editor-acts', 'editor-acts-error'],
  ].forEach(([fieldId, errorId]) => {
    document.getElementById(fieldId).classList.remove('invalid');
    document.getElementById(errorId).classList.add('hidden');
  });
  document.getElementById('editor-server-update').style.display = 'none';
  document.getElementById('editor-modal').classList.remove('hidden');
}

function closeEditor() {
  _editingDay = null;
  window._editingDayId = null;
  document.getElementById('editor-modal').classList.add('hidden');
}

function validateEditorField(fieldId, errorId, isValid) {
  const field = document.getElementById(fieldId);
  const error = document.getElementById(errorId);
  field.classList.toggle('invalid', !isValid);
  error.classList.toggle('hidden', isValid);
  return isValid;
}

async function saveEditor() {
  if (!_editingDay) return;

  const place = document.getElementById('editor-place').value.trim();
  const date = document.getElementById('editor-date').value.trim();
  const acts = document
    .getElementById('editor-acts')
    .value.split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const placeOk = validateEditorField('editor-place', 'editor-place-error', !!place);
  const dateOk = validateEditorField('editor-date', 'editor-date-error', !!date);
  const actsOk = validateEditorField('editor-acts', 'editor-acts-error', acts.length > 0);
  if (!placeOk || !dateOk || !actsOk) {
    (document.querySelector('#editor-modal .invalid') || {}).focus?.();
    return;
  }

  const saveBtn = document.getElementById('editor-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'กำลังบันทึก...';

  const newDetails = Object.assign({}, _editingDay.details, { place, date, acts });
  const { data, error } = await db.rpc('update_day_if_version', {
    p_id: _editingDay.id,
    p_expected_version: _editingDay.version,
    p_changes: newDetails,
    p_actor: window.currentMember ? window.currentMember.name : null,
    p_actor_at: new Date().toISOString(),
  });

  saveBtn.disabled = false;
  saveBtn.textContent = 'บันทึก';

  if (error) {
    alert('เกิดข้อผิดพลาด: ' + error.message);
    return;
  }
  if (!data.ok) {
    if (data.error === 'conflict') openConflictModal(_editingDay, newDetails, data.current);
    return;
  }

  const idx = DAYS.findIndex((d) => d.id === _editingDay.id);
  if (idx !== -1) {
    DAYS[idx] = data.row;
    renderSidebar(DAYS);
    renderMap(DAYS);
  }
  closeEditor();
}

document.getElementById('editor-place').addEventListener('input', (e) => {
  e.target.classList.remove('invalid');
  document.getElementById('editor-place-error').classList.add('hidden');
});
document.getElementById('editor-date').addEventListener('input', (e) => {
  e.target.classList.remove('invalid');
  document.getElementById('editor-date-error').classList.add('hidden');
});
document.getElementById('editor-acts').addEventListener('input', (e) => {
  e.target.classList.remove('invalid');
  document.getElementById('editor-acts-error').classList.add('hidden');
});
document.getElementById('editor-save').addEventListener('click', saveEditor);
document.getElementById('editor-cancel').addEventListener('click', closeEditor);
document.getElementById('editor-close').addEventListener('click', closeEditor);

let _editingPlace = null;
let _editingPlaceDay = null;
let _pendingLat = null;
let _pendingLng = null;
let _placePickMode = false;

function openPlaceEditor(day, place) {
  _editingPlaceDay = day;
  _editingPlace = place;

  const isNew = !place;
  document.getElementById('place-editor-title').textContent = isNew
    ? 'เพิ่มสถานที่'
    : 'แก้ไขสถานที่';
  const nameInput = document.getElementById('place-editor-name');
  nameInput.value = place ? place.name || '' : '';
  nameInput.classList.remove('invalid');
  document.getElementById('place-editor-name-error').classList.add('hidden');
  const actsArr =
    place && place.acts ? (Array.isArray(place.acts) ? place.acts : JSON.parse(place.acts)) : [];
  document.getElementById('place-editor-acts').value = actsArr.join('\n');
  document.getElementById('place-editor-expense').value = place ? place.expense || 0 : 0;
  _pendingLat = place ? place.lat || null : null;
  _pendingLng = place ? place.lng || null : null;
  document.getElementById('place-editor-search').value = '';
  document.getElementById('place-editor-results').classList.add('hidden');
  document.getElementById('place-editor-results').textContent = '';

  renderSplitCheckboxes(place);

  document.getElementById('place-editor-modal').classList.remove('hidden');
}

function renderSplitCheckboxes(place) {
  const container = document.getElementById('place-editor-split');
  container.textContent = '';
  const selected = (place && place.split_among) || [];
  if (!window.members || !window.members.length) {
    container.innerHTML = '<span style="font-size:0.8rem;color:var(--gray)">ไม่มีสมาชิก</span>';
    return;
  }
  const allLabel = document.createElement('label');
  const allCb = document.createElement('input');
  allCb.type = 'checkbox';
  allCb.checked = selected.length === window.members.length;
  allCb.addEventListener('change', () => {
    container
      .querySelectorAll('input[type="checkbox"][value]')
      .forEach((cb) => (cb.checked = allCb.checked));
  });
  allLabel.appendChild(allCb);
  allLabel.appendChild(document.createTextNode(' ทั้งหมด'));
  container.appendChild(allLabel);

  window.members.forEach((m) => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = m.id;
    cb.checked = selected.includes(m.id);
    cb.addEventListener('change', () => {
      allCb.checked = [...container.querySelectorAll('input[type="checkbox"][value]')].every(
        (c) => c.checked
      );
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + m.name));
    container.appendChild(label);
  });
}

function closePlaceEditor() {
  _editingPlace = null;
  _editingPlaceDay = null;
  _pendingLat = null;
  _pendingLng = null;
  _placePickMode = false;
  const modal = document.getElementById('place-editor-modal');
  modal.classList.add('hidden');
  modal.classList.remove('picking');
  document.getElementById('place-editor-search').placeholder = 'ค้นหาชื่อสถานที่...';
  if (map) map.off('click', placePickHandler);
}

async function savePlaceEditor() {
  const nameInput = document.getElementById('place-editor-name');
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.classList.add('invalid');
    document.getElementById('place-editor-name-error').classList.remove('hidden');
    nameInput.focus();
    return;
  }

  const acts = document
    .getElementById('place-editor-acts')
    .value.split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const expense = parseFloat(document.getElementById('place-editor-expense').value) || 0;
  const lat = _pendingLat;
  const lng = _pendingLng;

  const splitCheckboxes = document.querySelectorAll(
    '#place-editor-split input[type="checkbox"]:checked',
  );
  const split_among = Array.from(splitCheckboxes).map((cb) => cb.value);

  const data = { name, acts, expense, split_among, lat, lng };

  try {
    if (_editingPlace) {
      await updatePlace(_editingPlace.id, data);
    } else {
      await addPlace(_editingPlaceDay.id, data);
    }
    const day = _editingPlaceDay;
    closePlaceEditor();
    places = await loadDayPlaces(day.id);
    renderDayDetail(day);
    renderPlaceMap(day);
  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + err.message);
  }
}

async function searchPlaceHandler() {
  const q = document.getElementById('place-editor-search').value.trim();
  if (!q) return;
  const results = await searchPlaceName(q);
  const container = document.getElementById('place-editor-results');
  container.textContent = '';
  if (!results.length) {
    container.innerHTML = '<div class="search-result-item">ไม่พบสถานที่ ลองคลิกบนแผนที่</div>';
  } else {
    results.forEach((r) => {
      const item = el('div', 'search-result-item', r.label);
      item.addEventListener('click', () => {
        _pendingLat = r.lat;
        _pendingLng = r.lng;
        document.getElementById('place-editor-name').value = r.name;
        container.classList.add('hidden');
      });
      container.appendChild(item);
    });
  }
  container.classList.remove('hidden');
}

function enablePlacePickMode() {
  _placePickMode = true;
  document.getElementById('place-editor-modal').classList.add('picking');
  document.getElementById('place-editor-search').placeholder = 'คลิกบนแผนที่เพื่อเลือกพิกัด...';
  map.once('click', placePickHandler);
}

async function placePickHandler(e) {
  _pendingLat = e.latlng.lat;
  _pendingLng = e.latlng.lng;
  _placePickMode = false;
  document.getElementById('place-editor-modal').classList.remove('picking');
  const searchInput = document.getElementById('place-editor-search');
  searchInput.placeholder = 'ค้นหาชื่อสถานที่...';
  searchInput.value = `📍 ${_pendingLat.toFixed(5)}, ${_pendingLng.toFixed(5)}`;

  const nameInput = document.getElementById('place-editor-name');
  if (nameInput.value.trim()) return;

  nameInput.placeholder = 'กำลังค้นหาชื่อสถานที่...';
  const name = await reverseGeocodePlace(_pendingLat, _pendingLng);
  nameInput.placeholder = 'เช่น วัดคินคะคุจิ';
  if (name && !nameInput.value.trim()) nameInput.value = name;
}

document.getElementById('place-editor-name').addEventListener('input', (e) => {
  e.target.classList.remove('invalid');
  document.getElementById('place-editor-name-error').classList.add('hidden');
});
document.getElementById('place-editor-save').addEventListener('click', savePlaceEditor);
document.getElementById('place-editor-cancel').addEventListener('click', closePlaceEditor);
document.getElementById('place-editor-close').addEventListener('click', closePlaceEditor);
document.getElementById('place-editor-search-btn').addEventListener('click', searchPlaceHandler);
let _searchTimer;
document.getElementById('place-editor-search').addEventListener('input', () => {
  clearTimeout(_searchTimer);
  const q = document.getElementById('place-editor-search').value.trim();
  if (!q) {
    document.getElementById('place-editor-results').classList.add('hidden');
    return;
  }
  _searchTimer = setTimeout(searchPlaceHandler, 300);
});
document.getElementById('place-editor-search').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    clearTimeout(_searchTimer);
    searchPlaceHandler();
  }
});

document.getElementById('place-editor-pick-btn').addEventListener('click', () => {
  enablePlacePickMode();
});
document.getElementById('place-pick-cancel').addEventListener('click', () => {
  _placePickMode = false;
  document.getElementById('place-editor-modal').classList.remove('picking');
  document.getElementById('place-editor-search').placeholder = 'ค้นหาชื่อสถานที่...';
  if (map) map.off('click', placePickHandler);
});
