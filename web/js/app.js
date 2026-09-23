/**
 * PulseEQ - Fairlight Studio Equalizer Main Controller
 * Orchestrates canvas rendering, pointer physics, keyboard controls,
 * state synchronization, and Equalizer APO telemetry.
 */

import {
  state,
  interaction,
  viewDimensions,
  xToFreq,
  yToDb,
  formatDb,
  announce
} from "./state.js";

import {
  initCanvasView,
  resizeCanvas,
  drawFairlightGraph,
  hitTestHandle,
  showTooltip,
  hideTooltip
} from "./canvas_view.js";

import { initKeyboardAndSteppers } from "./keyboard.js";

// DOM Element Selection
const elements = {
  canvas: document.getElementById("fairlightCanvas"),
  graphViewport: document.getElementById("graphViewport"),
  tooltip: document.getElementById("handle-tooltip"),
  hudBandTitle: document.getElementById("hud-band-title"),
  hudFreq: document.getElementById("hud-freq"),
  hudGain: document.getElementById("hud-gain"),
  hudQ: document.getElementById("hud-q"),
  liveAnnouncer: document.getElementById("live-announcer"),

  preampFader: document.getElementById("preamp-fader"),
  preampReadout: document.getElementById("preamp-readout"),
  bypassToggle: document.getElementById("bypass-toggle"),
  powerBtnLabel: document.getElementById("power-btn-label"),
  presetsList: document.getElementById("presets-list"),

  inspectorBandNum: document.getElementById("inspector-band-num"),
  inspectorQ: document.getElementById("inspector-q"),
  qDecBtn: document.getElementById("q-dec-btn"),
  qIncBtn: document.getElementById("q-inc-btn"),
  qLockBtn: document.getElementById("q-lock-btn"),

  modalSavePreset: document.getElementById("modal-save-preset"),
  savePresetBtn: document.getElementById("save-preset-btn"),
  modalSaveConfirmBtn: document.getElementById("modal-save-confirm-btn"),
  customPresetNameInput: document.getElementById("custom-preset-name"),
  customPresetDescInput: document.getElementById("custom-preset-desc")
};

let syncTimer = null;

// ==========================================================================
// Network Synchronization (Debounced)
// ==========================================================================

function debouncedSyncBand(idx) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    fetch("/api/band", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        index: idx,
        gain: state.gains[idx],
        freq: state.frequencies[idx],
        q: state.q_factors[idx]
      })
    }).catch(err => console.error("Sync band error:", err));
  }, 20);
}

function debouncedSyncPreamp() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    fetch("/api/preamp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preamp: state.preamp })
    }).catch(err => console.error("Sync preamp error:", err));
  }, 20);
}

function debouncedSyncGlobalQ(q) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    fetch("/api/q", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q })
    }).catch(err => console.error("Sync global Q error:", err));
  }, 20);
}

function syncStateWithServer(data) {
  state.frequencies = data.frequencies || state.frequencies;
  state.gains = data.gains || state.gains;
  state.q_factors = data.q_factors || state.q_factors;
  state.preamp = data.preamp ?? state.preamp;
  state.bypass = data.bypass ?? state.bypass;
  state.active_preset = data.active_preset || state.active_preset;
  state.presets = data.presets || state.presets;
  state.apo_installed = !!data.apo_installed;
  state.apo_config_path = data.apo_config_path || "";

  elements.preampFader.value = state.preamp;
  const pSign = state.preamp > 0 ? "+" : (state.preamp < 0 ? "-" : "");
  elements.preampReadout.innerHTML = `<span class="meter-sign">${pSign}</span><span class="meter-digits">${Math.abs(state.preamp).toFixed(1)}</span>`;
  elements.preampFader.setAttribute("aria-valuenow", state.preamp.toString());
  elements.preampFader.setAttribute("aria-valuetext", formatDb(state.preamp));

  updateBypassVisuals();
  renderPresets();
  updateInspector();
  drawFairlightGraph();
}

