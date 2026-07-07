/**
 * s2-client — direct S2 stream writes for immutable events.
 * Bypasses Turso completely to optimize write volume and cost.
 */

const S2_ENDPOINT = process.env.EXPO_PUBLIC_S2_ENDPOINT || 'https://s2.dev';

export interface S2Event {
  event: string;
  [key: string]: any;
}

/**
 * Write a record/event to an S2 stream.
 * Sends a POST request directly to the S2.dev streams endpoint.
 */
export async function writeS2Stream(
  workspaceId: string,
  streamName: string,
  event: S2Event,
  token?: string
): Promise<boolean> {
  const streamPath = `ws/${workspaceId}/${streamName}`;
  const url = `${S2_ENDPOINT}/streams/${encodeURIComponent(streamPath)}/records`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        ...event,
      }),
    });

    if (!res.ok) {
      console.warn(`[S2] Write to stream ${streamPath} failed:`, res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[S2] Direct connection error to ${url}:`, err);
    return false;
  }
}
