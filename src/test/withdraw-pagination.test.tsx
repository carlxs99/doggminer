import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { state } = vi.hoisted(() => ({ state: {
  name: 'Player', player: { balance: 0, withdrawVerified: true, walletAddress: null },
  demo: false, wallet: null, openWallet: null, history: [] as { kind: string; amount: number; at: number; label: string }[],
  withdraw: vi.fn(), busy: false,
} }));
vi.mock('@/components/dogg/state', () => ({ useDogg: () => state, WITHDRAW_MIN: 1000, WITHDRAW_FEE: 70 }));
vi.mock('@/lib/dogg.functions', () => ({ referralAction: {}, openVerificationPayment: {} }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: vi.fn() }));
vi.mock('@/components/dogg/screens', () => ({ Title: () => null }));
vi.mock('@/components/dogg/hero', () => ({ ScreenHero: () => null }));
vi.mock('@/components/dogg/buy', () => ({ BuyDedustLink: () => null, DedustWebLink: () => null }));

const { Perfil } = await import('@/components/dogg/vault');
afterEach(cleanup);
const entries = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: 'withdraw', amount: -(1000 + i), at: Date.now() - i * 60000, label: 'hist.withdraw' }));
const countRows = (container: HTMLElement) => container.querySelectorAll('.vault-item').length;

describe('Withdrawal pagination', () => {
  it('pages 41 withdrawals in groups of 20 without including earnings', () => {
    state.history = [...entries(41), { kind: 'mining', amount: 5, at: 1, label: 'hist.mining' }];
    const { container } = render(<Perfil />);
    expect(countRows(container)).toBe(20);
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Next'));
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(countRows(container)).toBe(20);
    fireEvent.click(screen.getByLabelText('Next'));
    expect(countRows(container)).toBe(1);
    expect(screen.getByLabelText('Next')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Previous'));
    expect(countRows(container)).toBe(20);
  });
  it('clamps the current page when refreshed history becomes shorter', () => {
    state.history = entries(41);
    const { container, rerender } = render(<Perfil />);
    fireEvent.click(screen.getByLabelText('Next'));
    fireEvent.click(screen.getByLabelText('Next'));
    state.history = entries(20);
    rerender(<Perfil />);
    expect(countRows(container)).toBe(20);
    expect(screen.queryByLabelText('Next')).not.toBeInTheDocument();
    state.history = [];
    rerender(<Perfil />);
    expect(countRows(container)).toBe(0);
    expect(screen.getByText('No withdrawals yet.')).toBeInTheDocument();
  });
});