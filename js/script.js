function tileUrlForTheme(theme) {
  const style = theme === 'dark' ? 'streets-v2-dark' : 'streets-v2';
  return `https://api.maptiler.com/maps/${style}/{z}/{x}/{y}{r}.png?key=${window.MAPTILER_KEY}&language=th`;
}

function safeParseActs(acts) {
  if (Array.isArray(acts)) return acts;
  if (typeof acts === 'string')
    try {
      return JSON.parse(acts);
    } catch {
      return [];
    }
  return [];
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function append(parent, ...children) {
  children.forEach((c) => parent.appendChild(c));
  return parent;
}
function icon(name, size) {
  const i = document.createElement('i');
  i.setAttribute('data-lucide', name);
  if (size) {
    i.setAttribute('width', size);
    i.setAttribute('height', size);
  }
  return i;
}

function splitPlaceDate(det) {
  if (det.date) return { place: det.place, date: formatDateLabel(det.date) };
  if (det.place && det.place.includes('_')) {
    const parts = det.place.split('_');
    return { place: parts[0].trim(), date: (parts[1] || '').trim() };
  }
  return { place: det.place, date: '' };
}

function formatDateLabel(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// "2026-12-06" → "06.12" for the mono date column; anything else passes through
function formatDateNum(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  return m ? m[3] + '.' + m[2] : dateStr || '';
}

// "2026-12-06" → "09 ธันวาคม 2026" (gregory — th-TH alone yields the Buddhist year)
function formatDateLong(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if (!m) return dateStr || '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('th-TH-u-ca-gregory', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

const pad2 = (n) => String(n).padStart(2, '0');

// Gazette is monochrome — spell the travel mode out instead of showing the emoji.
// Unknown icon → just the duration.
const TRAVEL_MODE = { '🚃': 'รถไฟ', '🚗': 'รถ' };
function travelLabel(travel) {
  const mode = TRAVEL_MODE[travel.icon];
  return mode ? mode + ' ' + travel.time : travel.time;
}

// Leaflet strokes can't take CSS vars — read the resolved token instead
function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const ROUTE_STYLE = { weight: 1.4, opacity: 0.6, dashArray: '2 6', lineCap: 'round' };
const ROUTE_HOVER = { weight: 2, opacity: 1, dashArray: null };

function repaintRoutes() {
  const color = token('--accent');
  (window._legLines || []).forEach((l) => l.setStyle({ ...ROUTE_STYLE, color }));
  placePolylines.forEach((l) => l.setStyle({ ...ROUTE_STYLE, color }));
  if (placeBoundaryLayer) placeBoundaryLayer.setStyle({ color, fillColor: color });
}

let DAYS = [];
let places = [],
  placeMarkers = [],
  placePolylines = [],
  placeBoundaryLayer = null,
  isDetailMode = false;
let map,
  markers = [],
  dayMarkerCluster = null,
  curIdx = null;
let tileLayer = null;
let detailDayIndex = null,
  detailBackBtn = null,
  detailMapClick = null;

(function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') document.documentElement.dataset.theme = 'dark';
  const btn = document.getElementById('themeToggle');
  const sunIcon =
    '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  const moonIcon =
    '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  function syncIcon() {
    btn.innerHTML = document.documentElement.dataset.theme === 'dark' ? sunIcon : moonIcon;
  }
  syncIcon();
  btn.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    if (isDark) {
      delete document.documentElement.dataset.theme;
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.dataset.theme = 'dark';
      localStorage.setItem('theme', 'dark');
    }
    syncIcon();
    if (map && tileLayer) {
      tileLayer.setUrl(tileUrlForTheme(document.documentElement.dataset.theme));
      repaintRoutes();
    }
  });
})();

