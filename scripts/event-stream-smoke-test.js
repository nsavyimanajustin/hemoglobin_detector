const { EventSource } = require('eventsource');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 10000);

function postForm(path, data) {
  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(data).toString(),
  });
}

function waitForEvent(source, expectedType) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      source.close();
      reject(new Error(`Timed out waiting for ${expectedType}`));
    }, TIMEOUT_MS);

    const handler = (message) => {
      try {
        const event = JSON.parse(message.data);
        if (event.type === expectedType) {
          clearTimeout(timer);
          source.close();
          resolve(event);
        }
      } catch (error) {
        clearTimeout(timer);
        source.close();
        reject(error);
      }
    };

    source.addEventListener(expectedType, handler);
    source.onerror = (error) => {
      clearTimeout(timer);
      source.close();
      reject(error instanceof Error ? error : new Error('EventSource error'));
    };
  });
}

async function main() {
  const source = new EventSource(`${BASE_URL}/events`);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      source.close();
      reject(new Error('Timed out waiting for SSE connection')); 
    }, TIMEOUT_MS);

    source.onopen = () => {
      clearTimeout(timer);
      resolve();
    };

    source.onerror = (error) => {
      clearTimeout(timer);
      source.close();
      reject(error instanceof Error ? error : new Error('EventSource error'));
    };
  });

  const eventPromise = waitForEvent(source, 'api_patient_registered');

  const response = await postForm('/api/patients', {
    name: 'Event Stream Smoke Test',
    phone: '000000',
    gender: 'other',
    age: '22',
  });

  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new Error(`patient registration failed: ${JSON.stringify(json)}`);
  }

  const event = await eventPromise;
  if (!event || event.type !== 'api_patient_registered') {
    throw new Error('did not receive expected live registration event');
  }

  console.log('Event stream smoke test passed.');
}

main().catch((error) => {
  console.error('Event stream smoke test failed:', error.message);
  process.exit(1);
});