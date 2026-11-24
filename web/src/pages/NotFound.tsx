import { useMeta } from '../lib/meta';
import { Button } from '../components/ui';
import { PixelField } from '../components/pixel';
import './notfound.css';

export function NotFound() {
  useMeta('Not found · Quintel', 'This future didn’t happen.', { noindex: true });
  return (
    <div className="page">
      <div className="wrap notfound">
        <div className="notfound-field"><PixelField kept={0.5} n={24} animate={false} label="A grid of pixels, half kept and half lost" /></div>
        <h1>This future didn’t happen.</h1>
        <Button href="/">Back to home</Button>
      </div>
    </div>
  );
}
