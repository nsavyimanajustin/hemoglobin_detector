const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { EventSource } = require('eventsource');

const app = express();
const PORT = Number(process.env.PORT || 5000);

// Bridge configuration
const ESP32_BASE_URL = (process.env.ESP32_BASE_URL || 'http://10.243.230.127').replace(/\/+$/, '');
const BRIDGE_ENABLED = process.env.ESP32_BRIDGE !== '0';
const SERIAL_BRIDGE_ENABLED = process.env.ENABLE_SERIAL_BRIDGE !== '0';
const SERIAL_PORT_PATH = process.env.SERIAL_PORT_PATH || '/dev/ttyUSB0';
const SERIAL_BAUD_RATE = Number(process.env.SERIAL_BAUD_RATE || 115200);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'data')));

const sseClients = new Set();
const SERIAL_LOG_SIZE = 300;
const serialLog = [];

let stateVersion = 1;
const startedAt = Date.now();
let espOnline = false;
let lastBridgeError = '';
let espEventStream = null;
let serialPortInstance = null;
let serialParser = null;
let serialRetryTimer = null;
let currentSerialPath = '';

// Minimal local fallback state for startup/offline diagnostics.
const patients = [];
const queue = [];
let nextPatientId = 1;
let activePatientId = '';
let activePatientName = '';

function appendSerialLogLine(line, explicitTag = '') {
  const timestamp = new Date().toISOString();
  const parsed = String(line || '').trim();
  if (!parsed) return;

  let tag = explicitTag || 'LOG';
  let details = parsed;

  const bracketTagMatch = parsed.match(/^\[[^\]]+\]\s+([A-Z0-9_]+):\s*(.*)$/);
  if (bracketTagMatch) {
    tag = bracketTagMatch[1];
    details = bracketTagMatch[2];
  } else {
    const plainTagMatch = parsed.match(/^([A-Z0-9_]+):\s*(.*)$/);
    if (plainTagMatch) {
      tag = plainTagMatch[1];
      details = plainTagMatch[2];
    }
  }

  const entry = { timestamp, tag, details, line: `[${timestamp}] ${tag}: ${details}` };
  serialLog.push(entry);
  if (serialLog.length > SERIAL_LOG_SIZE) {
    serialLog.shift();
  }

  const payload = {
    type: 'serial_log',
    message: entry.line,
    details: `${tag}: ${details}`,
    timestamp,
  };
  broadcastSse('serial_log', payload);
}

function broadcastSse(eventType, payloadObj) {
  const payload = JSON.stringify(payloadObj);
  for (const client of sseClients) {
    client.write(`event: ${eventType}\n`);
    client.write(`data: ${payload}\n\n`);
  }
}

function bumpState(reason) {
  stateVersion += 1;
  broadcastSse('state_updated', {
    type: 'state_updated',
    message: `State changed: ${reason}`,
    details: `stateVersion=${stateVersion}`,
    stateVersion,
    timestamp: new Date().toISOString(),
  });
}

function getLocalFallbackState() {
  const canMeasure = Boolean(activePatientId);
  const now = Date.now();
  return {
    stateVersion,
    timestamp: new Date(now).toISOString(),
    uptime_ms: now - startedAt,
    workflowStage: canMeasure ? 'MEASURING' : (queue.length > 0 ? 'QUEUED' : 'IDLE'),
    canMeasure,
    diagnosisActive: canMeasure,
    activePatientId,
    activePatientName,
    queueCount: queue.length,
    nextPatientName: queue.length > 0 ? queue[0].patientName : null,
    sensorEnabled: canMeasure,
    lcd: {
      line1: canMeasure ? 'Diagnosis Active' : (queue.length > 0 ? `Queue: ${queue.length}` : 'Hemoglobin Det.'),
      line2: canMeasure ? activePatientName : (queue[0]?.patientName || 'v1.0 Ready'),
      line3: canMeasure ? 'Place finger' : (queue.length > 0 ? 'Awaiting sensor' : 'Register patient'),
      line4: canMeasure ? 'on sensor now' : (queue.length > 0 ? 'placement' : 'to begin scan'),
    },
    queue: queue.map((q) => ({ ...q })),
    measurements: {
      heartRate: canMeasure ? 72 : 0,
      spO2: canMeasure ? 98 : 0,
      hemoglobin: canMeasure ? 14.5 : 0,
      status: canMeasure ? 'Normal' : 'IDLE',
      irValue: canMeasure ? 150000 : 0,
      redValue: canMeasure ? 80000 : 0,
      valid: canMeasure,
    },
    workflowMessage: canMeasure
      ? `Diagnosing: ${activePatientName}`
      : (queue.length > 0 ? `Waiting to call: ${queue[0].patientName}` : 'Register and queue a patient first'),
    source: 'fallback',
  };
}