(function initMusic() {
  const audio = document.getElementById('lofi-audio');
  const btn = document.getElementById('musicToggle');

  audio.volume = 0.15;

  const musicOffIcon =
    '<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';

  const musicOnIcon =
    '<div class="music-icon" style="display:flex;gap:2px;align-items:flex-end;justify-content:center;"><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span></div>';

  btn.innerHTML = musicOffIcon;

  btn.addEventListener('click', () => {
    if (audio.paused) {
      audio
        .play()
        .then(() => {
          btn.classList.add('playing');
          btn.innerHTML = musicOnIcon;
          localStorage.setItem('musicPlaying', 'true');
        })
        .catch(() => {});
    } else {
      audio.pause();
      btn.classList.remove('playing');
      btn.innerHTML = musicOffIcon;
      localStorage.setItem('musicPlaying', 'false');
    }
  });

  if (localStorage.getItem('musicPlaying') === 'true') {
    audio
      .play()
      .then(() => {
        btn.classList.add('playing');
        btn.innerHTML = musicOnIcon;
      })
      .catch(() => {});
  }
})();

function formatTimeAgo(isoString) {
  if (!isoString) return '';
  const diffSec = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diffSec < 0) return 'เมื่อกี้';
  if (diffSec < 60) return 'เมื่อกี้';
  if (diffSec < 3600) return Math.floor(diffSec / 60) + ' นาทีที่แล้ว';
  if (diffSec < 86400) return Math.floor(diffSec / 3600) + ' ชม.ที่แล้ว';
  return Math.floor(diffSec / 86400) + ' วันที่แล้ว';
}

