const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'data')));

// In-memory storage
const patients = [];
const queue = [];
let nextPatientId = 1;
let activePatientId = '';
let activePatientName = '';

// Logging helper
const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

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
    age: age ? parseInt(age) : 0
  };
  
  patients.push(patient);
  log(`PATIENT REGISTERED: ${name} (ID: ${patient.id})`);
  res.json({ success: true, patientId: patient.id, message: 'Patient registered successfully' });
});

app.get('/api/patients', (req, res) => {
  res.json({ patients, total: patients.length });
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
    return res.json({ error: 'Already in queue' });
  }
  
  queue.push({
    patientId: patient.id,
    patientName: patient.name,
    queuedAt: Date.now(),
    position: queue.length + 1
  });
  
  log(`PATIENT QUEUED: ${patient.name} at position ${queue.length}`);
  
  // Auto-call first if none active
  if (!activePatientId && queue.length > 0) {
    activePatientId = queue[0].patientId;
    activePatientName = queue[0].patientName;
    log(`DIAGNOSIS STARTED: Calling ${activePatientName}`);
  }
  
  res.json({ 
    success: true, 
    position: queue.length, 
    message: 'Added to queue',
    patientName: patient.name
  });
});

app.get('/api/queue', (req, res) => {
  res.json({
    queue,
    total: queue.length,
    nextPatient: queue.length > 0 ? queue[0].patientName : null
  });
});

app.post('/api/diagnosis/start', (req, res) => {
  if (queue.length === 0) {
    return res.json({ success: false, message: 'No patients in queue' });
  }
  activePatientId = queue[0].patientId;
  activePatientName = queue[0].patientName;
  log(`DIAGNOSIS STARTED: ${activePatientName}`);
  res.json({ success: true, activePatientId, activePatientName, message: 'Place finger for diagnosis' });
});

app.post('/api/diagnosis/complete', (req, res) => {
  if (!activePatientId) {
    return res.json({ success: false, message: 'No active diagnosis' });
  }
  
  log(`DIAGNOSIS COMPLETED for ${activePatientName}`);
  
  // Remove from queue
  const idx = queue.findIndex(q => q.patientId === activePatientId);
  if (idx !== -1) queue.splice(idx, 1);
  
  // Reset
  activePatientId = '';
  activePatientName = '';
  
  // Call next
  if (queue.length > 0) {
    activePatientId = queue[0].patientId;
    activePatientName = queue[0].patientName;
    log(`NEXT PATIENT: ${activePatientName}`);
  }
  
  res.json({ success: true, message: 'Diagnosis completed' });
});

app.get('/api/measurements', (req, res) => {
  res.json({
    heartRate: 72,
    spO2: 98,
    hemoglobin: 14.2,
    status: 'Normal',
    timestamp: Date.now(),
    valid: Boolean(activePatientId),
    canMeasure: Boolean(activePatientId),
    activePatientId,
    activePatientName,
    workflowMessage: activePatientName ? `Diagnosing ${activePatientName}` : 'Register and queue patient'
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    system: 'online',
    uptime_ms: Date.now(),
    canMeasure: Boolean(activePatientId),
    activePatientId,
    activePatientName,
    diagnosisActive: Boolean(activePatientId),
    queueCount: queue.length,
    nextPatientName: queue.length > 0 ? queue[0].patientName : null
  });
});

app.listen(PORT, () => {
  log(`Test server running at http://localhost:${PORT}`);
  log(`- Dashboard: http://localhost:${PORT}/`);
  log(`- Register: http://localhost:${PORT}/register.html?test=1`);
  log(`- Queue: http://localhost:${PORT}/queue.html?test=1`);
});