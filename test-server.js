const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const sseClients = new Set();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'data')));

const patients = [];
const queue = [];
let nextPatientId = 1;
let activePatientId = '';
let activePatientName = '';

// Rolling serial log buffer (last 200 lines)
const SERIAL_LOG_SIZE = 200;
const serialLog = [];

function logEvent(tag, details) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${tag}: ${details}`;
  console.log(line);

  // Keep rolling buffer
  serialLog.push({ timestamp, tag, details, line });
  if (serialLog.length > SERIAL_LOG_SIZE) {
    serialLog.shift();
  }

  // Broadcast to all SSE clients as a serial_log event
  broadcastSSE('serial_log', line, `${tag}: ${details}`);
}

function broadcastSSE(type, message, details = '') {
  const payload = JSON.stringify({
    type,
    message,
    details,
    timestamp: new Date().toISOString(),
  });

  for (const client of sseClients) {
    client.write(`event: ${type}\n`);
    client.write(`data: ${payload}\n\n`);
  }
}

function sendLiveEvent(type, message, details = '') {
  const payload = JSON.stringify({
    type,
    message,
    details,
    timestamp: new Date().toISOString(),
  });

  for (const client of sseClients) {
    client.write(`event: ${type}\n`);
    client.write(`data: ${payload}\n\n`);
  }
}

// Compute LCD display lines based on current state
function getLcdState() {
  if (activePatientId) {
    return {
      line1: `Patient: ${activePatientName.substring(0, 16)}`,
      line2: 'Place finger now',
      state: 'diagnosis_active'
    };
  }
  if (queue.length > 0) {
    return {
      line1: `Queue: ${queue.length} patient${queue.length > 1 ? 's' : ''}`,
      line2: `Next: ${queue[0].patientName.substring(0, 11)}`,
      state: 'queue_waiting'
    };
  }
  return {
    line1: 'Hemoglobin Det.',
    line2: 'Register patient',
    state: 'idle'
  };
}

app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  res.write(': connected\n\n');
  sseClients.add(res);

  // Send the last 20 serial log entries immediately on connect
  const recent = serialLog.slice(-20);
  for (const entry of recent) {
    const payload = JSON.stringify({
      type: 'serial_log',
      message: entry.line,
      details: `${entry.tag}: ${entry.details}`,
      timestamp: entry.timestamp,
    });
    res.write(`event: serial_log\n`);
    res.write(`data: ${payload}\n\n`);
  }

  req.on('close', () => {
    sseClients.delete(res);
  });
});

app.post('/api/patients', (req, res) => {
  const { name, phone, gender, age } = req.body;
  if (!name || !phone) {
    return res.json({ error: 'Missing required fields' });
  }

  const patient = {
    id: String(nextPatientId++),
    name,
    phone,
    gender: gender || 'other',
    age: age ? parseInt(age) : 0,
    registeredAt: Date.now(),
    lastHemoglobin: 0,
    lastSpO2: 0,
    heartRate: 0
  };

  patients.push(patient);
  logEvent('PATIENT_REGISTERED', `ID=${patient.id}, Name=${patient.name}, Phone=${patient.phone}`);
  sendLiveEvent('api_patient_registered', `Registration received from web: ${patient.name}`, `PatientId=${patient.id}, Name=${patient.name}, Phone=${patient.phone}`);
  res.json({ success: true, patientId: patient.id, message: 'Patient registered successfully' });
});

app.get('/api/patients', (req, res) => {
  res.json({
    patients: patients.map(p => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      gender: p.gender,
      age: p.age,
      hemoglobin: p.lastHemoglobin,
      spo2: p.lastSpO2
    })),
    total: patients.length
  });
});

app.post('/api/queue', (req, res) => {
  const patientId = req.body.patientId || req.query.patientId;
  if (!patientId) {
    return res.json({ error: 'Missing patientId' });
  }

  const patient = patients.find(p => p.id === patientId);
  if (!patient) {
    return res.json({ error: 'Failed to add to queue' });
  }

  const alreadyInQueue = queue.find(q => q.patientId === patientId);
  if (alreadyInQueue) {
    return res.json({ error: 'Failed to add to queue' });
  }

  queue.push({
    patientId: patient.id,
    patientName: patient.name,
    queuedAt: Date.now(),
    position: queue.length + 1
  });

  logEvent('PATIENT_QUEUED', `ID=${patient.id}, Name=${patient.name}, Position=${queue.length}`);
  sendLiveEvent('api_patient_queued', `Queue updated: ${patient.name}`, `PatientId=${patient.id}, QueuePosition=${queue.length}`);

  // Auto-call the first patient if no active diagnosis
  if (!activePatientId && queue.length > 0) {
    activePatientId = queue[0].patientId;
    activePatientName = queue[0].patientName;
    logEvent('DIAGNOSIS_STARTED', `ID=${activePatientId}, Name=${activePatientName}`);
    logEvent('LCD_UPDATE', `Line1=Patient: ${activePatientName} | Line2=Place finger now`);
    logEvent('SENSOR_ENABLE', `MAX30102 enabled for PatientId=${activePatientId}`);
    sendLiveEvent('diagnosis_started', `Call patient: ${activePatientName}`, `PatientId=${activePatientId}`);
    sendLiveEvent('lcd_update', `Patient: ${activePatientName}`, 'Place finger now');
    sendLiveEvent('sensor_enabled', `MAX30102 sensor enabled`, `PatientId=${activePatientId}`);
  }

  const lcd = getLcdState();
  res.json({
    success: true,
    position: queue.length,
    message: 'Added to queue',
    patientId: patient.id,
    patientName: patient.name,
    lcd
  });
});

app.get('/api/queue', (req, res) => {
  res.json({
    queue: queue,
    total: queue.length,
    nextPatient: queue.length > 0 ? queue[0].patientName : null
  });
});

app.post('/api/queue/call', (req, res) => {
  if (queue.length === 0) {
    return res.json({ message: 'No patients in queue' });
  }
  activePatientId = queue[0].patientId;
  activePatientName = queue[0].patientName;
  res.json({ success: true, patientId: activePatientId, patientName: activePatientName });
});

app.post('/api/diagnosis/start', (req, res) => {
  const patientId = req.body.patientId || req.query.patientId || (queue[0] && queue[0].patientId);
  const target = queue.find(q => q.patientId === patientId);
  if (!target) {
    return res.json({ success: false, message: 'No valid queued patient' });
  }
  activePatientId = target.patientId;
  activePatientName = target.patientName;
  logEvent('DIAGNOSIS_STARTED', `ID=${activePatientId}, Name=${activePatientName}`);
  logEvent('LCD_UPDATE', `Line1=Patient: ${activePatientName} | Line2=Place finger now`);
  logEvent('SENSOR_ENABLE', `MAX30102 enabled for PatientId=${activePatientId}`);
  sendLiveEvent('diagnosis_started', `Call patient: ${activePatientName}`, `PatientId=${activePatientId}`);
  sendLiveEvent('lcd_update', `Patient: ${activePatientName}`, 'Place finger now');
  sendLiveEvent('sensor_enabled', `MAX30102 sensor enabled`, `PatientId=${activePatientId}`);
  res.json({ success: true, activePatientId, activePatientName, message: 'Place finger for diagnosis' });
});

app.post('/api/diagnosis/complete', (req, res) => {
  if (!activePatientId) {
    return res.json({ success: false, message: 'No active diagnosis' });
  }
  const idx = queue.findIndex(q => q.patientId === activePatientId);
  if (idx !== -1) {
    queue.splice(idx, 1);
    queue.forEach((q, i) => q.position = i + 1);
  }
  logEvent('DIAGNOSIS_COMPLETED', `ID=${activePatientId}, Name=${activePatientName}`);
  logEvent('MEASUREMENT_RESULT', `HR=72, SpO2=98, Hb=14.5, Status=Normal`);
  sendLiveEvent('measurement_complete', `Results saved for ${activePatientName}`, 'HR=72, SpO2=98, Hb=14.5, Status=Normal');
  sendLiveEvent('diagnosis_completed', `Diagnosis completed for ${activePatientName}`, `PatientId=${activePatientId}`);
  activePatientId = '';
  activePatientName = '';

  if (queue.length > 0) {
    activePatientId = queue[0].patientId;
    activePatientName = queue[0].patientName;
    logEvent('NEXT_PATIENT', `Auto-called: ID=${activePatientId}, Name=${activePatientName}`);
    logEvent('LCD_UPDATE', `Line1=Patient: ${activePatientName} | Line2=Place finger now`);
    logEvent('SENSOR_ENABLE', `MAX30102 enabled for PatientId=${activePatientId}`);
    sendLiveEvent('next_patient_called', `Auto-called: ${queue[0].patientName}`, `PatientId=${queue[0].patientId}`);
    sendLiveEvent('lcd_update', `Patient: ${activePatientName}`, 'Place finger now');
    sendLiveEvent('sensor_enabled', `MAX30102 sensor enabled`, `PatientId=${activePatientId}`);
  } else {
    logEvent('LCD_UPDATE', `Line1=Hemoglobin Det. | Line2=Queue empty`);
    logEvent('SENSOR_DISABLE', `MAX30102 disabled - no active patient`);
    sendLiveEvent('queue_empty', 'Queue is now empty', 'No active patient remains');
    sendLiveEvent('lcd_update', 'Hemoglobin Det.', 'Queue empty');
    sendLiveEvent('sensor_disabled', 'MAX30102 sensor disabled', 'No active patient');
  }

  res.json({ success: true, message: 'Diagnosis completed' });
});

app.delete('/api/queue', (req, res) => {
  const patientId = req.body.patientId || req.query.patientId;
  if (!patientId) {
    return res.json({ error: 'Missing patientId' });
  }

  const idx = queue.findIndex(q => q.patientId === patientId);
  if (idx === -1) {
    return res.json({ success: false, message: 'Not found in queue' });
  }

  queue.splice(idx, 1);
  queue.forEach((q, i) => q.position = i + 1);
  logEvent('QUEUE_REMOVED', `ID=${patientId}`);
  sendLiveEvent('queue_empty', 'Queue is now empty', 'No active patient remains');

  res.json({ success: true, message: 'Removed from queue' });
});

app.get('/api/measurements', (req, res) => {
  const canMeasure = Boolean(activePatientId);
  res.json({
    heartRate: canMeasure ? 72 : 0,
    hr: canMeasure ? 72 : 0,
    spO2: canMeasure ? 98 : 0,
    spo2: canMeasure ? 98 : 0,
    hemoglobin: canMeasure ? 14.5 : 0,
    status: canMeasure ? 'Normal' : 'IDLE',
    irValue: canMeasure ? 150000 : 0,
    ir_value: canMeasure ? 150000 : 0,
    redValue: canMeasure ? 80000 : 0,
    red_value: canMeasure ? 80000 : 0,
    timestamp: Date.now(),
    valid: canMeasure,
    canMeasure,
    activePatientId,
    activePatientName,
    workflowMessage: canMeasure
      ? `Diagnosing: ${activePatientName}`
      : (queue.length > 0 ? 'Patient queued — starting diagnosis...' : 'Register and queue a patient first'),
    sensorEnabled: canMeasure,
    lcd: getLcdState()
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    system: 'online',
    uptime_ms: 3600000,
    has_measurement: true,
    canMeasure: Boolean(activePatientId),
    activePatientId,
    activePatientName,
    diagnosisActive: Boolean(activePatientId),
    queueCount: queue.length,
    nextPatientName: queue.length > 0 ? queue[0].patientName : null,
    sensorEnabled: Boolean(activePatientId),
    lcd: getLcdState()
  });
});

app.get('/api/settings', (req, res) => {
  res.json({
    device_name: 'Hemoglobin Detector',
    version: '1.0',
    normal_hb_min: 12.0,
    mild_anemia_hb_min: 10.0,
    moderate_anemia_hb_min: 7.0,
    normal_spo2_min: 95.0
  });
});

// Serial log endpoint — returns last N lines
app.get('/api/serial-log', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, SERIAL_LOG_SIZE);
  res.json({ log: serialLog.slice(-limit) });
});

app.listen(PORT, '0.0.0.0', () => {
  logEvent('SYSTEM_BOOT', `Hemoglobin Detector test server started on port ${PORT}`);
  logEvent('SENSOR_INIT', 'MAX30102 sensor initialized');
  logEvent('LCD_INIT', 'LCD display initialized');
  logEvent('WIFI_CONNECT', `Web server ready at port ${PORT}`);
  console.log(`- Dashboard: http://0.0.0.0:${PORT}/`);
  console.log(`- Register: http://0.0.0.0:${PORT}/register.html`);
  console.log(`- Queue: http://0.0.0.0:${PORT}/queue.html`);
});
