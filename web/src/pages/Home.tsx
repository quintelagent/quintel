import { useMeta } from '../lib/meta';
import { Hero } from '../sections/Hero';
import { StatsStrip } from '../sections/StatsStrip';
import { WallStreet } from '../sections/WallStreet';
import { Tool } from '../sections/Tool';
import { Events } from '../sections/Events';
import { BriefingFeed } from '../sections/BriefingFeed';
import { Models } from '../sections/Models';
import { Desk } from '../sections/Desk';
import { Proof } from '../sections/Proof';
import { Token } from '../sections/Token';
import { Faq } from '../sections/Faq';
import { Closing } from '../sections/Closing';

export function Home() {
  useMeta('Quintel · Does it hold? Live scenario odds', 'Five models simulate 1,000,000 futures and publish scenario odds in plain English. Every run can be checked.');
  return (
    <>
      <Hero /><StatsStrip /><WallStreet /><Tool /><Events /><BriefingFeed /><Models /><Desk /><Proof /><Token /><Faq /><Closing />
    </>
  );
}
