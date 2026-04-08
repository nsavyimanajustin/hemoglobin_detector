/**
 * Hemoglobin Detector Web Dashboard
 * Real-time monitoring and visualization of measurements
 */

// Configuration
const API_BASE = '/api';
const UPDATE_INTERVAL = 2000;
const HISTORY_SIZE = 60;

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
const USE_EVENT_STREAM = !window.location.search.includes('test=1') && typeof EventSource !== 'undefined';

// ── Serial Monitor ───────────────────────────────────────────────────────────
const MAX_SERIAL_LINES = 150;
const serialLines = [];

function appendSerialLine(entry) {
    serialLines.push(entry);
    if (serialLines.length > MAX_SERIAL_LINES) serialLines.shift();
    renderSerialLine(entry);
}

function renderSerialLine(entry) {
    const output = document.getElementById('serialOutput');
    if (!output) return;

    const ts = entry.timestamp ? entry.timestamp.replace('T', ' ').replace('Z', '') : '';
    const tag = entry.tag || '';
    const details = entry.details || entry.message || '';

    const div = document.createElement('p');
    div.className = `serial-entry tag-${tag}`;
    div.innerHTML = `<span class="ts">[${ts}]</span> <span class="tag">${tag || 'LOG'}</span>: <span class="msg">${escapeHtml(details)}</span>`;

    output.appendChild(div);

    // Auto-scroll to bottom
    output.scrollTop = output.scrollHeight;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function clearSerialLog() {
    serialLines.length = 0;
    const output = document.getElementById('serialOutput');
    if (output) output.innerHTML = '';
}

// ── LCD Display ──────────────────────────────────────────────────────────────
function updateLcd(line1, line2) {
    const l1 = document.getElementById('lcd-line1');
    const l2 = document.getElementById('lcd-line2');
    if (l1) l1.innerHTML = escapeHtml(String(line1 || '').substring(0, 16)) + '<span class="lcd-cursor">_</span>';
    if (l2) l2.textContent = String(line2 || '').substring(0, 16);
}

function updateSensorBadge(enabled) {
    const badge = document.getElementById('sensor-badge');
    const dot   = document.getElementById('sensor-dot');
    const label = document.getElementById('sensor-label');
    if (!badge) return;
    if (enabled) {
        badge.className = 'sensor-status enabled';
        dot.className   = 'sensor-dot on';
        label.textContent = 'Enabled';
    } else {
        badge.className = 'sensor-status disabled';
        dot.className   = 'sensor-dot off';
        label.textContent = 'Disabled';
    }
}

// ── Initialization ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard loaded');
    initializeCharts();
    startUpdating();
    fetchStatus();
    statusInterval = setInterval(fetchStatus, 10000);
    updateUptime();
    setInterval(updateUptime, 1000);
    if (USE_EVENT_STREAM) {
        startEventStream();
    }

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
        eventStream = new EventSource('/events');

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
                fetchMeasurements();
                fetchQueueStatus();
                console.log('State event:', event.type, payload.message);
            } catch (_) {}
        };

        const handleSerialLog = (event) => {
            try {
                const payload = JSON.parse(event.data);
                // Parse the tag and details out of the message if structured
                const tagMatch = payload.details && payload.details.match(/^([A-Z_]+): (.*)$/);
                const entry = tagMatch
                    ? { timestamp: payload.timestamp, tag: tagMatch[1], details: tagMatch[2] }
                    : { timestamp: payload.timestamp, tag: 'LOG', details: payload.message };
                appendSerialLine(entry);
            } catch (_) {}
        };

        const handleLcdUpdate = (event) => {
            try {
                const payload = JSON.parse(event.data);
                updateLcd(payload.message, payload.details);
            } catch (_) {}
        };

        const handleSensorEnabled = () => {
            updateSensorBadge(true);
        };

        const handleSensorDisabled = () => {
            updateSensorBadge(false);
        };

        ['patient_registered', 'api_patient_registered',
         'patient_queued', 'api_patient_queued',
         'diagnosis_started', 'measurement_complete',
         'diagnosis_completed', 'next_patient_called', 'queue_empty']
            .forEach(type => eventStream.addEventListener(type, handleStateEvent));

        eventStream.addEventListener('serial_log', handleSerialLog);
        eventStream.addEventListener('lcd_update', handleLcdUpdate);
        eventStream.addEventListener('sensor_enabled', handleSensorEnabled);
        eventStream.addEventListener('sensor_disabled', handleSensorDisabled);

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
                    { label: 'Hemoglobin (g/dL)', data: [], borderColor: '#9b59b6', backgroundColor: 'rgba(155,89,182,0.05)', tension: 0.4, borderWidth: 2, yAxisID: 'y2' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 15 } } },
                scales: {
                    y:  { type: 'linear', display: true, position: 'left', title: { display: true, text: 'BPM' }, min: 30, max: 150 },
                    y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'SpO2 (%)' }, min: 70, max: 100, grid: { drawOnChartArea: false } },
                    y2: { type: 'linear', display: false, min: 8, max: 18 }
                }
            }
        });
    }
}

