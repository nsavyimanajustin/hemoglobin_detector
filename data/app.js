/**
 * Hemoglobin Detector Web Dashboard
 * Real-time monitoring and visualization of measurements
 */

// Configuration
const API_ROOT = window.location.search.includes('test=1') ? 'http://localhost:5000' : '';
const API_BASE = `${API_ROOT}/api`;
const UPDATE_INTERVAL = 2000;
const HISTORY_SIZE = 60;
const RECENT_HISTORY_LIMIT = 5;

// Global State
let measurements = [];
let isOnline = false;
let updateInterval = null;
let statusInterval = null;
let eventStream = null;
let eventStreamRetryTimer = null;
let charts = {};
let lastUptimeMs = 0;
let lastUptimeFetchAt = 0;
let lastStateVersion = 0;
let espHardwareOnline = false;
let currentQueueCount = 0;
let currentNextPatientName = '';
let currentNextPatientGender = '';
let currentActivePatientName = '';
let currentActivePatientGender = '';
let currentCanMeasure = false;
let recentHistory = [];
let historyInterval = null;
const USE_EVENT_STREAM = !window.location.search.includes('test=1') && typeof EventSource !== 'undefined';

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ── Initialization ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard loaded');
    initializeCharts();
    startUpdating();
    fetchStatus();
    fetchHistory();
    statusInterval = setInterval(fetchStatus, 10000);
    historyInterval = setInterval(fetchHistory, 15000);
    updateUptime();
    setInterval(updateUptime, 1000);
    if (USE_EVENT_STREAM) {
        startEventStream();
    }

    updateCallingTicker();

    // Cross-tab events from register page
    if (typeof Storage !== 'undefined') {
        window.addEventListener('storage', (e) => {
            if (e.key === 'hemoglobin-event') {
                try {
                    const ev = JSON.parse(e.newValue);
                    if (ev.type === 'patient-queued') {
                        fetchMeasurements();
                        fetchQueueStatus();
                    }
                } catch (_) {}
            }
        });
    }
});

// ── Event Stream ─────────────────────────────────────────────────────────────
function startEventStream() {
    if (eventStream) eventStream.close();

    try {
        eventStream = new EventSource(`${API_ROOT}/events`);

        eventStream.addEventListener('open', () => {
            console.log('Live event stream connected');
            if (eventStreamRetryTimer) {
                clearTimeout(eventStreamRetryTimer);
                eventStreamRetryTimer = null;
            }
        });

        const handleStateEvent = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.state) {
                    applyStateSnapshot(payload.state);
                } else {
                    fetchMeasurements();
                }
                fetchQueueStatus();
                if (['measurement_complete', 'diagnosis_completed', 'next_patient_called', 'queue_empty'].includes(event.type)) {
                    fetchHistory();
                }
                console.log('State event:', event.type, payload.message);
            } catch (_) {}
        };

        ['patient_registered', 'api_patient_registered',
         'patient_queued', 'api_patient_queued',
         'diagnosis_started', 'measurement_complete',
         'diagnosis_completed', 'next_patient_called', 'queue_empty']
            .forEach(type => eventStream.addEventListener(type, handleStateEvent));

        eventStream.addEventListener('state_snapshot', handleStateEvent);
        eventStream.addEventListener('state_updated', () => {
            fetchMeasurements();
            fetchQueueStatus();
        });

        eventStream.onerror = () => {
            console.warn('Live event stream disconnected; retrying...');
            if (eventStream) { eventStream.close(); eventStream = null; }
            if (!eventStreamRetryTimer) {
                eventStreamRetryTimer = setTimeout(() => {
                    eventStreamRetryTimer = null;
                    startEventStream();
                }, 5000);
            }
        };
    } catch (error) {
        console.warn('Unable to start live event stream:', error);
    }
}