// ==========================================================================
// Inspector & Presets UI
// ==========================================================================

function updateInspector() {
  if (elements.inspectorQ) {
    const q = state.q_factors[0] || 1.41;
    elements.inspectorQ.textContent = q.toFixed(2);
  }
}

function renderPresets() {
  elements.presetsList.innerHTML = "";
  const names = Object.keys(state.presets);

  names.forEach(name => {
    const p = state.presets[name];
    const isAct = (state.active_preset === name);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `preset-chip ${isAct ? "active" : ""}`;
    btn.dataset.name = name;
    btn.setAttribute("aria-pressed", isAct ? "true" : "false");

    const span = document.createElement("span");
    span.textContent = name;
    btn.appendChild(span);

    // If custom preset, show accessible delete button
    if (!p.builtin) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn-del-preset";
      delBtn.innerHTML = "&times;";
      delBtn.setAttribute("aria-label", `Delete custom preset ${name}`);
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deletePreset(name);
      });
      btn.appendChild(delBtn);
    }

    btn.addEventListener("click", () => {
      applyPreset(name);
    });

    elements.presetsList.appendChild(btn);
  });
}

function updatePresetChips() {
  const chips = elements.presetsList.querySelectorAll(".preset-chip");
  chips.forEach(chip => {
    const isAct = (chip.dataset.name === state.active_preset);
    if (isAct) {
      chip.classList.add("active");
      chip.setAttribute("aria-pressed", "true");
    } else {
      chip.classList.remove("active");
      chip.setAttribute("aria-pressed", "false");
    }
  });
  if (elements.activePresetName) {
    elements.activePresetName.textContent = state.active_preset;
  }
}

function applyPreset(name) {
  fetch("/api/preset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  })
  .then(res => res.json())
  .then(data => {
    syncStateWithServer(data);
    announce(`Loaded preset: ${name}`);
  })
  .catch(err => console.error("Error applying preset:", err));
}

function deletePreset(name) {
  if (!confirm(`Delete custom preset "${name}"?`)) return;

  fetch("/api/delete-preset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  })
  .then(res => res.json())
  .then(data => {
    syncStateWithServer(data);
    announce(`Deleted preset: ${name}`);
  })
  .catch(err => console.error("Error deleting preset:", err));
}

// ==========================================================================
// Master Power / Bypass & Preamp
// ==========================================================================

function toggleBypass() {
  state.bypass = !state.bypass;
  updateBypassVisuals();
  drawFairlightGraph();
  announce(state.bypass ? "Master Equalizer Bypassed" : "Master Equalizer Active");

  fetch("/api/bypass", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bypass: state.bypass })
  }).catch(err => console.error("Bypass error:", err));
}

function updateBypassVisuals() {
  if (state.bypass) {
    elements.bypassToggle.classList.remove("active");
    elements.bypassToggle.classList.add("bypassed");
    elements.bypassToggle.setAttribute("aria-pressed", "true");
    elements.powerBtnLabel.textContent = "BYPASS";
  } else {
    elements.bypassToggle.classList.remove("bypassed");
    elements.bypassToggle.classList.add("active");
    elements.bypassToggle.setAttribute("aria-pressed", "false");
    elements.powerBtnLabel.textContent = "EQ ACTIVE";
  }
}

function updateQLockVisuals() {
  if (!elements.qLockBtn) return;
  if (state.q_scroll_locked) {
    elements.qLockBtn.classList.add("locked");
    elements.qLockBtn.setAttribute("aria-pressed", "true");
    elements.qLockBtn.setAttribute("title", "Unlock mouse scroll on Q factor (Currently Locked)");
  } else {
    elements.qLockBtn.classList.remove("locked");
    elements.qLockBtn.setAttribute("aria-pressed", "false");
    elements.qLockBtn.setAttribute("title", "Lock mouse scroll on Q factor (Currently Unlocked)");
  }
}

