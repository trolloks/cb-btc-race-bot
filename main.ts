// Long-only cbBTC bot. It buys at the first bar of the window and holds. If the close falls
// STOP_BPS under the highest close seen since the buy, it sells and stays in cash until a close
// makes a new high above that peak, then buys back in. A 6% trailing stop caps a crash at about
// 6.5% with fees while keeping the full upside of a rising day, and it is far inside the 25%
// drawdown guardrail. Integer arithmetic only, so two runs produce the same orders.

import { BPS, runBars, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

/** 600 bps: sell after a 6% fall from the highest close since the buy. */
const STOP_BPS = 600n;
/** Wide enough to fill on a gap, narrow enough to refuse a broken book. */
const SLIPPAGE_BPS = 500;

let started = false;
let peak = 0n;
let stoppedOut = false;

function allIn(state: { cash: bigint; equity: bigint; hello: { caps: { max_weight_bps: number } } }): bigint {
  const byWeight = (BigInt(state.hello.caps.max_weight_bps) * state.equity) / BPS;
  return state.cash < byWeight ? state.cash : byWeight;
}

await runBars({
  onBatch(state) {
    const symbol = state.hello.symbols[0]?.symbol;
    if (symbol === undefined || state.warmingUp) return [];
    const close = state.close(symbol);
    if (close === null) return [];

    if (!started) {
      started = true;
      peak = close;
      const notional = allIn(state);
      if (notional < BigInt(state.hello.fees.min_notional_quote_units)) return [];
      return [{ side: 'buy', symbol, notional_quote_units: notional, max_slippage_bps: SLIPPAGE_BPS }];
    }

    if (close > peak) peak = close;

    const held = state.positions.get(symbol);
    if (held !== undefined) {
      if (close * BPS <= peak * (BPS - STOP_BPS)) {
        stoppedOut = true;
        return [{ side: 'sell', symbol, qty: held.qty, max_slippage_bps: SLIPPAGE_BPS } satisfies SellInput];
      }
      return [];
    }

    // Flat after a stop: wait for the price to clear the peak that stopped it out.
    if (!stoppedOut || close <= peak) return [];
    const notional = allIn(state);
    if (notional < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    stoppedOut = false;
    return [{ side: 'buy', symbol, notional_quote_units: notional, max_slippage_bps: SLIPPAGE_BPS } satisfies BuyInput];
  },
});
