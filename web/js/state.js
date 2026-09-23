/**
 * PulseEQ - Application State & Coordinate Utilities
 * Centralized state store, frequency/dB coordinate mapping, and accessibility helpers.
 */

export const state = {
  frequencies: [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
  gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  q_factors: [1.41, 1.41, 1.41, 1.41, 1.41, 1.41, 1.41, 1.41, 1.41, 1.41],
  preamp: 0.0,
  bypass: false,
  active_preset: "Flat",
  presets: {},
  apo_installed: false,
  apo_config_path: "",
  selected_band: 3, // Default Band 4 (1 kHz)
  q_scroll_locked: typeof localStorage !== "undefined" && localStorage.getItem("pulse_eq_q_scroll_locked") === "true"
};

export const interaction = {
  isDragging: false,
  draggedBandIdx: -1,
  hoveredBandIdx: -1
};

export const viewDimensions = {
  width: 800,
  height: 400
};

export function setViewDimensions(w, h) {
  viewDimensions.width = w;
  viewDimensions.height = h;
}

export const MARGIN = { top: 24, right: 0, bottom: 28, left: 0 };
export const MIN_FREQ = 20;
export const MAX_FREQ = 20000;
export const MIN_DB = -18;
export const MAX_DB = 18;

// Coordinate Conversion
export function freqToX(f, width = viewDimensions.width) {
  const ratio = (Math.log10(f) - Math.log10(MIN_FREQ)) / (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ));
  return Math.max(0, Math.min(width, ratio * width));
}

export function xToFreq(x, width = viewDimensions.width) {
  const ratio = Math.max(0, Math.min(1, x / width));
  return Math.pow(10, Math.log10(MIN_FREQ) + ratio * (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ)));
}

export function dbToY(db, height = viewDimensions.height) {
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const clamped = Math.max(MIN_DB, Math.min(MAX_DB, db));
  const ratio = (MAX_DB - clamped) / (MAX_DB - MIN_DB);
  return MARGIN.top + ratio * plotHeight;
}

export function yToDb(y, height = viewDimensions.height) {
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const ratio = Math.max(0, Math.min(1, (y - MARGIN.top) / plotHeight));
  return MAX_DB - ratio * (MAX_DB - MIN_DB);
}

export function formatFreq(f) {
  if (f >= 1000) {
    const val = f / 1000;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + "k";
  }
  return Math.round(f).toString();
}

export function formatDb(db) {
  const num = Number(db);
  return (num > 0 ? "+" : "") + num.toFixed(1) + " dB";
}

export function announce(msg) {
  const liveAnnouncer = document.getElementById("live-announcer");
  if (liveAnnouncer) {
    liveAnnouncer.textContent = msg;
  }
}
