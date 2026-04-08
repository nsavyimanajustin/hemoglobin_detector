/**
 * Hemoglobin Detector Web Dashboard
 * Real-time monitoring and visualization of measurements
 */

// Configuration
const API_BASE = '/api';
const UPDATE_INTERVAL = 2000; // Update every 2 seconds
const HISTORY_SIZE = 60; // Store last 60 measurements

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

// Initialize on page load
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
    
    // Listen for registration events from other pages
    if (typeof(Storage) !== "undefined") {
        window.addEventListener('storage', (e) => {
            if (e.key === 'hemoglobin-event') {
                try {
                    const event = JSON.parse(e.newValue);
                    if (event.type === 'patient-queued') {
                        console.log('Patient queued event received:', event);
                        // Fetch measurements immediately to update UI
                        fetchMeasurements();
                        // Also fetch queue status
                        fetchQueueStatus();
                    }
                } catch (error) {
                    console.error('Error parsing event:', error);
                }
            }
        });
    }
});

function startEventStream() {
    if (eventStream) {
        eventStream.close();
    }

    try {
        eventStream = new EventSource('/events');

        eventStream.addEventListener('open', () => {
            console.log('Live event stream connected');
            if (eventStreamRetryTimer) {
                clearTimeout(eventStreamRetryTimer);
                eventStreamRetryTimer = null;
            }
        });

        const handleServerEvent = (event) => {
            try {
                const payload = JSON.parse(event.data);
                console.log('Server event received:', event.type, payload);

                if (event.type === 'patient_registered' || event.type === 'api_patient_registered') {
                    fetchMeasurements();
                    fetchQueueStatus();
                } else if (event.type === 'patient_queued' || event.type === 'api_patient_queued') {
                    fetchMeasurements();
                    fetchQueueStatus();
                } else if (event.type === 'diagnosis_started' || event.type === 'measurement_complete' || event.type === 'diagnosis_completed' || event.type === 'next_patient_called' || event.type === 'queue_empty') {
                    fetchMeasurements();
                    fetchQueueStatus();
                }
            } catch (error) {
                console.error('Invalid server event payload:', error);
            }
        };

        ['patient_registered', 'api_patient_registered', 'patient_queued', 'api_patient_queued', 'diagnosis_started', 'measurement_complete', 'diagnosis_completed', 'next_patient_called', 'queue_empty']
            .forEach((type) => eventStream.addEventListener(type, handleServerEvent));

        eventStream.onerror = () => {
            console.warn('Live event stream disconnected; retrying...');
            if (eventStream) {
                eventStream.close();
                eventStream = null;
            }

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

/**
 * Initialize all Chart.js instances
 */
function initializeCharts() {
    // Heart Rate mini chart (line)
    const bpmCtx = document.getElementById('bpmChart')?.getContext('2d');
    if (bpmCtx) {
        charts.bpm = new Chart(bpmCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'BPM',
                    data: [],
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, min: 30, max: 150 },
                    x: { display: false }
                }
            }
        });
    }

    // SpO2 mini chart (line)
    const spo2Ctx = document.getElementById('spo2Chart')?.getContext('2d');
    if (spo2Ctx) {
        charts.spo2 = new Chart(spo2Ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'SpO2',
                    data: [],
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, min: 70, max: 100 },
                    x: { display: false }
                }
            }
        });
    }

    // Hemoglobin mini chart (line)
    const hbCtx = document.getElementById('hbChart')?.getContext('2d');
    if (hbCtx) {
        charts.hb = new Chart(hbCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Hemoglobin',
                    data: [],
                    borderColor: '#9b59b6',
                    backgroundColor: 'rgba(155, 89, 182, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, min: 8, max: 18 },
                    x: { display: false }
                }
            }
        });
    }

    // Main trend chart (multi-line)
    const trendCtx = document.getElementById('trendChart')?.getContext('2d');
    if (trendCtx) {
        charts.trend = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Heart Rate (BPM)',
                        data: [],
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.05)',
                        tension: 0.4,
                        borderWidth: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'SpO2 (%)',
                        data: [],
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.05)',
                        tension: 0.4,
                        borderWidth: 2,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Hemoglobin (g/dL)',
                        data: [],
                        borderColor: '#9b59b6',
                        backgroundColor: 'rgba(155, 89, 182, 0.05)',
                        tension: 0.4,
                        borderWidth: 2,
                        yAxisID: 'y2'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { usePointStyle: true, padding: 15 }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'BPM' },
                        min: 30,
                        max: 150
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'SpO2 (%)' },
                        min: 70,
                        max: 100,
                        grid: { drawOnChartArea: false }
                    },
                    y2: {
                        type: 'linear',
                        display: false,
                        min: 8,
                        max: 18
                    }
                }
            }
        });
    }
}