// ── Charts ───────────────────────────────────────────────────────────────────
function initializeCharts() {
    const bpmCtx = document.getElementById('bpmChart')?.getContext('2d');
    if (bpmCtx) {
        charts.bpm = new Chart(bpmCtx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'BPM', data: [], borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.1)', tension: 0.4, fill: true, borderWidth: 2, pointRadius: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, min: 30, max: 150 }, x: { display: false } } }
        });
    }

    const spo2Ctx = document.getElementById('spo2Chart')?.getContext('2d');
    if (spo2Ctx) {
        charts.spo2 = new Chart(spo2Ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'SpO2', data: [], borderColor: '#3498db', backgroundColor: 'rgba(52,152,219,0.1)', tension: 0.4, fill: true, borderWidth: 2, pointRadius: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, min: 70, max: 100 }, x: { display: false } } }
        });
    }

    const hbCtx = document.getElementById('hbChart')?.getContext('2d');
    if (hbCtx) {
        charts.hb = new Chart(hbCtx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Hemoglobin', data: [], borderColor: '#9b59b6', backgroundColor: 'rgba(155,89,182,0.1)', tension: 0.4, fill: true, borderWidth: 2, pointRadius: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, min: 8, max: 18 }, x: { display: false } } }
        });
    }

    const trendCtx = document.getElementById('trendChart')?.getContext('2d');
    if (trendCtx) {
        charts.trend = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'Heart Rate (BPM)', data: [], borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.05)', tension: 0.4, borderWidth: 2, yAxisID: 'y' },
                    { label: 'SpO2 (%)', data: [], borderColor: '#3498db', backgroundColor: 'rgba(52,152,219,0.05)', tension: 0.4, borderWidth: 2, yAxisID: 'y1' },
                    { label: 'Hemoglobin (g/dL)', data: [], borderColor: '#9b59b6', backgroundColor: 'rgba(155,89,182,0.05)', tension: 0.4, borderWidth: 2, yAxisID: 'y2' },
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 15 } } },
                scales: {
                    y:  { type: 'linear', display: true, position: 'left', title: { display: true, text: 'BPM' }, min: 30, max: 150 },
                    y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'SpO2 (%)' }, min: 70, max: 100, grid: { drawOnChartArea: false } },
                    y2: { type: 'linear', display: false, position: 'right', min: 8, max: 18 }
                }
            }
        });
    }
}

function inferHardwareOnline(state, bridge) {
    if (bridge && typeof bridge.espOnline === 'boolean') {
        return bridge.espOnline;
    }

    if (state && typeof state.source === 'string') {
        if (state.source === 'esp32') return true;
        if (state.source === 'fallback') return false;
    }

    return false;
}

function setHardwareOnlineState(online) {
    espHardwareOnline = Boolean(online);
    updateOnlineStatus(espHardwareOnline);
}

function formatPatientForCall(name, gender) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return 'patient';

    if (/^(mr\.?|ms\.?|mrs\.?|dr\.?)\s+/i.test(trimmed)) {
        return trimmed;
    }

    const g = String(gender || '').toLowerCase();
    if (g === 'male') return `Mr ${trimmed}`;
    if (g === 'female') return `Ms ${trimmed}`;
    return trimmed;
}

function updateCallingTicker() {
    const tickerEl = document.getElementById('callingTickerText');
    if (!tickerEl) return;

    let message = 'Waiting for patients in queue.';

    if (!espHardwareOnline) {
        message = 'Hardware is currently offline. Please wait while the ESP32 reconnects.';
    } else if (currentCanMeasure && currentActivePatientName) {
        message = `Now calling ${formatPatientForCall(currentActivePatientName, currentActivePatientGender)}. Please proceed to the diagnosis room.`;
    } else if (currentNextPatientName) {
        message = `Next in queue: ${formatPatientForCall(currentNextPatientName, currentNextPatientGender)}. Please prepare to proceed to the diagnosis room.`;
    } else if (currentQueueCount > 0) {
        message = `Queue update: ${currentQueueCount} patient(s) waiting. Next patient, please stand by.`;
    }

    if (tickerEl.textContent !== message) {
        tickerEl.textContent = message;
        tickerEl.style.animation = 'none';
        void tickerEl.offsetWidth;
        tickerEl.style.animation = '';
    }
}

// ── Data Fetching ─────────────────────────────────────────────────────────────
function startUpdating() {
    fetchMeasurements();
    updateInterval = setInterval(fetchMeasurements, UPDATE_INTERVAL);
}

function normalizeFromState(state) {
    const m = state.measurements || {};
    return {
        heartRate: Number(m.heartRate || 0),
        spO2: Number(m.spO2 || 0),
        hemoglobin: Number(m.hemoglobin || 0),
        status: m.status || 'IDLE',
        irValue: Number(m.irValue || 0),
        redValue: Number(m.redValue || 0),
        valid: Boolean(m.valid),
        timestamp: Date.now(),
        canMeasure: Boolean(state.canMeasure),
        sensorEnabled: Boolean(state.sensorEnabled),
        activePatientId: state.activePatientId || '',
        activePatientName: state.activePatientName || '',
        workflowMessage: state.workflowMessage || '',
        lcd: state.lcd || null,
        fingerDetected: false,
        measurementInProgress: Boolean(state.canMeasure),
        stateVersion: Number(state.stateVersion || 0),
    };
}

