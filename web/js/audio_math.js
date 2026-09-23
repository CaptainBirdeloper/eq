/**
 * PulseEQ - Audio DSP & Frequency Response Mathematics
 * Calculates parametric peaking biquad filter transfer functions in dB.
 */

import { state } from "./state.js";

/**
 * Calculates the composite frequency response in dB at frequency f (Hz).
 * Sums the master preamp gain and all active parametric peaking filters.
 */
export function calculateResponseAtFreq(f, eqState = state) {
  if (eqState.bypass) return 0.0;
  let totalDb = eqState.preamp;

  for (let i = 0; i < eqState.frequencies.length; i++) {
    const f0 = eqState.frequencies[i];
    const gain = eqState.gains[i];
    const Q = eqState.q_factors[i] || 1.41;
    if (Math.abs(gain) < 0.05) continue;

    // Peaking filter bell curve response formula
    const ratio = (f / f0) - (f0 / f);
    const delta = gain / (1.0 + Math.pow(Q * ratio, 2));
    totalDb += delta;
  }
  return totalDb;
}

/**
 * Calculates single-band filter curve delta at frequency f (Hz).
 */
export function calculateBandDelta(f, f0, gain, Q = 1.41) {
  if (Math.abs(gain) < 0.05) return 0.0;
  const ratio = (f / f0) - (f0 / f);
  return gain / (1.0 + Math.pow(Q * ratio, 2));
}
