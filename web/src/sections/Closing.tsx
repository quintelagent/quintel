import { Button, Section } from '../components/ui';
import './closing.css';

export function Closing() {
  return (
    <Section className="closing" title="1,000,000 futures. Every 10 minutes.">
      <div className="closing-actions"><Button href="/#position">Check my position</Button><Button href="/docs" variant="secondary">Read the docs</Button></div>
    </Section>
  );
}
