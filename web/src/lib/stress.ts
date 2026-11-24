/** Display labels for the Stress Level (docs/METHODOLOGY.md). Not used by any rule. */
export const stressLabel = (v: number) => (v <= 33 ? 'Calm' : v <= 66 ? 'Elevated' : 'High');
