const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function expectJson(path, method = 'GET', body) {
  const headers = {};
  let payload;

  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams(body).toString();
  }

  const response = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload });
  const json = await response.json();

  if (!response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}: ${JSON.stringify(json)}`);
  }

  return json;
}

async function main() {
  const m = await expectJson('/api/measurements');
  if (typeof m.hemoglobin !== 'number') {
    throw new Error('measurements endpoint missing hemoglobin');
  }

  const patient = await expectJson('/api/patients', 'POST', {
    name: 'Smoke Test',
    phone: '000000',
    gender: 'other',
    age: '22'
  });

  if (!patient.success || !patient.patientId) {
    throw new Error('patient registration failed');
  }

  const queued = await expectJson('/api/queue', 'POST', { patientId: String(patient.patientId) });
  if (!queued.success) {
    throw new Error('queue add failed');
  }

  const queue = await expectJson('/api/queue');
  if (!queue.total || !Array.isArray(queue.queue)) {
    throw new Error('queue listing failed');
  }

  const removed = await expectJson('/api/queue', 'DELETE', { patientId: String(patient.patientId) });
  if (!removed.success) {
    throw new Error('queue delete failed');
  }

  console.log('Smoke test passed.');
}

main().catch((error) => {
  console.error('Smoke test failed:', error.message);
  process.exit(1);
});