function applyStateSnapshot(state) {
    const incomingVersion = Number(state.stateVersion || 0);
    if (incomingVersion > 0 && incomingVersion < lastStateVersion) {
        return;
    }
    if (incomingVersion > 0) {
        lastStateVersion = incomingVersion;
    }

    const uptimeMs = Number(state.uptime_ms || 0);
    if (Number.isFinite(uptimeMs) && uptimeMs > 0) {
        lastUptimeMs = uptimeMs;
        lastUptimeFetchAt = Date.now();
    }

    currentQueueCount = Number(state.queueCount || 0);
    currentNextPatientName = String(state.nextPatientName || '');
    currentNextPatientGender = String(state.nextPatientGender || '').toLowerCase();
    currentActivePatientName = String(state.activePatientName || '');
    currentActivePatientGender = String(state.activePatientGender || '').toLowerCase();
    currentCanMeasure = Boolean(state.canMeasure);

    updateDashboard(normalizeFromState(state));
}

async function fetchStateSnapshot() {
    const response = await fetch(`${API_BASE}/state`);
    if (!response.ok) {
        throw new Error('state endpoint unavailable');
    }
    const data = await response.json();
    if (!data.success || !data.state) {
        throw new Error('invalid state response');
    }
    return data;
}

async function fetchMeasurements() {
    try {
        try {
            const snapshot = await fetchStateSnapshot();
            applyStateSnapshot(snapshot.state);
            setHardwareOnlineState(inferHardwareOnline(snapshot.state, snapshot.bridge));
            isOnline = true;
            return;
        } catch (_) {}

        const response = await fetch(`${API_BASE}/measurements`);
        if (!response.ok) throw new Error('Network error');
        const data = await response.json();
        updateDashboard(normalizeMeasurement(data));
        isOnline = true;
    } catch (error) {
        console.error('Error fetching measurements:', error);
        isOnline = false;
        setHardwareOnlineState(false);
    }
}

async function fetchQueueStatus() {
    try {
        try {
            const snapshot = await fetchStateSnapshot();
            const state = snapshot.state;
            setHardwareOnlineState(inferHardwareOnline(state, snapshot.bridge));
            const event = new CustomEvent('queueUpdated', {
                detail: {
                    queue: state.queue || [],
                    total: state.queueCount || 0,
                    nextPatient: state.nextPatientName || null,
                },
            });
            window.dispatchEvent(event);
            return;
        } catch (_) {}

        const response = await fetch(`${API_BASE}/queue`);
        if (!response.ok) throw new Error('Network error');
        const data = await response.json();
        currentQueueCount = Number(data.total || 0);
        currentNextPatientName = String(data.nextPatient || '');
        if (Array.isArray(data.queue) && data.queue[0]) {
            currentNextPatientGender = String(data.queue[0].patientGender || data.queue[0].gender || '').toLowerCase();
        }
        updateCallingTicker();
        const event = new CustomEvent('queueUpdated', { detail: data });
        window.dispatchEvent(event);
    } catch (_) {}
}

function normalizeHistoryItem(item) {
    return {
        entryId: Number(item.entryId || 0),
        patientId: String(item.patientId || ''),
        patientName: String(item.patientName || ''),
        gender: String(item.gender || '').toLowerCase(),
        age: Number(item.age || 0),
        heartRate: Number(item.heartRate || 0),
        spO2: Number(item.spO2 || 0),
        hemoglobin: Number(item.hemoglobin || 0),
        status: String(item.status || 'UNKNOWN'),
        recordedAt: Number(item.recordedAt || 0),
    };
}

function trendBadgeClass(direction) {
    if (direction === 'up') return 'up';
    if (direction === 'down') return 'down';
    return 'stable';
}

function trendArrow(direction) {
    if (direction === 'up') return '↑';
    if (direction === 'down') return '↓';
    return '→';
}

function formatDelta(value, decimals) {
    const num = Number(value || 0);
    const fixed = num.toFixed(decimals);
    return num > 0 ? `+${fixed}` : fixed;
}

