# L-vs-Y: Pension Strategy Simulator

A Monte Carlo web application simulator designed to project and compare the expected net worth and survivability of taking a massive **Lump Sum Pension** upfront versus receiving a **Yearly Payout** over time. 

Built with vanilla Javascript and Chart.js, the application runs 10,000 independent mathematical lifetimes to calculate percentiles, distribution densities, and risk of ruin arrays under turbulent market conditions.

---

## ⚙️ Methodology & Assumptions

This application replaces basic compound interest calculators by utilizing stochastic modeling. Expected market returns are never flat; this app randomizes the return of every single year to accurately simulate the psychological and financial impact of Sequence of Returns Risk.

### 1. Engine Methodology: Monte Carlo Simulation
The underlying engine runs **10,000 completely independent lifetimes (passes)** per strategy. For a 30-year expected span, that equates to drawing 300,000 randomized market events.
* **The Math:** To simulate realistic stock market jitter, the engine uses the **Box-Muller Transform**. This geometry algorithm generates normally distributed random numbers (a classic Bell Curve) scaling tightly around your `Expected Return Rate` and stretched by your `Market Volatility` (Standard Deviation).
* **The Purpose:** If the first 3 years of your retirement crash by -20% while you are actively withdrawing cash to survive, your portfolio could collapse completely even if the aggregate 30-year return hits 10%. The Monte Carlo realistically punishes or rewards you strictly based on the volatility timing.

### 2. The 6.5% Return and 9.0% Volatility Default Parameters
The default parameters mirror a foundational **"Balanced Retirement Portfolio"**, widely recognized in classical finance as **60% Diversified Stocks and 40% Bonds (60/40)**.

* **Expected Nominal Return (6.5%):** Historic data stretching back almost a century indicates that a broad 60/40 allocation averages roughly a 6.5% - 7.5% nominal return.
* **Volatility / Risk (9.0%):** The pure S&P 500 historic standard deviation is wildly aggressive (roughly ~15.5%). Because 40% of the simulated portfolio is stored in highly stable, low-yield assets (Bonds, Treasuries), the systemic stock market standard deviation is heavily anchored down. A standard 60/40 profile historically absorbs shocks with only a ~9.0% standard deviation.

### 3. Calculating Inflation anchor (2.5%)
Inflation is actively programmed to geometrically compound mathematically against your `Yearly Spending` slider out into the future. 

* Fiat central banks (like the US Federal Reserve or European Central Bank) operate on a strictly mandated target inflation rate of **2.0%**. 
* However, given inevitable fiscal crises, supply chain shock events, and massive monetary quantitative easing, hitting exactly 2.0% is practically impossible. Modern macro-historic averages naturally float between `2.3%` to `3.2%`. Setting the app default to **2.5%** enforces a highly realistic, slightly conservative "cost-of-living drag" over decades.

> **💡 Note on The "4% Rule"**
> Because your `Expected Return Rate` (6.5%) behaves strictly as a Nominal stock return, and `Inflation` (2.5%) is calculated separately actively against your spending base, your true underlying **Real Return** in this simulator operates heavily anchored at approximately **4.0%**. This purposefully matches the famous "4% Rule" (William Bengen's Safe Withdrawal Rate) used across all modern Financial Independence planning.

### 4. Apples to Apples Breakdown
The two distinct strategies algorithmically pitch sequence risk against capital efficiency:

* **Strategy A (Lump Sum Upfront):** 
Taking 7 years of pension all at once locks in massive compounding potential off the bat. It leverages heavy capital early. However, it takes all the risk. If the early sequence of returns is devastating, the compounding spending withdrawals will cannibalize the base principle immediately into the ground.
* **Strategy B (Yearly Pension):**
Taking the pension linearly over time sacrifices aggressive upfront market growth, meaning it rarely hits 95th Percentile extreme lottery wealth. However, the consistent cash flow heavily shields against early stock crashes because the recurrent fresh income reduces or entirely negates your need to intentionally sell stocks at a depressed loss.