async function espRequestJson(endpoint, options = {}) {
  const url = `${ESP32_BASE_URL}${endpoint}`;
  const response = await fetch(url, options);
  const text = await response.text();

  let parsedJson;
  try {
    parsedJson = text ? JSON.parse(text) : {};
  } catch (parseError) {
    throw new Error(`Invalid JSON from ESP32 at ${endpoint}: ${text.slice(0, 120)}`, {
      cause: parseError,
    });
  }

  if (!response.ok) {
    throw new Error(`ESP32 ${endpoint} failed (${response.status}): ${JSON.stringify(parsedJson)}`);
  }

  return parsedJson;
}

function formBody(payload) {
  return new URLSearchParams(payload).toString();
}

async function getBridgeState() {
  const [status, measurements, queueRes] = await Promise.all([
    espRequestJson('/api/status'),
    espRequestJson('/api/measurements'),
    espRequestJson('/api/queue'),
  ]);

  const now = Date.now();
  const canMeasure = Boolean(status.canMeasure || measurements.canMeasure);
  const queueItems = Array.isArray(queueRes.queue) ? queueRes.queue : [];
  return {
    stateVersion,
    timestamp: new Date(now).toISOString(),
    uptime_ms: Number(status.uptime_ms || 0),
    workflowStage: canMeasure ? 'MEASURING' : (queueItems.length > 0 ? 'QUEUED' : 'IDLE'),
    canMeasure,
    diagnosisActive: Boolean(status.diagnosisActive || canMeasure),
    activePatientId: status.activePatientId || measurements.activePatientId || '',
    activePatientName: status.activePatientName || measurements.activePatientName || '',
    queueCount: Number(status.queueCount ?? queueItems.length ?? 0),
    nextPatientName: status.nextPatientName || queueRes.nextPatient || null,
    sensorEnabled: Boolean(status.sensorEnabled ?? measurements.sensorEnabled ?? canMeasure),
    lcd: measurements.lcd || status.lcd || null,
    queue: queueItems,
    measurements: {
      heartRate: Number(measurements.heartRate ?? measurements.hr ?? 0),
      spO2: Number(measurements.spO2 ?? measurements.spo2 ?? 0),
      hemoglobin: Number(measurements.hemoglobin ?? 0),
      status: measurements.status || 'IDLE',
      irValue: Number(measurements.irValue ?? measurements.ir_value ?? 0),
      redValue: Number(measurements.redValue ?? measurements.red_value ?? 0),
      valid: Boolean(measurements.valid),
    },
    workflowMessage:
      measurements.workflowMessage ||
      status.workflowMessage ||
      (canMeasure
        ? `Diagnosing: ${status.activePatientName || measurements.activePatientName || ''}`
        : (queueItems.length > 0 ? `Waiting to call: ${queueItems[0].patientName}` : 'Register and queue a patient first')),
    source: 'esp32',
  };
}

async function getUnifiedState() {
  if (!BRIDGE_ENABLED) {
    return getLocalFallbackState();
  }

  try {
    const state = await getBridgeState();
    espOnline = true;
    lastBridgeError = '';
    return state;
  } catch (error) {
    espOnline = false;
    lastBridgeError = error.message;
    appendSerialLogLine(`BRIDGE_ERROR: ${error.message}`, 'BRIDGE_ERROR');
    return getLocalFallbackState();
  }
}

async function executeBridgeCommand(action, body) {
  if (action === 'register_patient') {
    const payload = {
      name: String(body.name || ''),
      phone: String(body.phone || ''),
      gender: String(body.gender || 'other'),
      age: String(body.age || '0'),
    };
    const result = await espRequestJson('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody(payload),
    });
    return { patientId: String(result.patientId || '') };
  }

  if (action === 'queue_patient') {
    const patientId = String(body.patientId || '');
    await espRequestJson('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({ patientId }),
    });
    return {};
  }

  if (action === 'start_diagnosis') {
    const patientId = String(body.patientId || '');
    await espRequestJson('/api/diagnosis/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: patientId ? formBody({ patientId }) : '',
    });
    return {};
  }

  if (action === 'complete_diagnosis') {
    await espRequestJson('/api/diagnosis/complete', { method: 'POST' });
    return {};
  }

  if (action === 'remove_from_queue') {
    const patientId = String(body.patientId || '');
    await espRequestJson('/api/queue', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({ patientId }),
    });
    return {};
  }

  throw new Error(`Unsupported action: ${action}`);
}