function renderHistorySection(payload) {
    const historyBody = document.getElementById('historyTableBody');
    const historyEmpty = document.getElementById('historyEmpty');
    const historyCountEl = document.getElementById('historyCount');
    const historyTrendEl = document.getElementById('historyTrendSummary');
    const historyAverageHbEl = document.getElementById('historyAverageHb');
    const historyAverageSpo2El = document.getElementById('historyAverageSpo2');
    const historyAverageHrEl = document.getElementById('historyAverageHr');
    const historyLatestCountEl = document.getElementById('historyLatestCount');

    if (!historyBody && !historyEmpty && !historyCountEl && !historyTrendEl && !historyAverageHbEl && !historyAverageSpo2El && !historyAverageHrEl && !historyLatestCountEl) {
        return;
    }

    const history = Array.isArray(payload?.history) ? payload.history.map(normalizeHistoryItem) : [];
    recentHistory = history;
    const trend = payload?.trend || {};
    const total = Number(payload?.total || history.length || 0);

    if (historyCountEl) {
        historyCountEl.textContent = `${total} saved result${total === 1 ? '' : 's'}`;
    }

    if (historyLatestCountEl) {
        historyLatestCountEl.textContent = String(RECENT_HISTORY_LIMIT);
    }

    if (historyAverageHbEl) {
        const hbAverage = Number(trend?.hemoglobin?.average || 0);
        historyAverageHbEl.textContent = hbAverage > 0 ? `${hbAverage.toFixed(1)} g/dL` : '--';
    }

    if (historyAverageSpo2El) {
        const spo2Average = Number(trend?.spO2?.average || 0);
        historyAverageSpo2El.textContent = spo2Average > 0 ? `${spo2Average.toFixed(1)} %` : '--';
    }

    if (historyAverageHrEl) {
        const hrAverage = Number(trend?.heartRate?.average || 0);
        historyAverageHrEl.textContent = hrAverage > 0 ? `${hrAverage.toFixed(0)} BPM` : '--';
    }

    if (historyTrendEl) {
        if (history.length > 0) {
            const hbDir = String(trend?.hemoglobin?.direction || 'stable');
            const spo2Dir = String(trend?.spO2?.direction || 'stable');
            const hrDir = String(trend?.heartRate?.direction || 'stable');
            historyTrendEl.innerHTML = [
                `<span class="trend-pill ${trendBadgeClass(hbDir)}">Hb ${trendArrow(hbDir)} ${formatDelta(trend?.hemoglobin?.delta, 1)} g/dL</span>`,
                `<span class="trend-pill ${trendBadgeClass(spo2Dir)}">SpO₂ ${trendArrow(spo2Dir)} ${formatDelta(trend?.spO2?.delta, 1)}%</span>`,
                `<span class="trend-pill ${trendBadgeClass(hrDir)}">HR ${trendArrow(hrDir)} ${formatDelta(trend?.heartRate?.delta, 0)} BPM</span>`,
            ].join(' ');
        } else {
            historyTrendEl.textContent = 'No saved results yet';
        }
    }

    if (!historyBody) {
        return;
    }

    if (history.length === 0) {
        historyBody.innerHTML = '';
        if (historyEmpty) historyEmpty.style.display = 'block';
        return;
    }

    if (historyEmpty) historyEmpty.style.display = 'none';

    historyBody.innerHTML = history.map((item, index) => {
        const statusClass = String(item.status || '').toLowerCase();
        const rowNumber = item.entryId || (history.length - index);
        return `
            <tr>
                <td><strong>#${rowNumber}</strong></td>
                <td>
                    <span class="patient-name">${escapeHtml(item.patientName || 'Unknown')}</span>
                    <span class="patient-meta">ID ${escapeHtml(item.patientId || '—')} · ${escapeHtml(item.gender || 'other')} · Age ${item.age || 0}</span>
                </td>
                <td>${item.heartRate > 0 ? item.heartRate : '--'}</td>
                <td>${item.spO2 > 0 ? item.spO2.toFixed(1) : '--'}</td>
                <td>${item.hemoglobin > 0 ? item.hemoglobin.toFixed(1) : '--'}</td>
                <td><span class="history-badge ${statusClass}">${escapeHtml(item.status || 'UNKNOWN')}</span></td>
            </tr>
        `;
    }).join('');
}

