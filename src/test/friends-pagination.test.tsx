import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// One fake referral call: it records which page the UI asked for and answers with that page's recruits.
const { calls, refCall } = vi.hoisted(() => {
  const calls: number[] = [];
  const refCall = async ({ data }: { data: { page?: number } }) => {
    const page = data.page ?? 0;
    calls.push(page);
    return {
      total: 942, qualified: 5, pending: 10, earned: 20, balance: 1, claimed: 0,
      walletLinked: true, page, pages: 48,
      friends: Array.from({ length: 20 }, (_, i) => ({
        name: `Homie ${page * 20 + i}`,
        username: null,
        joinedAt: new Date(Date.UTC(2026, 10, 5, 0, i)).toISOString(),
        qualified: i % 2 === 0,
        given: 0,
      })),
    };
  };
  return { calls, refCall };
});

vi.mock('@tanstack/react-start', () => {
  // Other modules in the graph build server functions at import time; they are never called here.
  const chain = (): any => { const f = () => chain(); f.inputValidator = () => f; f.handler = () => f; f.middleware = () => f; return f; };
  return { useServerFn: () => refCall, createServerFn: () => chain() };
});
vi.mock('@/lib/dogg.functions', () => ({ referralAction: {} }));
vi.mock('@/components/dogg/state', async () => {
  const w = await import('@/lib/withdraw');
  return {
    WITHDRAW_MIN: w.WITHDRAW_MIN,
    WITHDRAW_FEE: w.WITHDRAW_FEE,
    DoggProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useDogg: () => ({ demo: false, busy: false, applyBalance: () => {} }),
  };
});

const { Amigos } = await import('@/components/dogg/vault');

describe('Friends pagination', () => {
  it('shows 20 recruits per page with a page indicator and walks forward and back', async () => {
    calls.length = 0;
    Object.defineProperty(window, 'Telegram', {
      configurable: true,
      value: { WebApp: { initData: 'signed-init-data', initDataUnsafe: { user: { id: 123 } }, HapticFeedback: { impactOccurred: () => {} } } },
    });

    render(<Amigos />);

    await waitFor(() => expect(screen.getByText('Page 1 of 48')).toBeInTheDocument());
    expect(screen.getByText('Homie 0')).toBeInTheDocument();
    expect(screen.queryByText('Homie 20')).not.toBeInTheDocument();
    expect(calls).toEqual([0]);

    fireEvent.click(screen.getByLabelText('Next'));
    await waitFor(() => expect(screen.getByText('Page 2 of 48')).toBeInTheDocument());
    expect(screen.getByText('Homie 20')).toBeInTheDocument();
    expect(calls).toEqual([0, 1]);

    fireEvent.click(screen.getByLabelText('Previous'));
    await waitFor(() => expect(screen.getByText('Page 1 of 48')).toBeInTheDocument());
    expect(screen.getByText('Homie 0')).toBeInTheDocument();
    expect(calls).toEqual([0, 1]); // page 1 was served from cache, so nothing was fetched again
    expect(screen.getByLabelText('Previous')).toBeDisabled();
  });
});
