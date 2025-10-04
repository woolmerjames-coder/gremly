import { describe, it, expect } from 'vitest';
import { POST } from '../src/app/api/items/route';

describe('POST /api/items', () => {
  it('returns 401 when not authenticated', async () => {
    const req = new Request('http://localhost/api/items', { method: 'POST', body: JSON.stringify({ raw_text: 'hi' }) });
  const res = await POST(req as unknown as Request);
    // NextResponse.json returns Response with status; check body
    const body = await res.json();
    expect(body.error).toBe('Not authenticated');
  });
});
