// Everything below the first tool, split into its own chunk and fetched when the page is idle.
import { WhatIf } from './WhatIf';
import { Briefing } from './Briefing';
import { Models } from './Models';
import { Desk } from './Desk';
import { Proof } from './Proof';
import { HowItWorks } from './HowItWorks';
import { Token } from './Token';
import { FAQ } from './FAQ';

export default function Below() {
  return (
    <>
      <WhatIf />
      <Briefing />
      <Models />
      <Desk />
      <Proof />
      <HowItWorks />
      <Token />
      <FAQ />
    </>
  );
}
