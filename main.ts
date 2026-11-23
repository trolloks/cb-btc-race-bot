// Long-only cbBTC bot. It waits for a washout bar (or 90 bars), buys in SLICES equal parts
// over the next bars and sells in EXIT_BARS equal parts over the last EXIT_BARS bars: each pool
// depth, so equal slices pay about 1/SLICES of the price impact of one full-size order, while
// the fee and slippage stay proportional. Between them it holds. If the close falls STOP_BPS
// under the highest close seen since the buy, it sells in STOP_PARTS parts over the next bars
// (the pool resets, so two halves cost half the impact of one sale) and stays in cash until a
// close makes a new high above that peak, then buys back in. Integer arithmetic only, so two
// runs produce the same orders.

import { BPS, runBars, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

/** 300 bps: sell after a 3% fall from the highest close since the buy. */
const STOP_BPS = 300n;
/** Wide enough to fill on a gap, narrow enough to refuse a broken book. */
const SLIPPAGE_BPS = 500;
/** A stop sells in this many parts, one bar apart, to halve its impact. */
const STOP_PARTS = 2;
/** Wait for a washout (low 0.5% under the day high, close in the bottom 30% of the bar) or bar 90. */
const DIP_BPS = 50n;
const START_BY_BAR = 90;
const WASHOUT_CLOSE_PCT = 30n;
/** Entry bars: the pool depth resets every bar, so 12 slices pay ~1/12 of the impact. */
const SLICES = 12;
/** The window is 1,440 bars; sell 11/12 over the last 12 bars and leave 1/12 for the close flatten. */
const TOTAL_BARS = 1440;
const EXIT_BARS = 12;
const EXIT_START = TOTAL_BARS - EXIT_BARS;

let filledSlices = 0;
let attempt = 0;
let peak = 0n;
let dayHigh = 0n;
let started = false;
let wantFlat = false;
let stopPartsLeft = 0;

function allIn(state: { cash: bigint; equity: bigint; hello: { caps: { max_weight_bps: number } } }): bigint {
  const byWeight = (BigInt(state.hello.caps.max_weight_bps) * state.equity) / BPS;
  return state.cash < byWeight ? state.cash : byWeight;
}

await runBars({
  onBatch(state, batch) {
    for (const fill of batch.fills) {
      if (fill.side === 'buy' && fill.status === 'filled' && fill.client_id.startsWith('slice-')) filledSlices++;
    }

    const symbol = state.hello.symbols[0]?.symbol;
    if (symbol === undefined || state.warmingUp) return [];
    const close = state.close(symbol);
    if (close === null) return [];

    if (close > dayHigh) dayHigh = close;
    if (!started) {
      const bar = state.latest.get(symbol);
      const low = bar === undefined ? close : BigInt(bar.l);
      const high = bar === undefined ? close : BigInt(bar.h);
      const range = high > low ? high - low : 0n;
      const closePos = range > 0n ? ((close - low) * 100n) / range : 100n;
      const washout = low * BPS <= dayHigh * (BPS - DIP_BPS) && closePos < WASHOUT_CLOSE_PCT;
      if (!washout && state.seq < START_BY_BAR) return [];
      started = true;
      peak = close;
    }

    if (close > peak) peak = close;
    const held = state.positions.get(symbol);
    const min = BigInt(state.hello.fees.min_notional_quote_units);

    if (wantFlat) {
      if (held !== undefined) {
        return [{ side: 'sell', symbol, qty: held.qty, max_slippage_bps: SLIPPAGE_BPS } satisfies SellInput];
      }
      // Flat after a stop: wait for the price to clear the peak that stopped it out. The flag
      // clears only once the buy fills, so a rejected re-entry is sent again on the next new high.
      if (close <= peak) return [];
      const notional = allIn(state);
      if (notional < min) return [];
      wantFlat = false;
      stopPartsLeft = 0;
      filledSlices = SLICES;
      return [{ side: 'buy', symbol, notional_quote_units: notional, max_slippage_bps: SLIPPAGE_BPS, client_id: `reentry-${attempt++}` } satisfies BuyInput];
    }

    if (stopPartsLeft > 0 && held !== undefined) {
      const qty = held.qty / BigInt(stopPartsLeft);
      stopPartsLeft--;
      if (stopPartsLeft === 0) wantFlat = true;
      if (qty > 0n) {
        return [{ side: 'sell', symbol, qty, max_slippage_bps: SLIPPAGE_BPS } satisfies SellInput];
      }
      wantFlat = true;
    }

    if (held !== undefined && close * BPS <= peak * (BPS - STOP_BPS)) {
      stopPartsLeft = STOP_PARTS;
      const qty = held.qty / BigInt(STOP_PARTS);
      stopPartsLeft--;
      if (stopPartsLeft === 0) wantFlat = true;
      return [{ side: 'sell', symbol, qty, max_slippage_bps: SLIPPAGE_BPS } satisfies SellInput];
    }

    // Spread the exit the same way: sell a twelfth of the position per bar over the last twelve,
    // leaving the last twelfth for the replay's close-side flatten.
    if (held !== undefined && state.seq >= EXIT_START && state.seq < TOTAL_BARS - 1) {
      const qty = held.qty / BigInt(TOTAL_BARS - state.seq);
      if (qty > 0n) {
        return [{ side: 'sell', symbol, qty, max_slippage_bps: SLIPPAGE_BPS } satisfies SellInput];
      }
    }

    if (filledSlices < SLICES) {
      const remaining = BigInt(SLICES - filledSlices);
      const notional = state.cash / remaining;
      if (notional < min) {
        filledSlices = SLICES;
      } else {
        return [{ side: 'buy', symbol, notional_quote_units: notional, max_slippage_bps: SLIPPAGE_BPS, client_id: `slice-${attempt++}` } satisfies BuyInput];
      }
    }

    // A slice the market refused leaves cash behind; put it to work rather than hold it all day.
    if (held === undefined) {
      const notional = allIn(state);
      if (notional < min) return [];
      return [{ side: 'buy', symbol, notional_quote_units: notional, max_slippage_bps: SLIPPAGE_BPS, client_id: `fill-${attempt++}` } satisfies BuyInput];
    }
    return [];
  },
});