async function executeLocalFallbackCommand(action, body) {
  if (action === 'register_patient') {
    const patient = {
      id: String(nextPatientId++),
      name: String(body.name || ''),
      phone: String(body.phone || ''),
      gender: String(body.gender || 'other'),
      age: Number(body.age || 0),
      registeredAt: Date.now(),
      lastHemoglobin: 0,
      lastSpO2: 0,
      heartRate: 0,
    };
    patients.push(patient);
    appendSerialLogLine(`PATIENT_REGISTERED: ID=${patient.id}, Name=${patient.name}`);
    return { patientId: patient.id };
  }

  if (action === 'queue_patient') {
    const patientId = String(body.patientId || '');
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }
    if (queue.find((q) => q.patientId === patientId)) {
      throw new Error('Patient already queued');
    }

    queue.push({ patientId, patientName: patient.name, queuedAt: Date.now(), position: queue.length + 1 });
    if (!activePatientId) {
      activePatientId = patientId;
      activePatientName = patient.name;
    }
    appendSerialLogLine(`PATIENT_QUEUED: ID=${patientId}, Name=${patient.name}`);
    return {};
  }

  if (action === 'start_diagnosis') {
    if (!activePatientId && queue.length > 0) {
      activePatientId = queue[0].patientId;
      activePatientName = queue[0].patientName;
    }
    return {};
  }

  if (action === 'complete_diagnosis') {
    if (activePatientId) {
      const idx = queue.findIndex((q) => q.patientId === activePatientId);
      if (idx >= 0) {
        queue.splice(idx, 1);
        queue.forEach((q, i) => {
          q.position = i + 1;
        });
      }
      activePatientId = queue[0]?.patientId || '';
      activePatientName = queue[0]?.patientName || '';
    }
    return {};
  }

  if (action === 'remove_from_queue') {
    const patientId = String(body.patientId || '');
    const idx = queue.findIndex((q) => q.patientId === patientId);
    if (idx >= 0) {
      queue.splice(idx, 1);
      queue.forEach((q, i) => {
        q.position = i + 1;
      });
    }
    if (activePatientId === patientId) {
      activePatientId = '';
      activePatientName = '';
    }
    return {};
  }

  throw new Error(`Unsupported action: ${action}`);
}

async function executeCommand(action, body = {}) {
  const result = BRIDGE_ENABLED
    ? await (async () => {
      try {
        const bridged = await executeBridgeCommand(action, body);
        espOnline = true;
        lastBridgeError = '';
        return bridged;
      } catch (error) {
        espOnline = false;
        lastBridgeError = error.message;
        appendSerialLogLine(`BRIDGE_COMMAND_ERROR: ${error.message}`, 'BRIDGE_ERROR');
        throw error;
      }
    })()
    : await executeLocalFallbackCommand(action, body);

  bumpState(action);
  const state = await getUnifiedState();
  return { ...result, state };
}

function startEspEventBridge() {
  if (!BRIDGE_ENABLED) return;

  const eventsUrl = `${ESP32_BASE_URL}/events`;
  if (espEventStream) {
    espEventStream.close();
    espEventStream = null;
  }

  espEventStream = new EventSource(eventsUrl);

  const relayEvent = (eventType) => {
    espEventStream.addEventListener(eventType, (event) => {
      try {
        const payload = JSON.parse(event.data);
        broadcastSse(eventType, {
          ...payload,
          bridgedFrom: 'esp32',
          timestamp: payload.timestamp || new Date().toISOString(),
        });
      } catch (parseError) {
        broadcastSse(eventType, {
          type: eventType,
          message: String(event.data || ''),
          details: parseError && parseError.message ? parseError.message : '',
          bridgedFrom: 'esp32',
          timestamp: new Date().toISOString(),
        });
      }
    });
  };

  [
    'patient_registered',
    'api_patient_registered',
    'patient_queued',
    'api_patient_queued',
    'diagnosis_started',
    'measurement_complete',
    'diagnosis_completed',
    'next_patient_called',
    'queue_empty',
  ].forEach(relayEvent);

  espEventStream.onopen = () => {
    espOnline = true;
    appendSerialLogLine(`BRIDGE_CONNECTED: ${eventsUrl}`, 'BRIDGE_INFO');
  };

  espEventStream.onerror = () => {
    espOnline = false;
    appendSerialLogLine(`BRIDGE_EVENT_STREAM_DISCONNECTED: ${eventsUrl}`, 'BRIDGE_WARN');
    setTimeout(startEspEventBridge, 3000);
  };
}

