/** Mirrors dogg_flip: 50/50 coin, a correct call pays x1.95 (2.5% house edge). */
export const FLIP_MULT = 1.95;
export const FLIP_BETS = [5, 10, 25, 50, 100] as const;
export const flipPayout = (bet: number) => Math.floor(bet * FLIP_MULT * 100) / 100;
