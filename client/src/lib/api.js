const BASE = '/api';

async function fetchJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function postJSON(path, data) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function getUnfulfilledOrders(params = {}) {
  const qs = new URLSearchParams();
  if (params.channel) qs.set('channel', params.channel);
  if (params.location) qs.set('location', params.location);
  if (params.age) qs.set('age', params.age);
  if (params.search) qs.set('search', params.search);
  if (params.sort) qs.set('sort', params.sort);
  if (params.direction) qs.set('direction', params.direction);
  const query = qs.toString();
  return fetchJSON(`/orders/unfulfilled${query ? `?${query}` : ''}`);
}

export function getOrdersSummary() {
  return fetchJSON('/orders/summary');
}

export function triggerSync() {
  return postJSON('/sync/shopify-orders');
}