function resetPreamp() {
  state.preamp = 0.0;
  elements.preampFader.value = 0;
  elements.preampReadout.innerHTML = `<span class="meter-sign"></span><span class="meter-digits">0.0</span>`;
  elements.preampFader.setAttribute("aria-valuenow", "0");
  elements.preampFader.setAttribute("aria-valuetext", "0.0 dB");
  drawFairlightGraph();
  debouncedSyncPreamp();
  announce("Master gain reset to 0.0 dB");
}

// ==========================================================================
// Pointer Events (Fairlight Draggable Handles)
// ==========================================================================

function initPointerEvents() {
  const canvas = elements.canvas;

  // Pointer Down: Start Drag
  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = hitTestHandle(mx, my);

    if (hit !== -1) {
      interaction.isDragging = true;
      interaction.draggedBandIdx = hit;
      state.selected_band = hit;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      canvas.style.cursor = "grabbing";
      updateInspector();
      showTooltip(mx, my, hit);
      drawFairlightGraph();
      announce(`Band ${hit + 1} selected: ${Math.round(state.frequencies[hit])} Hz, ${formatDb(state.gains[hit])}`);
    }
  });

  // Pointer Move: Dragging & Hover
  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (interaction.isDragging && interaction.draggedBandIdx !== -1) {
      const idx = interaction.draggedBandIdx;
      // Calculate new Gain from Y
      const newTotalDb = yToDb(my, viewDimensions.height);
      const newGain = Math.max(-15.0, Math.min(15.0, newTotalDb - state.preamp));
      state.gains[idx] = Math.round(newGain * 10) / 10;

      // Calculate new Frequency from X
      const newFreq = xToFreq(mx, viewDimensions.width);
      const minF = idx > 0 ? (state.frequencies[idx - 1] * 1.05) : 22;
      const maxF = idx < state.frequencies.length - 1 ? (state.frequencies[idx + 1] * 0.95) : 19500;
      state.frequencies[idx] = Math.round(Math.max(minF, Math.min(maxF, newFreq)));

      state.active_preset = "Custom";
      updatePresetChips();
      updateInspector();
      showTooltip(mx, my, idx);
      drawFairlightGraph();
      debouncedSyncBand(idx);
      return;
    }

    // Hover detection
    if (mx >= 0 && mx <= viewDimensions.width && my >= 0 && my <= viewDimensions.height) {
      const hit = hitTestHandle(mx, my);
      if (hit !== interaction.hoveredBandIdx) {
        interaction.hoveredBandIdx = hit;
        if (hit !== -1) {
          canvas.style.cursor = "grab";
          showTooltip(mx, my, hit);
        } else {
          canvas.style.cursor = "crosshair";
          hideTooltip();
        }
        drawFairlightGraph();
      } else if (hit !== -1) {
        showTooltip(mx, my, hit);
      }
    } else {
      if (interaction.hoveredBandIdx !== -1) {
        interaction.hoveredBandIdx = -1;
        hideTooltip();
        drawFairlightGraph();
      }
    }
  });

  // Pointer Up: Stop Drag
  canvas.addEventListener("pointerup", (e) => {
    if (interaction.isDragging) {
      interaction.isDragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      canvas.style.cursor = interaction.hoveredBandIdx !== -1 ? "grab" : "crosshair";
      hideTooltip();
      drawFairlightGraph();
    }
  });

  canvas.addEventListener("pointercancel", (e) => {
    if (interaction.isDragging) {
      interaction.isDragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      hideTooltip();
      drawFairlightGraph();
    }
  });

  // Mouse Wheel: Q-Factor adjustment across all points
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (state.q_scroll_locked) {
      return;
    }

    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    const currentQ = state.q_factors[0] || 1.41;
    const newQ = Math.max(0.3, Math.min(8.0, Math.round((currentQ + delta) * 100) / 100));
    for (let i = 0; i < state.q_factors.length; i++) {
      state.q_factors[i] = newQ;
    }

    state.active_preset = "Custom";
    updatePresetChips();
    updateInspector();

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = hitTestHandle(mx, my);
    showTooltip(mx, my, hit !== -1 ? hit : state.selected_band);

    drawFairlightGraph();
    debouncedSyncGlobalQ(newQ);
    announce(`Q factor: ${newQ}`);
  }, { passive: false });

  // Double Click on Canvas: Reset Band to 0 dB
  canvas.addEventListener("dblclick", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = hitTestHandle(mx, my);
    if (hit !== -1) {
      state.gains[hit] = 0.0;
      state.active_preset = "Custom";
      updatePresetChips();
      updateInspector();
      drawFairlightGraph();
      debouncedSyncBand(hit);
      announce(`Band ${hit + 1} reset to 0.0 dB`);
    }
  });
}

