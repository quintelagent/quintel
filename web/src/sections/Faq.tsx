import { Accordion, Section } from '../components/ui';
import { Link } from '../lib/router';
import { DEFAULT_SYMBOL } from '../lib/symbols';
import './faq.css';

export function Faq({ symbol = DEFAULT_SYMBOL }: { symbol?: string }) {
  const items = [
    { q: 'What is Quintel?', a: `Quintel is a live scenario engine for ${symbol} stock. Five models simulate 1,000,000 price paths every 10 minutes while the market is open and every 30 minutes while it is closed. Those paths become scenario odds, and a research agent explains what changed.` },
    { q: 'Are these predictions?', a: <>No. They are scenario odds: the share of simulated paths where something happens. 38% means 38% of the simulated paths, not a 38% chance in any objective sense. The full list of what the models leave out is in <Link href="/docs/limits">Limits</Link>.</> },
    { q: 'Where does the price come from?', a: <>While the market is open, from the stock quote. While it is closed, from the on-chain token: a Uniswap V3 pool on Robinhood Chain, cross-checked against Chainlink. If the token price is unavailable or out of line, the last close is used. If neither price can be read, the run starts from the last daily close and records that source. Details are in <Link href="/docs/methodology">Methodology</Link>.</> },
    { q: 'How can I check a run?', a: <>Open <Link href="/verify">Verify</Link> and enter a run number, or leave it empty for the latest run. Your browser runs all 1,000,000 paths again from the stored inputs and seed, then compares the hashes. Each hour of runs also gets a fingerprint on Robinhood Chain. The steps are in <Link href="/docs/proof">Proof</Link>.</> },
    { q: 'What does Stress Level mean?', a: 'A score from 0 to 100 built from four public inputs: recent volatility against its 1-year median, the odds of ending a month more than 20% lower, how loud the news is, and the gap between the token and the stock. 0–33 is Calm, 34–66 is Elevated and 67–100 is High.' },
    { q: 'What is the paper desk?', a: 'Paper trading. No real money. A virtual $100,000 follows fixed, public rules: long or flat, filled only while the market is open, with every trade shown. It ignores fees, slippage and taxes.' },
    { q: 'What is $QNTL for?', a: <>Holding it is for Pro features, and burning it is for requesting a custom run. <Link href="/status">Status</Link> shows what is live and what is next. The coin does not change the odds, and holding it is not a share of anything.</> },
    { q: 'Is this advice?', a: 'No. Scenario odds describe what the models produce from past prices and current inputs. Nothing on this site is a recommendation.' },
  ];
  return <Section id="faq" title="What people ask first."><div className="faq-list"><Accordion items={items} /></div></Section>;
}
