import { describe, expect, it, vi } from 'vitest';

// Any bot message the detector tries to send is recorded here so the test can fail on it.
const sent: { chatId: unknown; text: string }[] = [];

vi.mock('@/lib/notify.server', () => ({
  sendBotMessage: vi.fn((chatId: number | string, m: { text: string }) => {
    sent.push({ chatId, text: m.text });
    return Promise.resolve();
  }),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeader: (name: string) => (name === 'cf-connecting-ip' ? '203.0.113.9' : null),
}));

/** Minimal stand-in for the admin DB client: only the two farm-rule calls are expected. */
function fakeAdmin(score: number, alert: boolean) {
  const calls: string[] = [];
  const admin = {
    rpc: vi.fn(async (name: string) => {
      calls.push(name);
      if (name === 'dogg_record_signals') return { data: { score, reasons: ['ip', 'device'], alert }, error: null };
      return { data: null, error: null };
    }),
    // A real admin list on purpose: if the detector ever goes back to alerting admins, the send is recorded and the test fails.
    from: vi.fn(() => ({ select: () => Promise.resolve({ data: [{ telegram_id: 6334940213 }] }) })),
  };
  return { admin: admin as never, calls };
}

describe('multi-account detector notifications', () => {
  it('records signals and runs the farm rules without messaging any admin, even at a high risk score', async () => {
    process.env['DOGG_PROOF_SECRET'] = 'test-secret';
    const { recordSignals } = await import('@/lib/multi.server');
    const { admin, calls } = fakeAdmin(88, true);

    await recordSignals(admin, 123456789, { id: 'device-abc-123', fp: 'fingerprint-abc-123' }, { firstName: 'Carlos', username: 'carlos' });

    expect(calls).toEqual(['dogg_record_signals', 'dogg_auto_ban']);
    expect(sent).toEqual([]);
  });

  it('sends nothing when the database flags the account for review', async () => {
    process.env['DOGG_PROOF_SECRET'] = 'test-secret';
    const { recordSignals } = await import('@/lib/multi.server');
    const { admin } = fakeAdmin(70, true);

    await recordSignals(admin, 987654321, { id: 'device-xyz-789', fp: 'fingerprint-xyz-789' }, { firstName: 'Ana', username: null });

    expect(sent).toEqual([]);
  });
});