// ── Data Fetching ─────────────────────────────────────────────────────────────
function startUpdating() {
    fetchMeasurements();
    updateInterval = setInterval(fetchMeasurements, UPDATE_INTERVAL);
}

async function fetchMeasurements() {
    try {
        const response = await fetch(`${API_BASE}/measurements`);
        if (!response.ok) throw new Error('Network error');
        const data = await response.json();
        updateDashboard(normalizeMeasurement(data));
        isOnline = true;
        updateOnlineStatus(true);
    } catch (error) {
        console.error('Error fetching measurements:', error);
        isOnline = false;
        updateOnlineStatus(false);
    }
}

async function fetchQueueStatus() {
    try {
        const response = await fetch(`${API_BASE}/queue`);
        if (!response.ok) throw new Error('Network error');
        const data = await response.json();
        const event = new CustomEvent('queueUpdated', { detail: data });
        window.dispatchEvent(event);
    } catch (_) {}
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

    document.getElementById('last-update').textContent = formatTime(new Date(data.timestamp || Date.now()));

    const activePatient  = document.getElementById('active-patient');
    const workflowMsg    = document.getElementById('workflow-message');
    if (activePatient) activePatient.textContent = data.activePatientName || 'None';
    if (workflowMsg)   workflowMsg.textContent   = data.workflowMessage || 'Waiting for queue';

    // Update sensor badge from measurement data
    updateSensorBadge(data.sensorEnabled || data.canMeasure);

    // Update LCD from measurement data (fallback if no SSE event)
    if (data.lcd) {
        updateLcd(data.lcd.line1, data.lcd.line2);
    }
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
    document.getElementById('ir-value').textContent  = data.irValue  || '--';
    document.getElementById('red-value').textContent = data.redValue || '--';

    const measuringBadge = document.getElementById('measuring');
    // FIX: use canMeasure (active patient present) not heartRate > 0
    if (data.canMeasure) {
        measuringBadge.textContent = 'Yes';
        measuringBadge.classList.add('active');
    } else {
        measuringBadge.textContent = 'No';
        measuringBadge.classList.remove('active');
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
        const response = await fetch(`${API_BASE}/status`);
        if (!response.ok) return;
        const data = await response.json();

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

        // Update sensor & LCD from status if no recent SSE event
        updateSensorBadge(Boolean(data.sensorEnabled));
        if (data.lcd) updateLcd(data.lcd.line1, data.lcd.line2);
    } catch (_) {}
}

function formatTime(date) {
    return date.toLocaleTimeString();
}

window.addEventListener('beforeunload', () => {
    if (updateInterval) clearInterval(updateInterval);
    if (statusInterval) clearInterval(statusInterval);
});
