/**
 * PulseEQ - Pro Keyboard Navigation & Q Stepper Controller (WCAG 2.2 AA)
 * Enables complete tactile keyboard control and single-pointer Q stepper buttons.
 */

import { state, announce, formatDb } from "./state.js";

export function initKeyboardAndSteppers(elements, callbacks) {
  const {
    graphViewport,
    qDecBtn,
    qIncBtn
  } = elements;

  const {
    updateInspector,
    updatePresetChips,
    drawFairlightGraph,
    debouncedSyncBand,
    debouncedSyncGlobalQ,
    toggleBypass,
    applyPreset
  } = callbacks;

  // Keyboard Navigation inside Viewport
  graphViewport.addEventListener("keydown", (e) => {
    const idx = state.selected_band;

    // Number keys 1-9: Select band 1-9; 0: Select band 10
    if (e.key >= "1" && e.key <= "9") {
      const num = parseInt(e.key, 10) - 1;
      if (num < state.frequencies.length) {
        state.selected_band = num;
        updateInspector();
        drawFairlightGraph();
        announce(`Selected Band ${num + 1}`);
        e.preventDefault();
        return;
      }
    } else if (e.key === "0") {
      state.selected_band = 9;
      updateInspector();
      drawFairlightGraph();
      announce("Selected Band 10");
      e.preventDefault();
      return;
    }

    // Bracket keys: Cycle bands
    if (e.key === "[") {
      state.selected_band = (state.selected_band - 1 + 10) % 10;
      updateInspector();
      drawFairlightGraph();
      announce(`Selected Band ${state.selected_band + 1}`);
      e.preventDefault();
      return;
    } else if (e.key === "]") {
      state.selected_band = (state.selected_band + 1) % 10;
      updateInspector();
      drawFairlightGraph();
      announce(`Selected Band ${state.selected_band + 1}`);
      e.preventDefault();
      return;
    }

    // Arrow Up / Down: Gain
    if (e.key === "ArrowUp") {
      const step = e.shiftKey ? 0.1 : 0.5;
      state.gains[idx] = Math.min(15.0, Math.round((state.gains[idx] + step) * 10) / 10);
      state.active_preset = "Custom";
      updatePresetChips();
      updateInspector();
      drawFairlightGraph();
      debouncedSyncBand(idx);
      e.preventDefault();
      return;
    } else if (e.key === "ArrowDown") {
      const step = e.shiftKey ? 0.1 : 0.5;
      state.gains[idx] = Math.max(-15.0, Math.round((state.gains[idx] - step) * 10) / 10);
      state.active_preset = "Custom";
      updatePresetChips();
      updateInspector();
      drawFairlightGraph();
      debouncedSyncBand(idx);
      e.preventDefault();
      return;
    }

    // Arrow Left / Right: Frequency
    if (e.key === "ArrowLeft") {
      const minF = idx > 0 ? (state.frequencies[idx - 1] * 1.05) : 22;
      state.frequencies[idx] = Math.round(Math.max(minF, state.frequencies[idx] / 1.05));
      state.active_preset = "Custom";
      updatePresetChips();
      updateInspector();
      drawFairlightGraph();
      debouncedSyncBand(idx);
      e.preventDefault();
      return;
    } else if (e.key === "ArrowRight") {
      const maxF = idx < state.frequencies.length - 1 ? (state.frequencies[idx + 1] * 0.95) : 19500;
      state.frequencies[idx] = Math.round(Math.min(maxF, state.frequencies[idx] * 1.05));
      state.active_preset = "Custom";
      updatePresetChips();
      updateInspector();
      drawFairlightGraph();
      debouncedSyncBand(idx);
      e.preventDefault();
      return;
    }

    // PageUp / PageDown: Q factor across all points
    if (e.key === "PageUp") {
      const currentQ = state.q_factors[0] || 1.41;
      const newQ = Math.min(8.0, Math.round((currentQ + 0.15) * 100) / 100);
      for (let i = 0; i < state.q_factors.length; i++) {
        state.q_factors[i] = newQ;
      }
      state.active_preset = "Custom";
      updateInspector();
      drawFairlightGraph();
      debouncedSyncGlobalQ(newQ);
      announce(`Q factor: ${newQ}`);
      e.preventDefault();
      return;
    } else if (e.key === "PageDown") {
      const currentQ = state.q_factors[0] || 1.41;
      const newQ = Math.max(0.3, Math.round((currentQ - 0.15) * 100) / 100);
      for (let i = 0; i < state.q_factors.length; i++) {
        state.q_factors[i] = newQ;
      }
      state.active_preset = "Custom";
      updateInspector();
      drawFairlightGraph();
      debouncedSyncGlobalQ(newQ);
      announce(`Q factor: ${newQ}`);
      e.preventDefault();
      return;
    }

    // Home / Delete / Backspace: Reset band gain to 0
    if (e.key === "Home" || e.key === "Delete" || e.key === "Backspace") {
      state.gains[idx] = 0.0;
      state.active_preset = "Custom";
      updatePresetChips();
      updateInspector();
      drawFairlightGraph();
      debouncedSyncBand(idx);
      announce(`Band ${idx + 1} reset to 0 dB`);
      e.preventDefault();
      return;
    }

    // B / Space: Toggle Bypass
    if (e.key === "b" || e.key === "B" || (e.key === " " && document.activeElement === graphViewport)) {
      toggleBypass();
      e.preventDefault();
      return;
    }
  });

  // Single-Pointer Q Steppers (affects all points)
  if (qDecBtn) {
    qDecBtn.addEventListener("click", () => {
      const currentQ = state.q_factors[0] || 1.41;
      const newQ = Math.max(0.3, Math.round((currentQ - 0.15) * 100) / 100);
      for (let i = 0; i < state.q_factors.length; i++) {
        state.q_factors[i] = newQ;
      }
      state.active_preset = "Custom";
      updateInspector();
      drawFairlightGraph();
      debouncedSyncGlobalQ(newQ);
    });
  }

  if (qIncBtn) {
    qIncBtn.addEventListener("click", () => {
      const currentQ = state.q_factors[0] || 1.41;
      const newQ = Math.min(8.0, Math.round((currentQ + 0.15) * 100) / 100);
      for (let i = 0; i < state.q_factors.length; i++) {
        state.q_factors[i] = newQ;
      }
      state.active_preset = "Custom";
      updateInspector();
      drawFairlightGraph();
      debouncedSyncGlobalQ(newQ);
    });
  }
}
