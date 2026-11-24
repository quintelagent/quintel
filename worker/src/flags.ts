import { flagOn } from '../../web/src/features';
import type { Env } from './config';

/** Same registry as the site. `PREVIEW_FLAGS` exists only in preview and local configs, never in production. */
export const workerFlag = (env: Pick<Env, 'PREVIEW_FLAGS'>, flag: string) => flagOn(flag) || (env.PREVIEW_FLAGS ?? '').split(',').includes(flag);