async function fetchHistory() {
    try {
        const response = await fetch(`${API_BASE}/history?limit=${RECENT_HISTORY_LIMIT}`);
        if (!response.ok) {
            throw new Error('History unavailable');
        }
        const data = await response.json();
        renderHistorySection(data);
    } catch (error) {
        console.warn('Error fetching history:', error);
        renderHistorySection({ history: [], total: 0, trend: {} });
    }
}

function normalizeMeasurement(data) {
    const toNumber = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    return {
        heartRate:            toNumber(data.heartRate ?? data.hr),
        spO2:                 toNumber(data.spO2 ?? data.spo2),
        hemoglobin:           toNumber(data.hemoglobin),
        status:               data.status || 'IDLE',
        irValue:              toNumber(data.irValue ?? data.ir_value),
        redValue:             toNumber(data.redValue ?? data.red_value),
        valid:                Boolean(data.valid),
        timestamp:            toNumber(data.timestamp, Date.now()),
        canMeasure:           Boolean(data.canMeasure),
        sensorEnabled:        Boolean(data.sensorEnabled),
        activePatientId:      data.activePatientId || '',
        activePatientName:    data.activePatientName || '',
        workflowMessage:      data.workflowMessage || '',
        lcd:                  data.lcd || null,
        fingerDetected:       Boolean(data.fingerDetected),
        measurementInProgress: Boolean(data.measurementInProgress),
    };
}

// ── Dashboard Updates ─────────────────────────────────────────────────────────
function updateDashboard(data) {
    measurements.push({
        timestamp: data.timestamp || Date.now(),
        heartRate: data.heartRate || 0,
        spO2:      data.spO2 || 0,
        hemoglobin: data.hemoglobin || 0,
        status:    data.status || 'Unknown'
    });
    if (measurements.length > HISTORY_SIZE) measurements.shift();

    updateGauges(data);
    updateDetails(data);
    updateCharts(measurements);

    const lastUpdateEl = document.getElementById('last-update');
    if (lastUpdateEl) {
        lastUpdateEl.textContent = formatTime(new Date(data.timestamp || Date.now()));
    }

    const activePatient = document.getElementById('active-patient');
    const workflowMsg = document.getElementById('workflow-message');
    if (activePatient) activePatient.textContent = data.activePatientName || 'None';
    if (workflowMsg) workflowMsg.textContent = data.workflowMessage || 'Waiting for queue';

    currentActivePatientName = String(data.activePatientName || '');
    currentActivePatientGender = String(data.activePatientGender || currentActivePatientGender || '').toLowerCase();
    currentCanMeasure = Boolean(data.canMeasure);
    updateCallingTicker();

}

function updateGauges(data) {
    const bpmValue  = data.heartRate > 0  ? data.heartRate            : '--';
    const spo2Value = data.spO2 > 70      ? Math.round(data.spO2)     : '--';
    const hbValue   = data.hemoglobin > 0 ? data.hemoglobin.toFixed(1) : '--';

    document.getElementById('bpm-value').textContent  = bpmValue;
    document.getElementById('spo2-value').textContent = spo2Value;
    document.getElementById('hb-value').textContent   = hbValue;

    const statusEl = document.getElementById('status-value');
    const status   = data.status || 'Unknown';
    statusEl.textContent = status.split('(')[0].trim();
    statusEl.className   = 'status-badge large';

    const descEl = document.getElementById('status-description');
    if (status.includes('NORMAL') || status === 'Normal') {
        statusEl.classList.add('normal');
        descEl.textContent = 'No anemia detected';
    } else if (status.includes('MILD')) {
        statusEl.classList.add('mild');
        descEl.textContent = 'Mild anemia detected';
    } else if (status.includes('MODERATE')) {
        statusEl.classList.add('moderate');
        descEl.textContent = 'Moderate anemia detected';
    } else if (status.includes('SEVERE')) {
        statusEl.classList.add('severe');
        descEl.textContent = 'Severe anemia detected';
    } else {
        descEl.textContent = 'No active diagnosis';
    }
}

function updateDetails(data) {
    const irValue = document.getElementById('ir-value');
    const redValue = document.getElementById('red-value');
    const measuringBadge = document.getElementById('measuring');

    if (irValue) irValue.textContent = data.irValue || '--';
    if (redValue) redValue.textContent = data.redValue || '--';

    if (measuringBadge) {
        if (data.canMeasure) {
            measuringBadge.textContent = 'Yes';
            measuringBadge.classList.add('active');
        } else {
            measuringBadge.textContent = 'No';
            measuringBadge.classList.remove('active');
        }
    }
}

