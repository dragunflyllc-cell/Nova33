# Tradeify NQ Opening-Range Breakout Strategy

Pine Script v6 strategy for trading NQ (or MNQ) on TradingView, built around
a Tradeify **Lightning Funded $150K** account. File: `tradeify-nq-orb-strategy.pine`.

## Before you risk real money on this: verify the numbers

I could not reach `help.tradeify.co` directly from this environment (network
policy blocked it), so the rule numbers below are pieced together from
third-party review sites, not Tradeify's own docs. Prop firms revise these
regularly — one source I found even referenced a mid-cycle change for
purchases "before/after March 31." **Open your actual Tradeify Funded
Trader Agreement / dashboard and confirm every number in the "Tradeify
Lightning $150K Rules" input group before running this live:**

| Parameter | Value used here | Confidence |
|---|---|---|
| Daily Loss Limit | $3,750 | Medium — consistent across multiple sources |
| EOD Trailing Max Drawdown | $6,000 | Medium — one conflicting source said $5,000 |
| Drawdown basis | End-of-day balance, not intraday equity | Medium |
| Floor locks at breakeven | Left **off** (conservative default) | Low — unconfirmed for Lightning specifically |
| Max contracts | 3 minis (input, override freely) | Low — position caps were unclear from public sources |
| Consistency rule | Progressive 20% / 25% / 30% per payout | Medium |

All of these are `input()` fields at the top of the script — update them
in one place, they're not hard-coded anywhere else in the logic.

## Strategy logic

**Opening Range Breakout (ORB)** on NQ, with an ATR-scaled stop/target and a
daily trend filter. This is the same family of strategy studied in Zarattini
& Aziz's *"Can Day Trading Really Be Profitable?"* (SSRN, 2023), which
backtested 5-minute ORB with ATR-based stops on TQQQ (3x leveraged Nasdaq-100
ETF) and found a statistically significant edge over a multi-year sample.
Two important caveats on that paper: it's one historical sample on a
leveraged ETF, not NQ futures, and "statistically significant edge in a
backtest" is not a promise of forward performance — no such promise exists
in trading, from me or anyone else.

- Trades the breakout of the first 15 minutes after the open (`0930-0945`
  ET) and, optionally, a second range after the early-afternoon lull
  (`1330-1345` ET) — two shots a day at hitting your weekly number instead
  of one.
- Only trades in the direction of the prior day's close vs. its 20-day SMA
  (toggle-able). This is what keeps win rate defensible above 50%: it skips
  counter-trend breakouts, which is where most ORB false-breakout losses
  come from.
- Stop = 0.40x daily ATR, target = 0.55x daily ATR by default — target
  deliberately kept near or below the stop distance, because a tight target
  is what makes win rate > 50% achievable at all for a breakout system.
  Widening the target buys a bigger payoff at the cost of win rate; that's
  a real tradeoff, not a free upgrade, so backtest before changing it.
- Forces flat before the close (`1550-1600` ET window) — no overnight risk.

## Risk wrapper (the part that actually protects the funded account)

- Position size is calculated from **distance to your trailing-drawdown
  floor** and **today's remaining daily-loss budget** — not from the
  headline $150,000 balance. That distance is the only capital you can
  actually afford to lose; sizing off the full balance is the single most
  common way funded accounts get blown.
- Hard daily-loss and trailing-drawdown gates flatten everything and stop
  new entries the moment either is breached, with a configurable safety
  buffer *before* the real limit (defaults: stop $250 short of the DLL,
  $300 above the trailing floor) so slippage on the exit doesn't blow
  through the actual rule.
- Weekly goal tracking: once weekly P&L hits your target (default $1,000),
  you can choose to do nothing, halve size, or stop trading for the week —
  configurable, because "stop as soon as you've made your number" is a
  legitimate way to protect a payout, but it's your call, not mine.
- A consistency-rule dashboard flags if one day is eating too much of the
  week's profit (default warning at 30%) — informational only. A strategy
  cannot ethically or mechanically refuse to take a winning trade because
  of a payout consistency rule; it can only warn you.

## Honest limits of what this can promise

- **No strategy can guarantee a win rate, a weekly dollar target, and a
  minimum drawdown simultaneously.** Those are three separate outcomes of
  the same distribution of trades — you can bias toward one (e.g., tighter
  targets raise win rate) but not lock in all three by design.
- This script never talks to Tradeify or your broker. It manages a
  simulated position inside TradingView. Every order fire includes an
  `alert_message` JSON payload (`action`, `symbol`, `qty`, `trigger`,
  `stop_loss_pts`, `target_pts`) so you can wire it into a webhook relay to
  your actual execution platform (e.g. Tradovate) if you want semi-auto
  execution — set up one alert on the script with condition "Order fills"
  or "Any alert() function call" to fire on every entry/exit/flatten.
- I have no way to run TradingView's Pine compiler or Strategy Tester from
  here. I reviewed the logic line-by-line for correctness, but you must
  paste this into TradingView, confirm it compiles, and run it in
  **Strategy Tester** (and then paper-trade it) before it ever touches a
  funded account. Backtest results won't match live results exactly —
  fills, slippage, and commission are all approximations.

## Suggested workflow

1. Paste into TradingView Pine Editor on an `NQ1!` or `MNQ1!` chart, 1-5 min
   timeframe. Fix any compile errors TradingView flags (I can't compile
   Pine here, so treat this as a careful draft, not a guaranteed-clean
   build).
2. Confirm every number in the Tradeify Lightning $150K Rules input group
   against your actual account agreement.
3. Run Strategy Tester over at least 1-2 years of NQ data. Check win rate,
   max drawdown, and average trades/week against your $1k/week goal — tune
   `stopAtrMult`/`targetAtrMult`/`riskPctOfBuffer` from there.
4. Paper trade (or trade a demo/eval account) for a few weeks before
   pointing it at a live funded account, even semi-automated.