async function startSerialBridge() {
  if (!SERIAL_BRIDGE_ENABLED) {
    appendSerialLogLine('SERIAL_BRIDGE_DISABLED', 'BRIDGE_INFO');
    return;
  }

  try {
    const { SerialPort } = require('serialport');
    const { ReadlineParser } = require('@serialport/parser-readline');

    const availablePorts = await SerialPort.list();
    const candidate = availablePorts.find((p) => p.path === SERIAL_PORT_PATH)
      || availablePorts.find((p) => /^\/dev\/(ttyUSB|ttyACM)/.test(p.path))
      || availablePorts[0];

    if (!candidate || !candidate.path) {
      appendSerialLogLine('SERIAL_BRIDGE_WAITING: no serial port detected', 'BRIDGE_WARN');
      if (!serialRetryTimer) {
        serialRetryTimer = setTimeout(() => {
          serialRetryTimer = null;
          startSerialBridge();
        }, 3000);
      }
      return;
    }

    currentSerialPath = candidate.path;
    serialPortInstance = new SerialPort({
      path: currentSerialPath,
      baudRate: SERIAL_BAUD_RATE,
      autoOpen: true,
    });

    serialParser = serialPortInstance.pipe(new ReadlineParser({ delimiter: '\n' }));
    serialParser.on('data', (line) => {
      appendSerialLogLine(line, 'SERIAL');
    });

    serialPortInstance.on('open', () => {
      appendSerialLogLine(`SERIAL_BRIDGE_CONNECTED: ${currentSerialPath} @ ${SERIAL_BAUD_RATE}`, 'BRIDGE_INFO');
    });

    serialPortInstance.on('close', () => {
      appendSerialLogLine(`SERIAL_BRIDGE_CLOSED: ${currentSerialPath}`, 'BRIDGE_WARN');
      if (!serialRetryTimer) {
        serialRetryTimer = setTimeout(() => {
          serialRetryTimer = null;
          startSerialBridge();
        }, 3000);
      }
    });

    serialPortInstance.on('error', (error) => {
      appendSerialLogLine(`SERIAL_BRIDGE_ERROR: ${error.message}`, 'BRIDGE_ERROR');
      if (!serialRetryTimer) {
        serialRetryTimer = setTimeout(() => {
          serialRetryTimer = null;
          startSerialBridge();
        }, 3000);
      }
    });
  } catch (error) {
    appendSerialLogLine(`SERIAL_BRIDGE_UNAVAILABLE: ${error.message}`, 'BRIDGE_WARN');
    if (!serialRetryTimer) {
      serialRetryTimer = setTimeout(() => {
        serialRetryTimer = null;
        startSerialBridge();
      }, 4000);
    }
  }
}