/**
 * Start periodic updates
 */
function startUpdating() {
    fetchMeasurements();
    updateInterval = setInterval(fetchMeasurements, UPDATE_INTERVAL);
}

/**
 * Fetch latest measurements from API
 */
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

/**
 * Fetch queue status from API
 */
async function fetchQueueStatus() {
    try {
        const response = await fetch(`${API_BASE}/queue`);
        if (!response.ok) throw new Error('Network error');
        
        const data = await response.json();
        console.log('Queue status:', data);
        
        // Trigger any UI updates needed (queue.html will handle this)
        const event = new CustomEvent('queueUpdated', { detail: data });
        window.dispatchEvent(event);
    } catch (error) {
        console.warn('Error fetching queue status:', error);
    }
}

function normalizeMeasurement(data) {
    const toNumber = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    return {
        heartRate: toNumber(data.heartRate ?? data.hr),
        spO2: toNumber(data.spO2 ?? data.spo2),
        hemoglobin: toNumber(data.hemoglobin),
        status: data.status || 'INITIALIZING',
        irValue: toNumber(data.irValue ?? data.ir_value),
        redValue: toNumber(data.redValue ?? data.red_value),
        valid: Boolean(data.valid),
        timestamp: toNumber(data.timestamp, Date.now()),
        canMeasure: Boolean(data.canMeasure),
        activePatientId: data.activePatientId || '',
        activePatientName: data.activePatientName || '',
        workflowMessage: data.workflowMessage || '',
        // Real-time state propagation
        fingerDetected: Boolean(data.fingerDetected),
        measurementInProgress: Boolean(data.measurementInProgress),
        lastHeartRate: toNumber(data.lastHeartRate),
        lastSpO2: toNumber(data.lastSpO2),
        lastHemoglobin: toNumber(data.lastHemoglobin),
        lastStatus: data.lastStatus || ''
    };
}

/**
 * Update dashboard with new measurement data
 */
function updateDashboard(data) {
    // Add to history
    measurements.push({
        timestamp: data.timestamp || Date.now(),
        heartRate: data.heartRate || 0,
        spO2: data.spO2 || 0,
        hemoglobin: data.hemoglobin || 0,
        status: data.status || 'Unknown'
    });

    // Keep only recent history
    if (measurements.length > HISTORY_SIZE) {
        measurements.shift();
    }

    // Update gauges
    updateGauges(data);

    // Update sensor details
    updateDetails(data);

    // Update charts
    updateCharts(measurements);

    // Update last update time
    document.getElementById('last-update').textContent = formatTime(new Date(data.timestamp || Date.now()));

    const activePatient = document.getElementById('active-patient');
    const workflowMessage = document.getElementById('workflow-message');
    if (activePatient) {
        activePatient.textContent = data.activePatientName || 'None';
    }
    if (workflowMessage) {
        workflowMessage.textContent = data.workflowMessage || 'Waiting for queue';
    }
}

/**
 * Update gauge displays
 */
function updateGauges(data) {
    // BPM
    const bpmValue = data.heartRate > 0 ? data.heartRate : '--';
    document.getElementById('bpm-value').textContent = bpmValue;

    // SpO2
    const spo2Value = data.spO2 > 70 ? Math.round(data.spO2) : '--';
    document.getElementById('spo2-value').textContent = spo2Value;

    // Hemoglobin
    const hbValue = data.hemoglobin > 0 ? data.hemoglobin.toFixed(1) : '--';
    document.getElementById('hb-value').textContent = hbValue;

    // Status
    const statusElement = document.getElementById('status-value');
    const status = data.status || 'Unknown';
    statusElement.textContent = status.split('(')[0].trim();

    // Update status colors
    statusElement.className = 'status-badge large';
    if (status.includes('NORMAL')) {
        statusElement.classList.add('normal');
        document.getElementById('status-description').textContent = 'No anemia detected';
    } else if (status.includes('MILD')) {
        statusElement.classList.add('mild');
        document.getElementById('status-description').textContent = 'Mild anemia detected';
    } else if (status.includes('MODERATE')) {
        statusElement.classList.add('moderate');
        document.getElementById('status-description').textContent = 'Moderate anemia detected';
    } else if (status.includes('SEVERE')) {
        statusElement.classList.add('severe');
        document.getElementById('status-description').textContent = 'Severe anemia detected';
    }
}

