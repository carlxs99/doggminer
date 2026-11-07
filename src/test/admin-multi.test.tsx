import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { multi, overview } = vi.hoisted(() => ({ multi: vi.fn(), overview: vi.fn().mockResolvedValue({ stats: {}, wallet: {}, log: [] }) }));
vi.mock('@/components/dogg/state', () => ({ useDogg: () => ({ isAdmin: true, demo: false }) }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock('@/lib/admin.functions', () => ({ adminMulti: multi, adminOverview: overview, adminAdjust: vi.fn(), adminSaveTask: vi.fn(), adminTaskAction: vi.fn(), adminTasks: vi.fn(), adminUsers: vi.fn(), adminWithdrawalAction: vi.fn(), adminWithdrawals: vi.fn(), adminMultiReview: vi.fn(), adminSetBan: vi.fn() }));
const { AdminPanel } = await import('@/components/dogg/admin');
afterEach(() => { cleanup(); multi.mockReset(); });
const report = { rows: [], linked: 1000, high: 250, total: 201 };

describe('Admin multicuentas requests', () => {
  it('requests the next server page and resets the page when filtering', async () => {
    multi.mockResolvedValue(report);
    render(<AdminPanel />);
    fireEvent.click(screen.getByRole('tab', { name: 'Multi' }));
    await waitFor(() => expect(multi).toHaveBeenCalledWith({ data: { initData: '', filter: 'all', page: 0 } }));
    await waitFor(() => expect(screen.getByLabelText('Next')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Next'));
    await waitFor(() => expect(multi).toHaveBeenLastCalledWith({ data: { initData: '', filter: 'all', page: 1 } }));
    fireEvent.click(screen.getByRole('button', { name: /^Suspicious$/ }));
    await waitFor(() => expect(multi).toHaveBeenLastCalledWith({ data: { initData: '', filter: 'flagged', page: 0 } }));
  });
  it('allows retry after a failed report request', async () => {
    multi.mockRejectedValueOnce(new Error('timeout')).mockResolvedValue(report);
    render(<AdminPanel />);
    fireEvent.click(screen.getByRole('tab', { name: 'Multi' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(multi).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});