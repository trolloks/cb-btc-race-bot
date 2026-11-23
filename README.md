# cb-btc-race-bot

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/trolloks/cb-btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/trolloks/cb-btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

A long-only cbBTC paper-trading bot that waits for a 0.5% dip (or 30 minutes) and then stages a full-size entry and exit across twelve bar opens to cut pool impact, holds through the day, and steps aside on a 3% fall from its peak.

## How it works

The harness sends one `hello`, then one `batch` per minute `bar` with the latest price and fills. The bot answers each batch with at most one order: it waits for a 0.5% dip from the day's high, or 30 minutes, then buys a twelfth of its cash per bar over the next twelve bars, holds, and sells a twelfth per bar over the last twelve. Each bar's pool starts from its own open depth, so the slices pay about a twelfth of the price impact of one full-size order. It tracks the highest close and sells in two parts when the close is 3% under that peak; it stays in cash until a close clears the old peak, then buys back in. Integer arithmetic only, so two runs reply with the same orders.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=22pw7tmq&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards</sub>