app.get('/events', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  res.write(': connected\n\n');
  sseClients.add(res);

  const recent = serialLog.slice(-30);
  for (const entry of recent) {
    res.write('event: serial_log\n');
    res.write(`data: ${JSON.stringify({
      type: 'serial_log',
      message: entry.line,
      details: `${entry.tag}: ${entry.details}`,
      timestamp: entry.timestamp,
    })}\n\n`);
  }

  const state = await getUnifiedState();
  res.write('event: state_snapshot\n');
  res.write(`data: ${JSON.stringify({
    type: 'state_snapshot',
    message: 'Initial state snapshot',
    state,
    timestamp: new Date().toISOString(),
  })}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

app.get('/api/state', async (req, res) => {
  const state = await getUnifiedState();
  return res.json({ success: true, state, bridge: { espOnline, lastBridgeError } });
});

app.post('/api/commands', async (req, res) => {
  try {
    const action = String(req.body?.action || '').trim();
    if (!action) {
      return res.status(400).json({ success: false, error: 'Missing action' });
    }

    const result = await executeCommand(action, req.body || {});
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Command execution failed' });
  }
});

// Legacy compatibility endpoints (mapped to commands)
app.post('/api/patients', async (req, res) => {
  try {
    const result = await executeCommand('register_patient', req.body || {});
    return res.json({ success: true, patientId: result.patientId, message: 'Patient registered successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to register patient' });
  }
});

app.post('/api/queue', async (req, res) => {
  try {
    const body = {
      patientId: req.body.patientId || req.query.patientId || '',
    };
    await executeCommand('queue_patient', body);
    const state = await getUnifiedState();
    const idx = (state.queue || []).findIndex((q) => String(q.patientId) === String(body.patientId));
    return res.json({
      success: true,
      position: idx >= 0 ? idx + 1 : 1,
      message: 'Added to queue',
      patientName: (state.queue || []).find((q) => String(q.patientId) === String(body.patientId))?.patientName || '',
      lcd: state.lcd,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to add to queue' });
  }
});

app.delete('/api/queue', async (req, res) => {
  try {
    const body = {
      patientId: req.body.patientId || req.query.patientId || '',
    };
    await executeCommand('remove_from_queue', body);
    return res.json({ success: true, message: 'Removed from queue' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to remove from queue' });
  }
});

app.post('/api/diagnosis/start', async (req, res) => {
  try {
    await executeCommand('start_diagnosis', req.body || {});
    const state = await getUnifiedState();
    return res.json({
      success: true,
      activePatientId: state.activePatientId,
      activePatientName: state.activePatientName,
      message: 'Place finger for diagnosis',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to start diagnosis' });
  }
});

app.post('/api/diagnosis/complete', async (req, res) => {
  try {
    await executeCommand('complete_diagnosis', req.body || {});
    return res.json({ success: true, message: 'Diagnosis completed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to complete diagnosis' });
  }
});

app.get('/api/queue', async (req, res) => {
  const state = await getUnifiedState();
  return res.json({
    queue: state.queue || [],
    total: state.queueCount || 0,
    nextPatient: state.nextPatientName || null,
  });
});

app.get('/api/measurements', async (req, res) => {
  const state = await getUnifiedState();
  const m = state.measurements || {};
  return res.json({
    heartRate: m.heartRate || 0,
    hr: m.heartRate || 0,
    spO2: m.spO2 || 0,
    spo2: m.spO2 || 0,
    hemoglobin: m.hemoglobin || 0,
    status: m.status || 'IDLE',
    irValue: m.irValue || 0,
    ir_value: m.irValue || 0,
    redValue: m.redValue || 0,
    red_value: m.redValue || 0,
    timestamp: Date.now(),
    valid: Boolean(m.valid),
    canMeasure: Boolean(state.canMeasure),
    activePatientId: state.activePatientId || '',
    activePatientName: state.activePatientName || '',
    workflowMessage: state.workflowMessage || '',
    sensorEnabled: Boolean(state.sensorEnabled),
    lcd: state.lcd || null,
  });
});

app.get('/api/status', async (req, res) => {
  const state = await getUnifiedState();
  return res.json({
    system: espOnline ? 'online' : 'degraded',
    uptime_ms: state.uptime_ms || 0,
    has_measurement: Boolean(state.measurements && state.measurements.valid),
    canMeasure: Boolean(state.canMeasure),
    activePatientId: state.activePatientId || '',
    activePatientName: state.activePatientName || '',
    diagnosisActive: Boolean(state.diagnosisActive),
    queueCount: state.queueCount || 0,
    nextPatientName: state.nextPatientName || null,
    sensorEnabled: Boolean(state.sensorEnabled),
    workflowStage: state.workflowStage || 'IDLE',
    workflowMessage: state.workflowMessage || '',
    stateVersion: state.stateVersion || stateVersion,
    lcd: state.lcd || null,
    bridge: {
      espOnline,
      lastBridgeError,
      espBaseUrl: ESP32_BASE_URL,
    },
  });
});

app.get('/api/serial-log', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '80', 10), SERIAL_LOG_SIZE);
  return res.json({ log: serialLog.slice(-limit) });
});

app.get('/api/settings', (req, res) => {
  return res.json({
    device_name: 'Hemoglobin Detector Bridge',
    version: '2.0-bridge',
    bridge_enabled: BRIDGE_ENABLED,
    serial_bridge_enabled: SERIAL_BRIDGE_ENABLED,
    esp32_base_url: ESP32_BASE_URL,
  });
});

app.listen(PORT, '0.0.0.0', async () => {
  appendSerialLogLine(`SYSTEM_BOOT: Bridge server started on port ${PORT}`, 'SYSTEM_BOOT');
  appendSerialLogLine(`BRIDGE_TARGET: ${ESP32_BASE_URL}`, 'BRIDGE_INFO');
  appendSerialLogLine(`SERIAL_TARGET: ${SERIAL_PORT_PATH}@${SERIAL_BAUD_RATE}`, 'BRIDGE_INFO');

  startEspEventBridge();
  await startSerialBridge();

  console.log(`- Dashboard: http://0.0.0.0:${PORT}/`);
  console.log(`- Register: http://0.0.0.0:${PORT}/register.html`);
  console.log(`- Queue: http://0.0.0.0:${PORT}/queue.html`);
});
