import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { passportExpiryState, summarizeMonthlyDashboard } from '../src/lib/dashboard-metrics';

describe('dashboard metrics', () => {
  it('counts current-month applications and received revenue only', () => {
    const start = new Date('2026-07-01T00:00:00+03:00');
    const result = summarizeMonthlyDashboard([
      { status: 'onaylandi', created_at: '2026-07-02T10:00:00+03:00' },
      { status: 'reddedildi', created_at: '2026-07-03T10:00:00+03:00' },
      { status: 'profil_analizi', created_at: '2026-06-30T23:00:00+03:00' },
    ], [
      { amount: 1500, status: 'alindi', created_at: '2026-07-05T12:00:00+03:00' },
      { amount: 500, status: 'bekliyor', created_at: '2026-07-06T12:00:00+03:00' },
      { amount: 900, status: 'alindi', created_at: '2026-06-20T12:00:00+03:00' },
    ], start);

    assert.deepEqual(result, { applications: 2, approved: 1, rejected: 1, revenue: 1500 });
  });

  it('marks past passport dates as expired and future dates with remaining days', () => {
    const now = new Date('2026-07-22T12:00:00+03:00');
    assert.deepEqual(passportExpiryState('2026-07-21', now), { expired: true, days: -1 });
    assert.deepEqual(passportExpiryState('2026-07-25', now), { expired: false, days: 3 });
  });
});
