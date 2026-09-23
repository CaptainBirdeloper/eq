/**
 * PulseEQ - Fairlight Canvas Rendering Engine (AMOLED Black & White Edition)
 * High-DPI buffer scaling, pure monochrome grid, high-contrast response curve,
 * and big rounded draggable nodes.
 */

import {
  state,
  interaction,
  viewDimensions,
  setViewDimensions,
  MARGIN,
  MIN_FREQ,
  MAX_FREQ,
  freqToX,
  xToFreq,
  dbToY,
  formatFreq,
  formatDb
} from "./state.js";
import { calculateResponseAtFreq } from "./audio_math.js";

let canvas = null;
let ctx = null;
let graphViewport = null;
let tooltip = null;
let hudBandTitle = null;
let hudFreq = null;
let hudGain = null;
let hudQ = null;

export function initCanvasView(elements) {
  canvas = elements.canvas;
  ctx = canvas.getContext("2d");
  graphViewport = elements.graphViewport;
  tooltip = elements.tooltip;
  hudBandTitle = elements.hudBandTitle;
  hudFreq = elements.hudFreq;
  hudGain = elements.hudGain;
  hudQ = elements.hudQ;

  window.addEventListener("resize", resizeCanvas);
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(graphViewport);
  }

  resizeCanvas();
}

export function resizeCanvas() {
  if (!canvas || !graphViewport) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  setViewDimensions(rect.width, rect.height);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(viewDimensions.width * dpr);
  canvas.height = Math.round(viewDimensions.height * dpr);
  ctx.resetTransform();
  ctx.scale(dpr, dpr);
  drawFairlightGraph();
}

export function drawFairlightGraph() {
  if (!ctx) return;
  const width = viewDimensions.width;
  const height = viewDimensions.height;

  // 1. Pure AMOLED Black Background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  // 2. Horizontal dB Grid Lines (Edge-to-Edge)
  const dbTicks = [15, 10, 5, 0, -5, -10, -15];
  dbTicks.forEach(db => {
    const y = dbToY(db, height);
    ctx.beginPath();
    ctx.strokeStyle = db === 0 ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = db === 0 ? 1.5 : 1;
    if (db === 0) {
      ctx.setLineDash([5, 5]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    // dB label placed on inside right edge
    ctx.fillStyle = db === 0 ? "#ffffff" : "rgba(255, 255, 255, 0.5)";
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText((db > 0 ? "+" : "") + db + " dB", width - 10, y - 4);
  });
  ctx.setLineDash([]);

  // 3. Vertical Frequency Grid Lines (Edge-to-Edge)
  const freqTicks = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  freqTicks.forEach(f => {
    const x = freqToX(f, width);
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    // Frequency label on bottom margin
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(formatFreq(f), x, height - 10);
  });

  // 4. Composite EQ Response Curve (Continuous Edge-to-Edge from x = 0 to x = width)
  const points = [];
  const steps = Math.max(160, Math.ceil(width / 3));
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const f = xToFreq(x, width);
    const db = calculateResponseAtFreq(f, state);
    const y = dbToY(db, height);
    points.push({ x, y });
  }

  // Gradient fill under curve (Edge-to-Edge, zero vertical cutoffs)
  if (!state.bypass) {
    const fillGradient = ctx.createLinearGradient(0, MARGIN.top, 0, height - MARGIN.bottom);
    fillGradient.addColorStop(0, "rgba(255, 255, 255, 0.16)");
    fillGradient.addColorStop(0.6, "rgba(255, 255, 255, 0.03)");
    fillGradient.addColorStop(1, "rgba(0, 0, 0, 0.0)");

    ctx.beginPath();
    ctx.moveTo(0, dbToY(0, height));
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(width, dbToY(0, height));
    ctx.closePath();
    ctx.fillStyle = fillGradient;
    ctx.fill();
  }

  // Curve stroke (Edge-to-Edge)
  ctx.beginPath();
  points.forEach((p, idx) => {
    if (idx === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = state.bypass ? "#525252" : "#ffffff";
  ctx.lineWidth = state.bypass ? 2 : 3.5;
  ctx.stroke();

  // 5. Big Rounded Draggable Nodes
  state.frequencies.forEach((f, idx) => {
    const gain = state.gains[idx];
    const totalDb = state.bypass ? 0 : (gain + state.preamp);
    const x = freqToX(f, width);
    const y = dbToY(totalDb, height);

    const isHovered = (idx === interaction.hoveredBandIdx);
    const isSelected = (idx === state.selected_band);
    const isDragged = (idx === interaction.draggedBandIdx);

    const radius = (isHovered || isDragged || isSelected) ? 15 : 13;

    // Halo for selected/hovered node
    if (isSelected || isHovered || isDragged) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.fill();
    }

    // Outer circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? "#ffffff" : "#000000";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = state.bypass ? "#525252" : "#ffffff";
    ctx.stroke();

    // Band number inside handle
    ctx.fillStyle = isSelected ? "#000000" : (state.bypass ? "#737373" : "#ffffff");
    ctx.font = `bold ${radius > 13 ? '11px' : '10px'} 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((idx + 1).toString(), x, y);
  });
}

export function hitTestHandle(mx, my) {
  for (let i = 0; i < state.frequencies.length; i++) {
    const f = state.frequencies[i];
    const gain = state.gains[i];
    const totalDb = state.bypass ? 0 : (gain + state.preamp);
    const hx = freqToX(f, viewDimensions.width);
    const hy = dbToY(totalDb, viewDimensions.height);

    const dist = Math.hypot(mx - hx, my - hy);
    if (dist <= 26) { // 26px generous hit radius
      return i;
    }
  }
  return -1;
}

export function showTooltip(x, y, idx) {
  if (!tooltip || !hudBandTitle) return;
  hudBandTitle.textContent = `BAND ${idx + 1}`;
  hudFreq.textContent = `${Math.round(state.frequencies[idx])} Hz`;
  hudGain.textContent = formatDb(state.gains[idx]);
  hudQ.textContent = `Q: ${(state.q_factors[idx] || 1.41).toFixed(2)}`;

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
  tooltip.classList.remove("hidden");
}

export function hideTooltip() {
  if (tooltip) {
    tooltip.classList.add("hidden");
  }
}