function initStatsWidget() {
  if (!window.TRIP_DEPARTURE_DATE) return;

  const widget = document.getElementById('stats-widget');
  const pillValue = document.getElementById('stats-pill-value');
  const daysEl = document.getElementById('stats-days');
  const hoursEl = document.getElementById('stats-hours');
  const minutesEl = document.getElementById('stats-minutes');
  const secondsEl = document.getElementById('stats-seconds');

  if (!widget || !pillValue || !daysEl || !hoursEl || !minutesEl || !secondsEl) return;

  const departEl = document.getElementById('stats-depart');
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(window.TRIP_DEPARTURE_DATE);
  if (departEl && iso) departEl.textContent = iso[3] + '.' + iso[2] + '.' + iso[1].slice(2);

  let countdownInterval;

  function updateCountdown() {
    const now = Date.now();
    const departure = new Date(window.TRIP_DEPARTURE_DATE).getTime();

    if (isNaN(departure)) {
      widget.classList.add('hidden');
      if (countdownInterval) clearInterval(countdownInterval);
      return;
    }

    const diff = departure - now;

    if (diff < 0) {
      widget.classList.add('hidden');
      if (countdownInterval) clearInterval(countdownInterval);
      return;
    }

    widget.classList.remove('hidden');

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const formatted = `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    pillValue.textContent = formatted;

    daysEl.textContent = days;
    hoursEl.textContent = String(hours).padStart(2, '0');
    minutesEl.textContent = String(minutes).padStart(2, '0');
    secondsEl.textContent = String(seconds).padStart(2, '0');
  }

  updateCountdown();

  if (!widget.classList.contains('hidden')) {
    countdownInterval = setInterval(updateCountdown, 1000);
  }
}

function renderSidebar(days) {
  const listEl = document.getElementById('dayList');
  listEl.textContent = '';
  const countEl = document.getElementById('dayCount');
  if (countEl) countEl.textContent = pad2(days.length);
  days.forEach((d, i) => {
    const det = d.details;
    const item = el('div', 'day-item');
    item.dataset.i = i;
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.style.animationDelay = i * 0.07 + 0.1 + 's';

    const rowTop = el('div', 'day-row');
    const pin = append(el('div', 's-pin'), el('span', 's-pin-num', pad2(i + 1)));
    const info = el('div', 'day-info');
    const meta = el('div', 'day-meta');
    (det.badges || []).forEach((b) =>
      meta.appendChild(el('span', ('badge ' + (b.cls || '')).trim(), b.label)),
    );
    if (det.travel) {
      meta.appendChild(el('span', 'travel-tag', travelLabel(det.travel)));
    }

    const editBtn = el('button', 'edit-day-btn', '\u270f\ufe0f');
    editBtn.title = 'แก้ไขแผนวันนี้';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditor(d);
    });

    const { place, date } = splitPlaceDate(det);
    append(info, el('div', 'day-place', place));
    if (det.jp) info.appendChild(el('div', 'day-jp', det.jp));
    if (meta.children.length) info.appendChild(meta);

    const side = el('div', 'day-side');
    // det.date เป็น ISO → dd.mm; แถวเก่าที่ยัด date ไว้ใน place ใช้ค่าที่ splitPlaceDate แกะได้
    side.appendChild(el('span', 'place-date', det.date ? formatDateNum(det.date) : date));
    const actCount = (det.acts || []).length;
    if (actCount) side.appendChild(el('span', 'day-count', actCount + ' กิจกรรม'));

    append(rowTop, pin, info, side);
    append(item, rowTop, editBtn);
    item.addEventListener('click', () => goTo(i));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goTo(i);
      }
    });
    item.addEventListener('mouseenter', () => {
      const leg = (window._legLines || [])[i - 1];
      if (leg) leg.setStyle(ROUTE_HOVER);
    });
    item.addEventListener('mouseleave', () => {
      const leg = (window._legLines || [])[i - 1];
      if (leg) leg.setStyle(ROUTE_STYLE);
    });
    if (d.last_editor_name) {
      const stamp = el(
        'small',
        'day-editor',
        'แก้โดย: ' + d.last_editor_name + ' · เมื่อ ' + formatTimeAgo(d.last_editor_at),
      );
      append(item, stamp);
    }
    listEl.appendChild(item);
  });
  lucide?.createIcons();
}

function buildPopup(d, i) {
  const det = d.details;
  const pop = el('div', 'pop');
  if (det.img) {
    const imgWrap = el('div', 'pop-img-wrap pop-img-loading');
    const img = el('img', 'pop-img');
    img.alt = det.place;
    img.src = det.img;

    img.onload = () => {
      imgWrap.classList.remove('pop-img-loading');
      img.classList.add('loaded');
    };
    img.onerror = () => {
      imgWrap.classList.remove('pop-img-loading');
      imgWrap.classList.add('pop-img-error');
      img.style.display = 'none';
      const fallback = el('div', 'pop-img-fallback');
      fallback.innerHTML =
        '<svg viewBox="0 0 64 64" width="48" height="48"><circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="2" opacity="0.2"/><path d="M24 42l6-8 4 4 8-10 8 14H26l-2-10z" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/></svg>';
      imgWrap.appendChild(fallback);
    };

    imgWrap.appendChild(img);
    pop.appendChild(imgWrap);
  } else {
    const ph = el('div', 'pop-img-placeholder');
    ph.innerHTML =
      '<svg viewBox="0 0 64 64" width="48" height="48"><circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="2" opacity="0.2"/><path d="M24 42l6-8 4 4 8-10 8 14H26l-2-10z" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/></svg>';
    pop.appendChild(ph);
  }
  append(pop, el('div', 'pop-label', 'Day ' + (i + 1)));

  const titleEl = el('div', 'pop-title');
  const { place, date } = splitPlaceDate(det);
  titleEl.appendChild(el('span', null, place));
  if (date) {
    titleEl.appendChild(el('span', 'day-number', ' • ' + date));
  }
  pop.appendChild(titleEl);

  if (det.jp) {
    append(pop, el('div', 'pop-jp', det.jp));
  }

  const acts = el('ul', 'pop-acts');
  (det.acts || []).forEach((a) => acts.appendChild(el('li', null, a)));
  pop.appendChild(acts);

  const detailBtn = el('button', 'pop-detail-btn');
  append(detailBtn, icon('file-text', 14), document.createTextNode(' รายละเอียด'));
  detailBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    map.closePopup();
    enterDetail(i);
  });
  pop.appendChild(detailBtn);
  return pop;
}

function buildPlacePopup(p) {
  const pop = el('div', 'pop');
  const titleEl = el('div', 'pop-title');
  titleEl.appendChild(el('span', null, p.name));
  pop.appendChild(titleEl);

  if (p.acts && p.acts.length) {
    const actsArr = safeParseActs(p.acts);
    const acts = el('ul', 'pop-acts');
    actsArr.slice(0, 4).forEach((a) => acts.appendChild(el('li', null, a)));
    if (actsArr.length > 4) {
      acts.appendChild(el('li', null, '... +' + (actsArr.length - 4)));
    }
    pop.appendChild(acts);
  }

  if (p.expense > 0 || (p.split_among && p.split_among.length)) {
    const meta = el('div', 'pop-travel');
    if (p.expense > 0) meta.textContent = '¥' + Number(p.expense).toLocaleString();
    if (p.split_among && p.split_among.length && window.members) {
      const names = p.split_among
        .map((uid) => window.members.find((m) => m.id === uid))
        .filter(Boolean)
        .map((m) => m.name)
        .join(', ');
      if (names) {
        if (meta.textContent) meta.textContent += ' · ';
        meta.textContent += names;
      }
    }
    pop.appendChild(meta);
  }

  return pop;
}

function renderMap(days) {
  if (!map) {
    map = L.map('map', { zoomControl: false, attributionControl: true }).setView([36, 138.5], 7);
    tileLayer = L.tileLayer(tileUrlForTheme(document.documentElement.dataset.theme), {
      maxZoom: 22,
      detectRetina: true,
      attribution:
        '© <a href="https://www.maptiler.com/copyright/">MapTiler</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // bottomright — top-right belongs to .map-controls (theme/music)
    map.addControl(L.control.zoom({ position: 'bottomright' }));

    map.on('popupopen', () => lucide?.createIcons());
  }

  if (dayMarkerCluster) map.removeLayer(dayMarkerCluster);
  dayMarkerCluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 45,
    iconCreateFunction: (cluster) => {
      const div = document.createElement('div');
      div.className = 'mk mk-cluster';
      const span = document.createElement('span');
      span.className = 'mn';
      span.textContent = String(cluster.getChildCount());
      div.appendChild(span);
      return L.divIcon({
        className: '',
        html: div.outerHTML,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
    },
  });
  markers = [];

  const coords = days.map((d) => [d.details.lat, d.details.lng]);

  (window._legLines || []).forEach((l) => map.removeLayer(l));
  window._legLines = [];
  for (let i = 1; i < coords.length; i++) {
    const leg = L.polyline([coords[i - 1], coords[i]], {
      ...ROUTE_STYLE,
      color: token('--accent'),
    }).addTo(map);
    window._legLines.push(leg);
  }

  days.forEach((d, i) => {
    const mkDiv = document.createElement('div');
    mkDiv.className = 'mk';
    mkDiv.id = 'mk' + i;
    const mkSpan = document.createElement('span');
    mkSpan.className = 'mn';
    mkSpan.textContent = pad2(i + 1);
    mkDiv.appendChild(mkSpan);

    const icon = L.divIcon({
      className: '',
      html: mkDiv.outerHTML,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -16],
    });

    const m = L.marker(coords[i], { icon }).bindPopup(buildPopup(d, i), { maxWidth: 280 });
    m.on('click', () => setActive(i));
    markers.push(m);
    dayMarkerCluster.addLayer(m);
  });

  map.addLayer(dayMarkerCluster);

  if (coords.length) {
    map.fitBounds(L.latLngBounds(coords), { padding: [40, 60] });
  }

  map.once('moveend', () => {
    markers.forEach((_, i) => {
      const mkEl = document.getElementById('mk' + i);
      if (!mkEl) return;
      mkEl.style.opacity = '0';
      mkEl.style.transition = 'opacity 0.45s ease';
      setTimeout(() => (mkEl.style.opacity = '1'), 350 + i * 90);
    });
  });
}

// ponytail: patch popup ของ marker เดียว คืน false ถ้าพิกัดขยับ (ต้อง renderMap ใหม่เพราะ
// เส้น leg ต้องขยับตาม). renderMap ทั้งชุดทุก UPDATE = animation เล่นซ้ำ + fitBounds
// เด้งกล้องคนที่กำลังดูวันอื่นอยู่
function refreshMarker(i) {
  const m = markers[i];
  const d = DAYS[i];
  if (!m || !d) return false;
  const ll = m.getLatLng();
  if (ll.lat !== d.details.lat || ll.lng !== d.details.lng) return false;
  m.setPopupContent(buildPopup(d, i));
  return true;
}

function setActive(i) {
  if (isDetailMode) return;
  if (!DAYS[i]) return;
  document.querySelectorAll('.day-item').forEach((e) => e.classList.remove('active'));
  const activeItem = document.querySelectorAll('.day-item')[i];
  if (activeItem) {
    activeItem.classList.add('active');
    activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  if (curIdx !== null) {
    const prev = document.getElementById('mk' + curIdx);
    if (prev) prev.classList.remove('on');
  }
  const cur = document.getElementById('mk' + i);
  if (cur) cur.classList.add('on');
  curIdx = i;
}

function goTo(i) {
  map.flyTo([DAYS[i].details.lat, DAYS[i].details.lng], 12, { duration: 1.1 });
  map.once('moveend', () => {
    if (dayMarkerCluster.getVisibleParent(markers[i]) === markers[i]) {
      markers[i].openPopup();
    } else {
      dayMarkerCluster.zoomToShowLayer(markers[i], () => markers[i].openPopup());
    }
  });
  setActive(i);
  if (window.innerWidth <= 640 && window._closeMobileDrawer) window._closeMobileDrawer();
}

(function initMobileDrawer() {
  const sidebar = document.querySelector('.sidebar');
  const header = document.querySelector('.header');
  const handle = document.querySelector('.drag-handle');
  const backdrop = document.createElement('div');
  backdrop.id = 'sidebar-backdrop';
  document.body.appendChild(backdrop);
  function isMobile() {
    return window.innerWidth <= 640;
  }
  function openDrawer() {
    sidebar.classList.add('open');
    backdrop.classList.add('active');
  }
  function closeDrawer() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('active');
  }
  header.addEventListener('click', (e) => {
    if (!isMobile()) return;
    e.stopPropagation();
    sidebar.classList.contains('open') ? closeDrawer() : openDrawer();
  });
  backdrop.addEventListener('click', closeDrawer);
  window._closeMobileDrawer = closeDrawer;

  let dragging = false,
    startY = 0,
    startTranslate = 0;
  const COLLAPSED_GAP = 94;

  handle.addEventListener('pointerdown', (e) => {
    if (!isMobile()) return;
    dragging = true;
    startY = e.clientY;
    startTranslate = sidebar.classList.contains('open') ? 0 : sidebar.offsetHeight - COLLAPSED_GAP;
    sidebar.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const maxTranslate = sidebar.offsetHeight - COLLAPSED_GAP;
    const translate = Math.min(maxTranslate, Math.max(0, startTranslate + (e.clientY - startY)));
    sidebar.style.transform = `translateY(${translate}px)`;
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    sidebar.classList.remove('dragging');
    const maxTranslate = sidebar.offsetHeight - COLLAPSED_GAP;
    const translate = Math.min(maxTranslate, Math.max(0, startTranslate + (e.clientY - startY)));
    sidebar.style.transform = '';
    translate < maxTranslate / 2 ? openDrawer() : closeDrawer();
  }
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
})();

async function enterDetail(i) {
  const day = DAYS[i];
  if (!day) return;
  isDetailMode = true;
  detailDayIndex = i;

  if (dayMarkerCluster && map.hasLayer(dayMarkerCluster)) map.removeLayer(dayMarkerCluster);
  (window._legLines || []).forEach((l) => map.removeLayer(l));

  const headerActions = document.querySelector('.btn-group');
  headerActions.classList.add('hidden');
  detailBackBtn = el('div', 'detail-back-row');
  const backBtn = el('button', 'detail-back-btn');
  append(backBtn, icon('arrow-left', 15), el('span', null, 'กลับ'));
  backBtn.addEventListener('click', exitDetail);
  append(
    detailBackBtn,
    backBtn,
    el('span', 'detail-back-count', 'วันที่ ' + pad2(i + 1) + ' / ' + pad2(DAYS.length)),
  );
  headerActions.parentNode.insertBefore(detailBackBtn, headerActions);
  lucide?.createIcons();

  const listEl = document.getElementById('dayList');
  listEl.textContent = '';
  listEl.classList.remove('day-list');
  listEl.classList.add('day-place-list');

  const loadingEl = el('div', 'detail-loading');
  loadingEl.appendChild(icon('loader', 24));
  loadingEl.appendChild(el('span', null, 'กำลังโหลด...'));
  listEl.appendChild(loadingEl);

  const fresh = await loadDayPlaces(day.id);
  // ponytail: กด "กลับ" ระหว่างโหลดอยู่ — ทิ้งผลไป ไม่งั้น render ทับ view ที่ออกไปแล้ว
  if (!isDetailMode || detailDayIndex !== i) return;
  places = fresh;

  loadingEl.remove();
  renderDayDetail(day);

  renderPlaceMap(day);

  detailMapClick = (e) => {
    if (!isDetailMode || window._placePickMode) return;
    const { lat, lng } = e.latlng;
    openPlaceEditor(day, null, { lat, lng });
  };
  map.on('click', detailMapClick);

  if (window.innerWidth <= 640) {
    document.querySelector('.sidebar').classList.add('open');
    document.getElementById('sidebar-backdrop')?.classList.add('active');
  }
}

function exitDetail() {
  isDetailMode = false;
  detailDayIndex = null;
  places = [];

  if (detailMapClick) {
    map.off('click', detailMapClick); // ponytail: ระบุ handler — off('click') เปล่าถอดของ Leaflet ด้วย
    detailMapClick = null;
  }

  placeMarkers.forEach((m) => map.removeLayer(m));
  placeMarkers = [];

  placePolylines.forEach((l) => map.removeLayer(l));
  placePolylines = [];

  if (placeBoundaryLayer) {
    map.removeLayer(placeBoundaryLayer);
    placeBoundaryLayer = null;
  }

  if (dayMarkerCluster) dayMarkerCluster.addTo(map);

  (window._legLines || []).forEach((l) => l.addTo(map));

  const listEl = document.getElementById('dayList');
  listEl.classList.remove('day-place-list');
  listEl.classList.add('day-list');

  if (detailBackBtn) {
    detailBackBtn.remove();
    detailBackBtn = null;
  }
  document.querySelector('.btn-group').classList.remove('hidden');

  renderSidebar(DAYS);

  const coords = DAYS.map((d) => [d.details.lat, d.details.lng]);
  if (coords.length) {
    map.fitBounds(L.latLngBounds(coords), { padding: [40, 60] });
  }
}

function renderDayDetail(day) {
  const listEl = document.getElementById('dayList');
  listEl.textContent = '';

  const dayNum = DAYS.indexOf(day) + 1;
  const { place } = splitPlaceDate(day.details);

  const header = el('div', 'detail-header');
  const eyebrow = 'วันที่ ' + dayNum;
  header.appendChild(
    el(
      'div',
      'detail-header-date',
      day.details.date ? eyebrow + ' · ' + formatDateLong(day.details.date) : eyebrow,
    ),
  );
  header.appendChild(el('div', 'detail-header-title', place));
  if (day.details.jp) header.appendChild(el('div', 'detail-header-jp', day.details.jp));

  const seedActs = day.details.acts || [];
  const pills = el('div', 'detail-header-pills');
  pills.appendChild(el('span', 'detail-pill', places.length + ' สถานที่'));
  if (seedActs.length > 0) {
    pills.appendChild(el('span', 'detail-pill', seedActs.length + ' กิจกรรม'));
  }
  if (day.details.travel) {
    pills.appendChild(el('span', 'detail-pill', travelLabel(day.details.travel)));
  }
  header.appendChild(pills);

  if (seedActs.length > 0) {
    const actList = el('div', 'detail-seed-acts');
    seedActs.forEach((a) => actList.appendChild(el('div', 'detail-seed-act', '• ' + a)));
    header.appendChild(actList);
  }
  listEl.appendChild(header);

  const addBtn = el('button', 'add-place-btn', '+ Add Place');
  addBtn.addEventListener('click', () => openPlaceEditor(day, null));
  listEl.appendChild(addBtn);

  if (!places.length) {
    const empty = el('div', 'place-empty', 'ยังไม่มีสถานที่ในวันนี้\nคลิก "+ Add Place" เพิ่มเลย!');
    listEl.appendChild(empty);
  } else {
    places.forEach((p, idx) => {
      const card = el('div', 'place-card');
      card.dataset.placeId = p.id;
      card.style.animationDelay = idx * 0.05 + 0.1 + 's';
      // ponytail: schema ไม่มีเวลา — ช่อง gutter ของ timeline ใส่ลำดับแทน
      card.appendChild(el('div', 'place-card-index', pad2(idx + 1)));

      const body = el('div', 'place-card-body');
      const thumb = el('div', 'place-card-thumb');
      thumb.dataset.placeId = p.id;
      if (p.img) {
        const img = document.createElement('img');
        img.src = p.img;
        img.alt = p.name;
        img.loading = 'lazy';
        img.onerror = function () {
          this.style.display = 'none';
          const ph = document.createElement('div');
          ph.className = 'place-card-thumb-placeholder';
          ph.appendChild(icon('image-off', 20));
          this.parentNode.appendChild(ph);
        };
        thumb.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.className = 'place-card-thumb-placeholder thumb-loading';
        ph.appendChild(icon('loader', 20));
        thumb.appendChild(ph);
      }

      const content = el('div', 'place-card-content');

      const headerRow = el('div', 'place-card-header');
      headerRow.appendChild(el('span', 'place-card-name', p.name));
      content.appendChild(headerRow);

      if (p.acts && p.acts.length) {
        const actsArr = safeParseActs(p.acts);
        if (actsArr.length) content.appendChild(el('div', 'place-card-acts', actsArr.join(' · ')));
      }

      const meta = el('div', 'place-card-meta');
      if (p.expense > 0) {
        meta.appendChild(
          el('span', 'place-card-expense', '¥' + Number(p.expense).toLocaleString()),
        );
      }
      if (p.split_among && p.split_among.length && window.members) {
        const names = p.split_among
          .map((uid) => window.members.find((m) => m.id === uid))
          .filter(Boolean)
          .map((m) => m.name)
          .join(', ');
        if (names) {
          const splitSpan = el('span', 'place-card-split');
          append(splitSpan, icon('users', 12), document.createTextNode(' ' + names));
          meta.appendChild(splitSpan);
        }
      }
      if (meta.children.length) content.appendChild(meta);

      const actions = el('div', 'place-card-actions');
      const editBtn = el('button', 'place-edit-btn');
      editBtn.title = 'แก้ไข';
      editBtn.appendChild(icon('pencil', 14));
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPlaceEditor(day, p);
      });
      const delBtn = el('button', 'place-del-btn');
      delBtn.title = 'ลบ';
      delBtn.appendChild(icon('trash-2', 14));
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deletePlaceHandler(p);
      });
      const focusBtn = el('button', 'place-card-focus');
      focusBtn.title = 'ดูบนแผนที่';
      focusBtn.appendChild(icon('map', 14));
      focusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (p.lat && p.lng) focusPlace(idx);
      });
      append(actions, editBtn, delBtn, focusBtn);
      content.appendChild(actions);

      append(body, content, thumb);
      card.appendChild(body);

      card.addEventListener('click', () => {
        if (p.lat && p.lng) focusPlace(idx);
      });
      listEl.appendChild(card);
    });
  }

  lucide?.createIcons();

  places.forEach(async (p) => {
    if (p.img) return;
    const url = await fetchPlaceThumbnail(p.name);
    if (!isDetailMode) return;
    const thumb = listEl.querySelector(`[data-place-id="${p.id}"]`);
    if (!thumb) return;
    const ph = thumb.querySelector('.thumb-loading');
    if (!ph) return;
    if (!url) {
      ph.classList.remove('thumb-loading');
      ph.textContent = '';
      ph.appendChild(icon('image-off', 20));
      return;
    }
    const img = document.createElement('img');
    img.src = url;
    img.alt = p.name;
    img.loading = 'lazy';
    img.onerror = function () {
      this.style.display = 'none';
      const newPh = document.createElement('div');
      newPh.className = 'place-card-thumb-placeholder';
      newPh.appendChild(icon('image-off', 20));
      this.parentNode.appendChild(newPh);
    };
    ph.replaceWith(img);
  });
}

function renderPlaceMap(day) {
  placeMarkers.forEach((m) => map.removeLayer(m));
  placeMarkers = [];
  placePolylines.forEach((l) => map.removeLayer(l));
  placePolylines = [];
  if (placeBoundaryLayer) {
    map.removeLayer(placeBoundaryLayer);
    placeBoundaryLayer = null;
  }

  fetchDayBoundary(day.details.place).then((coords) => {
    if (!coords || !isDetailMode) return;
    const accent = token('--accent');
    placeBoundaryLayer = L.polygon(coords, {
      color: accent,
      weight: 1.2,
      opacity: 0.5,
      dashArray: '2 6',
      fillColor: accent,
      fillOpacity: 0.03,
      className: 'day-boundary',
    }).addTo(map);
  });

  const validPlaces = places.filter((p) => p.lat && p.lng);
  if (!validPlaces.length) {
    map.flyTo([day.details.lat, day.details.lng], 12, { duration: 0.8 });
    return;
  }

  const coords = validPlaces.map((p) => [p.lat, p.lng]);

  for (let i = 1; i < validPlaces.length; i++) {
    const pl = L.polyline([coords[i - 1], coords[i]], {
      ...ROUTE_STYLE,
      color: token('--accent'),
    }).addTo(map);
    placePolylines.push(pl);
  }

  validPlaces.forEach((p, idx) => {
    const mkDiv = document.createElement('div');
    mkDiv.className = 'mk';
    mkDiv.id = 'pmk' + p.id;
    const mkSpan = document.createElement('span');
    mkSpan.className = 'mn';
    mkSpan.textContent = pad2(idx + 1);
    mkDiv.appendChild(mkSpan);

    const icon = L.divIcon({
      className: '',
      html: mkDiv.outerHTML,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -16],
    });

    const m = L.marker([p.lat, p.lng], { icon }).addTo(map);
    m.bindPopup(buildPlacePopup(p), { maxWidth: 280 });
    m.on('click', () => focusPlace(idx));
    placeMarkers.push(m);
  });

  map.fitBounds(L.latLngBounds(coords), { padding: [50, 60], maxZoom: 17 });
}

function focusPlace(idx) {
  const p = places[idx];
  if (!p || !p.lat || !p.lng) return;
  map.flyTo([p.lat, p.lng], 17, { duration: 0.6 });
  map.once('moveend', () => {
    if (placeMarkers[idx]) placeMarkers[idx].openPopup();
  });
  document.querySelectorAll('.place-card').forEach((c) => c.classList.remove('active'));
  const cards = document.querySelectorAll('.place-card');
  if (cards[idx]) {
    cards[idx].classList.add('active');
    cards[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

async function deletePlaceHandler(p) {
  if (!confirm('ลบ ' + p.name + '? แน่ใจ?')) return;
  await deletePlace(p.id);
  places = await loadDayPlaces(DAYS[detailDayIndex].id);
  renderDayDetail(DAYS[detailDayIndex]);
  renderPlaceMap(DAYS[detailDayIndex]);
}

async function initApp() {
  await ensureMemberSelected();
  DAYS = await loadDays();
  renderSidebar(DAYS);
  renderMap(DAYS);
  initRealtime();
  if (typeof initPlaceRealtime === 'function') initPlaceRealtime();
  lucide?.createIcons();

  document.getElementById('openRouteBtn').addEventListener('click', () => {
    if (DAYS.length < 2) return;
    const origin = DAYS[0].details.lat + ',' + DAYS[0].details.lng;
    const dest = DAYS[DAYS.length - 1].details.lat + ',' + DAYS[DAYS.length - 1].details.lng;
    const waypoints = DAYS.slice(1, -1)
      .map((d) => d.details.lat + ',' + d.details.lng)
      .join('|');
    let url = 'https://www.google.com/maps/dir/?api=1&origin=' + origin + '&destination=' + dest;
    if (waypoints) url += '&waypoints=' + waypoints;
    window.open(url, '_blank');
  });

  setTimeout(() => {
    document.getElementById('splash').classList.add('hidden');
  }, 1000);
}

(async () => {
  try {
    await initApp();
  } catch (err) {
    // ponytail: อยู่บน splash + ปุ่มลองใหม่ — reload อัตโนมัติทำให้วนไม่จบตอน Supabase ล่ม
    console.error('Failed to initialize app:', err);
    document.querySelector('#splash .splash-loader')?.remove();
    const sub = document.querySelector('#splash .splash-sub');
    if (sub) {
      sub.textContent = 'โหลดข้อมูลไม่สำเร็จ';
      const retry = el('button', 'route-btn', 'ลองใหม่');
      retry.style.marginTop = '14px';
      retry.addEventListener('click', () => location.reload());
      sub.after(retry);
    }
    return;
  }

  try {
    initStatsWidget();
  } catch (err) {
    console.warn('Failed to initialize countdown widget:', err);
  }
})();