function updateCharts(history) {
    if (history.length === 0) return;
    const timeLabels = history.map((_, i) => `${i}`);
    const bpmData    = history.map(m => m.heartRate);
    const spo2Data   = history.map(m => m.spO2);
    const hbData     = history.map(m => m.hemoglobin);

    if (charts.bpm)  { charts.bpm.data.labels = timeLabels;  charts.bpm.data.datasets[0].data = bpmData;   charts.bpm.update('none'); }
    if (charts.spo2) { charts.spo2.data.labels = timeLabels; charts.spo2.data.datasets[0].data = spo2Data; charts.spo2.update('none'); }
    if (charts.hb)   { charts.hb.data.labels = timeLabels;   charts.hb.data.datasets[0].data = hbData;    charts.hb.update('none'); }

    if (charts.trend) {
        charts.trend.data.labels = timeLabels;
        charts.trend.data.datasets[0].data = bpmData;
        charts.trend.data.datasets[1].data = spo2Data;
        charts.trend.data.datasets[2].data = hbData;
        charts.trend.update('none');
    }
}

function updateOnlineStatus(online) {
    const el = document.getElementById('status');
    if (online) {
        el.textContent = 'Online';
        el.classList.add('online');
        el.classList.remove('offline');
    } else {
        el.textContent = 'Offline';
        el.classList.add('offline');
        el.classList.remove('online');
    }

    updateCallingTicker();
}

function updateUptime() {
    const el = document.getElementById('uptime');
    if (!el) return;
    if (!lastUptimeFetchAt || !lastUptimeMs) { el.textContent = 'Uptime: --:--:--'; return; }
    const elapsed    = Date.now() - lastUptimeFetchAt;
    const totalMs    = Math.max(0, lastUptimeMs + elapsed);
    const totalSecs  = Math.floor(totalMs / 1000);
    const hh = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const mm = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const ss = String(totalSecs % 60).padStart(2, '0');
    el.textContent = `Uptime: ${hh}:${mm}:${ss}`;
}

async function fetchStatus() {
    try {
        try {
            const snapshot = await fetchStateSnapshot();
            applyStateSnapshot(snapshot.state);
            setHardwareOnlineState(inferHardwareOnline(snapshot.state, snapshot.bridge));
            return;
        } catch (_) {}

        const response = await fetch(`${API_BASE}/status`);
        if (!response.ok) return;
        const data = await response.json();

        if (data.bridge && typeof data.bridge.espOnline === 'boolean') {
            setHardwareOnlineState(data.bridge.espOnline);
        } else if (typeof data.system === 'string') {
            setHardwareOnlineState(data.system.toLowerCase() === 'online');
        }

        currentQueueCount = Number(data.queueCount || currentQueueCount || 0);
        currentNextPatientName = String(data.nextPatientName || currentNextPatientName || '');
        currentNextPatientGender = String(data.nextPatientGender || currentNextPatientGender || '').toLowerCase();
        currentActivePatientName = String(data.activePatientName || currentActivePatientName || '');
        currentActivePatientGender = String(data.activePatientGender || currentActivePatientGender || '').toLowerCase();
        currentCanMeasure = Boolean(data.canMeasure);
        updateCallingTicker();

        const uptimeMs = Number(data.uptime_ms ?? data.uptime ?? 0);
        if (Number.isFinite(uptimeMs) && uptimeMs > 0) {
            lastUptimeMs      = uptimeMs;
            lastUptimeFetchAt = Date.now();
        }

        // FIX: always update workflow message from status (removed !textContent guard)
        const workflowMsg = document.getElementById('workflow-message');
        if (workflowMsg) {
            workflowMsg.textContent = data.canMeasure
                ? `Diagnosing: ${data.activePatientName}`
                : (data.queueCount > 0 ? 'Patient queued — starting diagnosis...' : 'Register and queue a patient first');
        }

    } catch (_) {}
}

function formatTime(date) {
    return date.toLocaleTimeString();
}

window.addEventListener('beforeunload', () => {
    if (updateInterval) clearInterval(updateInterval);
    if (statusInterval) clearInterval(statusInterval);
    if (historyInterval) clearInterval(historyInterval);
});