/**
 * Update sensor detail display
 */
function updateDetails(data) {
    document.getElementById('ir-value').textContent = data.irValue || '--';
    document.getElementById('red-value').textContent = data.redValue || '--';

    const measuringBadge = document.getElementById('measuring');
    if (data.valid || data.heartRate > 0) {
        measuringBadge.textContent = 'Yes';
        measuringBadge.classList.add('active');
    } else {
        measuringBadge.textContent = 'No';
        measuringBadge.classList.remove('active');
    }
}

/**
 * Update all chart data
 */
function updateCharts(history) {
    if (history.length === 0) return;

    const timeLabels = history.map((m, i) => `${i}`);
    const bpmData = history.map(m => m.heartRate);
    const spo2Data = history.map(m => m.spO2);
    const hbData = history.map(m => m.hemoglobin);

    // Update mini charts
    if (charts.bpm) {
        charts.bpm.data.labels = timeLabels;
        charts.bpm.data.datasets[0].data = bpmData;
        charts.bpm.update('none');
    }

    if (charts.spo2) {
        charts.spo2.data.labels = timeLabels;
        charts.spo2.data.datasets[0].data = spo2Data;
        charts.spo2.update('none');
    }

    if (charts.hb) {
        charts.hb.data.labels = timeLabels;
        charts.hb.data.datasets[0].data = hbData;
        charts.hb.update('none');
    }

    // Update main trend chart
    if (charts.trend) {
        charts.trend.data.labels = timeLabels;
        charts.trend.data.datasets[0].data = bpmData;
        charts.trend.data.datasets[1].data = spo2Data;
        charts.trend.data.datasets[2].data = hbData;
        charts.trend.update('none');
    }
}

/**
 * Update online status indicator
 */
function updateOnlineStatus(online) {
    const statusElement = document.getElementById('status');
    if (online) {
        statusElement.textContent = 'Online';
        statusElement.classList.add('online');
        statusElement.classList.remove('offline');
    } else {
        statusElement.textContent = 'Offline';
        statusElement.classList.add('offline');
        statusElement.classList.remove('online');
    }
}

/**
 * Update uptime display
 */
function updateUptime() {
    const uptimeElement = document.getElementById('uptime');
    if (!uptimeElement) {
        return;
    }

    if (!lastUptimeFetchAt || !lastUptimeMs) {
        uptimeElement.textContent = 'Uptime: --:--:--';
        return;
    }

    const elapsed = Date.now() - lastUptimeFetchAt;
    const totalMs = Math.max(0, lastUptimeMs + elapsed);
    const totalSeconds = Math.floor(totalMs / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    uptimeElement.textContent = `Uptime: ${hours}:${minutes}:${seconds}`;
}

async function fetchStatus() {
    try {
        const response = await fetch(`${API_BASE}/status`);
        if (!response.ok) {
            return;
        }

        const data = await response.json();
        const uptimeMs = Number(data.uptime_ms ?? data.uptime ?? 0);
        if (Number.isFinite(uptimeMs) && uptimeMs > 0) {
            lastUptimeMs = uptimeMs;
            lastUptimeFetchAt = Date.now();
        }

        const activePatient = document.getElementById('active-patient');
        const workflowMessage = document.getElementById('workflow-message');
        if (activePatient && !activePatient.textContent) {
            activePatient.textContent = data.activePatientName || 'None';
        }
        if (workflowMessage && !workflowMessage.textContent) {
            workflowMessage.textContent = data.canMeasure
                ? 'Diagnosis in progress'
                : 'Register and queue a patient first';
        }
    } catch (error) {
        console.warn('Error fetching status:', error);
    }
}

/**
 * Format time for display
 */
function formatTime(date) {
    return date.toLocaleTimeString();
}

// Graceful shutdown
window.addEventListener('beforeunload', () => {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    if (statusInterval) {
        clearInterval(statusInterval);
    }
});
