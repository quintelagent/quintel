import launch from '../../../launch.json';

/** The official token values (launch.json is the only source). */
export const CA: string | null = launch.ca;
export const PUMP_MINT: string | null = launch.pumpMint;
export const PONS_URL = CA ? `https://ponsfamily.com/launchpad/${CA}` : null;
export const PUMP_URL = PUMP_MINT ? `https://pump.fun/coin/${PUMP_MINT}` : null;
export const EXPLORER_URL = CA ? `https://robinhoodchain.blockscout.com/token/${CA}` : null;
export const BURN_TX: string | null = launch.devBuyBurnTx;
