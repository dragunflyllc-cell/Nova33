# Tradeify NQ Opening-Range Breakout Strategy

Pine Script v6 strategy for trading NQ (or MNQ) on TradingView, built around
a Tradeify **Lightning Funded $150K** account. File: `tradeify-nq-orb-strategy.pine`.

**Run this on a 5-minute chart.** A real 1-year backtest on a 1-minute
chart came back net-negative (-1.44%) despite the underlying market rallying
19.6% over the same period and the trend filter correctly going long 71/80
trades — average winners ($173) were smaller than average losers ($248)
because the channel lookback was reacting to 1-minute noise instead of real
range structure. `channelMinutes`/`cooldownMinutes` are now specified in
minutes and converted to bars for whatever timeframe you're on, so this
can't silently break again the same way — but 5-minute is still the
recommended chart for meaningful breakout structure vs. noise.

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

- **Trade mode (input): "Continuous Range Breakout" (default) vs "Opening
  Range Breakout (2x/day)".** The original design only traded two fixed
  15-minute windows a day and, in practice, that starved it of opportunities
  (one trade in 90 days in testing). The default is now a rolling channel
  breakout (`channelMinutes`, default 60 real minutes, converted to bars for
  your chart's timeframe) that re-arms itself all session long: after each
  trade closes and a cooldown (`cooldownMinutes`, default 30) passes, it
  re-quotes a fresh breakout level off the trailing high/low and waits for
  the next one. Same lineage as the old Turtle Trading Donchian-channel
  system. The old fixed-window ORB mode is still available as a toggle if
  you want to compare the two in Strategy Tester.
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

## Win rate vs. profitability (read this before judging the stats)

Continuous mode no longer targets >50% win rate — that constraint was
dropped deliberately. A fixed small target on a trend-following breakout
system is the worst of both worlds: full-size stop losses on every false
breakout (most of them), and winners capped before they can pay for those
losses. Continuous mode now uses a **hard stop + trailing exit**
(`trailActivateAtrMult`/`trailOffsetAtrMult`) instead of a fixed target, so
a real trend can run 2x, 3x, 5x+ the stop distance instead of being capped
at 0.55x ATR. Expect:

- Win rate in the 30-40% range, sometimes lower. This is normal for
  trend-following systems and not itself a sign something's broken.
- Profitability driven by profit factor / average-win-to-average-loss
  ratio, not win percentage. Judge Strategy Tester by **net profit,
  profit factor, and max drawdown** — not by the win-rate number.
- The **"Opening Range Breakout (2x/day)"** mode (fixed target, kept as a
  toggle) is the one still aimed at >50% win rate, at the cost of firing
  far less often. Pick one philosophy per backtest run — trying to hit
  high win rate AND high frequency AND big trend-following payoffs
  simultaneously isn't a parameter tune, it's three different strategies.

## Trade frequency vs. instrument choice

If you're seeing very few trades even in Continuous mode, check the
dashboard's **"Next size (contracts)"** row first — it's almost always
sizing, not the entry logic. Position size is computed from your
distance-to-drawdown-floor and remaining daily-loss budget, not the $150K
balance. On **NQ1!** (full-size, $20/point), a typical ATR-scaled stop costs
$2,000-3,000 per contract to risk — close to the entire $3,750 daily loss
limit — so the sizing math correctly rounds down to 0 contracts most days.
**Trade MNQ1!** (Micro E-mini, $2/point, 1/10th the size) instead; the same
risk budget then produces 1-3+ contracts. This isn't a bug, it's the sizing
discipline doing its job — full-size NQ is structurally the wrong instrument
for granular, risk-managed sizing on a $150K account with a $3,750 DLL.

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

1. Paste into TradingView Pine Editor on an `MNQ1!` chart, **5-minute**
   timeframe (see the note at the top of this file on why 1-minute produced
   a losing backtest). Fix any compile errors TradingView flags (I can't
   compile Pine here, so treat this as a careful draft, not a
   guaranteed-clean build).
2. Confirm every number in the Tradeify Lightning $150K Rules input group
   against your actual account agreement.
3. Run Strategy Tester over at least 1-2 years of data. Check net profit,
   profit factor, and max drawdown first — win rate only matters relative
   to average-win/average-loss, not on its own. Tune
   `stopAtrMult`/`trailActivateAtrMult`/`trailOffsetAtrMult`/`riskPctOfBuffer`
   from there.
4. Paper trade (or trade a demo/eval account) for a few weeks before
   pointing it at a live funded account, even semi-automated.

## Change log (what's been tried and why)

For continuity across sessions — three real backtests have driven this
design so far:

1. **Fixed two-window ORB, full-size NQ1!**: 0-1 trades in 90 days.
   Diagnosed as position sizing rounding to 0 contracts — NQ1!'s $20/point
   value makes a full contract's risk close to the entire daily loss limit.
   Fix: switched to MNQ1! ($2/point).
2. **Continuous mode added, fixed 0.55x ATR target, 1-minute chart,
   12-bar/6-bar channel+cooldown**: still too few trades reported.
3. **Real 1-year backtest, MNQ1!, 1-minute chart** (the first data actually
   seen): 80 trades, 52.5% win rate, but net -$2,158 (-1.44%) against a
   +19.6% buy-and-hold — avg win $173 < avg loss $248. Diagnosed as the
   12-minute channel lookback being pure 1-minute noise, causing shallow
   trailing-stop exits instead of real trend capture. Fix: made
   `channelMinutes`/`cooldownMinutes` timeframe-independent (converted to
   bars at run time) and recommended 5-minute chart.

Next real backtest should confirm whether the 5-minute / minutes-based fix
actually restores the intended "big winners pay for many small losses"
trend-following shape — until then, treat the profit-factor/avg-win-loss
numbers as unresolved, not fixed.
