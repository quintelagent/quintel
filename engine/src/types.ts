export type ModelId = 'gbm' | 'jump' | 'bootstrap' | 'garch' | 'meanrev';

export interface Shock {
  /** Total extra log-drift applied over one month (e.g. -0.10 ≈ -10%). */
  drift: number;
  /** Multiplier on jump intensity (1 = none). */
  jumpMult: number;
  /** Multiplier on volatility (1 = none). */
  volMult: number;
}

export interface EngineInputs {
  version: 1;
  /** ISO timestamp of the run. */
  asOf: string;
  /** Price the scenarios start from. */
  spot: number;
  /** Where spot came from. */
  priceSource: 'stock' | 'chain' | 'last_close';
  /** Daily closes, oldest first (≥ 260 recommended). */
  closes: number[];
  /** Optional annualised realised vol from intraday data. */
  intradayVol?: number;
  /** 0–1 from the research agent's news triage. */
  newsIntensity: number;
  /** Reference "pre-crisis" level for P(back above). */
  preCrisisLevel: number;
  /** (chain token − stock) / stock, 0 if unknown. */
  tokenPremium: number;
  /** Hypothetical shock (what-if tool). Absent for official runs. */
  shock?: Shock;
}

export interface Percentiles {
  p1: number; p5: number; p10: number; p25: number; p50: number;
  p75: number; p90: number; p95: number; p99: number;
}

export interface Histogram {
  lo: number;
  hi: number;
  counts: number[];
}

export interface HorizonStats {
  days: number;
  mean: number;
  pct: Percentiles;
  hist: Histogram;
}

export interface ModelOut {
  id: ModelId;
  paths: number;
  horizons: HorizonStats[];
  pUp1m: number;
}

export interface HorizonProbs {
  days: number;
  pUp: number;
  pDown10: number;
  pDown20: number;
  pAbovePreCrisis: number;
  /** P(price below grid.levels[i]) */
  below: number[];
}

export interface CrisisOut {
  level: number;
  components: { vol: number; tail: number; news: number; chain: number };
  weights: { vol: number; tail: number; news: number; chain: number };
}

export interface Calibration {
  mu: number;
  /** what-if multipliers (1 / 0 for official runs) */
  volMult: number;
  driftShockDaily: number;
  /** log of the 50-day simple moving average */
  logMa: number;
  sigma: number;
  annVol: number;
  volRatio: number;
  jump: { lambda: number; muJ: number; sdJ: number; sigmaD: number };
  garch: { omega: number; alpha: number; beta: number; h0: number };
  ou: { phi: number; sigma: number; maWindow: number; d0: number };
}

export interface RunOutput {
  version: 1;
  seed: string;
  inputHash: string;
  spot: number;
  horizons: number[];
  pathsPerModel: number;
  totalPaths: number;
  calib: Calibration;
  models: ModelOut[];
  combined: {
    horizons: HorizonStats[];
    probs: HorizonProbs[];
    grid: number[];
    expMaxDrawdown1m: number;
    var95_1m: number;
  };
  agreement: number;
  crisis: CrisisOut;
}
