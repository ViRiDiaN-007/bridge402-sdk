/**
 * HTTP utilities
 */

import { request } from 'undici';

/**
 * HTTP POST request
 */
export async function httpPost(url, { headers = {}, body = undefined } = {}) {
  const res = await request(url, { method: 'POST', headers, body });
  const text = await res.body.text();
  try {
    return { status: res.statusCode, json: JSON.parse(text) };
  } catch {
    return { status: res.statusCode, json: text };
  }
}

/**
 * HTTP GET request
 */
export async function httpGet(url, { headers = {} } = {}) {
  const res = await request(url, { method: 'GET', headers });
  const text = await res.body.text();
  try {
    return { status: res.statusCode, json: JSON.parse(text) };
  } catch {
    return { status: res.statusCode, json: text };
  }
}



