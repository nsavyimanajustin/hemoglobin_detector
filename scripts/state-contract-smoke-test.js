const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function postCommand(action, payload = {}) {
  const response = await fetch(`${BASE_URL}/api/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new Error(`${action} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function getState() {
  const response = await fetch(`${BASE_URL}/api/state`);
  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new Error(`state fetch failed: ${JSON.stringify(json)}`);
  }
  return json.state;
}

async function main() {
  const before = await getState();

  const registered = await postCommand('register_patient', {
    name: 'State Contract Test',
    phone: '000000',
    gender: 'other',
    age: 24,
  });
  const patientId = String(registered.patientId);

  const queued = await postCommand('queue_patient', { patientId });
  if (!queued.state || queued.state.queueCount < 1) {
    throw new Error('queue_patient did not update queueCount');
  }

  const completed = await postCommand('complete_diagnosis');
  if (!completed.state) {
    throw new Error('complete_diagnosis did not return state');
  }

  const after = await getState();
  if (after.stateVersion <= before.stateVersion) {
    throw new Error('stateVersion did not increase');
  }

  console.log('State contract smoke test passed.');
  console.log(`stateVersion: ${before.stateVersion} -> ${after.stateVersion}`);
}

main().catch((error) => {
  console.error('State contract smoke test failed:', error.message);
  process.exit(1);
});
