# cb-btc-race-bot

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/trolloks/cb-btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/trolloks/cb-btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

A long-only cbBTC paper-trading bot that waits for a washout bar (or 90 minutes) and then stages a full-size entry over twelve bars and an exit over eight to cut pool impact, holds through the day, and steps aside on a 3.5% fall from its peak.

## How it works

The harness sends one `hello`, then one `batch` per minute `bar` with the latest price and fills. The bot answers each batch with at most one order: it waits for a bar whose low is 0.5% under the day's high and whose close is in the bottom 30% of its range, or 90 minutes, then buys a twelfth of its cash per bar over the next twelve bars, holds, and sells an eighth per bar over the last eight. Each bar's pool starts from its own open depth, so the entry slices pay about a twelfth of the price impact of one full-size order. It tracks the highest close and sells in two parts when the close is 3.5% under that peak; it stays in cash until a close clears the old peak, then buys back in. Integer arithmetic only, so two runs reply with the same orders.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=22pw7tmq&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards</sub>