// ==========================================================================
// Initialization & Event Binding
// ==========================================================================

function init() {
  initCanvasView(elements);

  initKeyboardAndSteppers(elements, {
    updateInspector,
    updatePresetChips,
    drawFairlightGraph,
    debouncedSyncBand,
    debouncedSyncGlobalQ,
    toggleBypass,
    applyPreset
  });

  initPointerEvents();

  // Preamp Events
  elements.preampFader.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    state.preamp = val;
    state.active_preset = "Custom";
    updatePresetChips();
    const sign = val > 0 ? "+" : (val < 0 ? "-" : "");
    elements.preampReadout.innerHTML = `<span class="meter-sign">${sign}</span><span class="meter-digits">${Math.abs(val).toFixed(1)}</span>`;
    elements.preampFader.setAttribute("aria-valuenow", val.toString());
    elements.preampFader.setAttribute("aria-valuetext", formatDb(val));
    elements.preampReadout.setAttribute("aria-label", `Master Gain: ${formatDb(val)}. Click to reset.`);
    drawFairlightGraph();
    debouncedSyncPreamp();
  });

  elements.preampReadout.addEventListener("click", () => resetPreamp());
  elements.preampReadout.addEventListener("dblclick", () => resetPreamp());
  elements.preampFader.addEventListener("dblclick", () => resetPreamp());

  // Master Bypass Toggle
  elements.bypassToggle.addEventListener("click", toggleBypass);

  // Q Scroll Lock Toggle
  updateQLockVisuals();
  if (elements.qLockBtn) {
    elements.qLockBtn.addEventListener("click", () => {
      state.q_scroll_locked = !state.q_scroll_locked;
      localStorage.setItem("pulse_eq_q_scroll_locked", state.q_scroll_locked.toString());
      updateQLockVisuals();
      announce(state.q_scroll_locked ? "Mouse scroll on Q factor locked" : "Mouse scroll on Q factor unlocked");
    });
  }

  // Modals
  elements.savePresetBtn.addEventListener("click", () => {
    elements.customPresetNameInput.value = "";
    elements.customPresetDescInput.value = "";
    elements.modalSavePreset.classList.remove("hidden");
    elements.customPresetNameInput.focus();
  });

  document.querySelectorAll("[data-close]").forEach(el => {
    el.addEventListener("click", (e) => {
      const targetId = e.currentTarget.getAttribute("data-close");
      document.getElementById(targetId)?.classList.add("hidden");
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      elements.modalSavePreset.classList.add("hidden");
    }
  });

  elements.modalSaveConfirmBtn.addEventListener("click", () => {
    const name = elements.customPresetNameInput.value.trim();
    const desc = elements.customPresetDescInput.value.trim();
    if (!name) return;

    fetch("/api/save-preset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: desc })
    })
    .then(res => res.json())
    .then(data => {
      elements.modalSavePreset.classList.add("hidden");
      syncStateWithServer(data);
      announce(`Saved custom preset: ${name}`);
    });
  });

  // Initial State Fetch
  fetch("/api/state")
    .then(res => res.json())
    .then(data => {
      syncStateWithServer(data);
      resizeCanvas();
    })
    .catch(err => console.error("Initial load error:", err));
}

// Start application
init();
