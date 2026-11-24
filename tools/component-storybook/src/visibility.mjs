// Storybook preview lifecycle only. HyperFrames still owns all frame clocks.
export function createPreviewController({mount, onError, reducedMotion = false, releaseInactive = false}) {
  let active = false, disposed = false, player = null, pending = null, generation = 0;
  let wantsPlayback = !reducedMotion, savedTime = null;
  const destroy = value => { value.pause(); value.destroy(); };
  function cancelPending() {
    generation++;
    pending?.abort(); pending = null;
  }
  async function start() {
    const token = ++generation, abort = new AbortController(); pending = abort;
    try {
      const value = await mount(abort.signal);
      if (disposed || !active || token !== generation) { destroy(value); return; }
      pending = null; player = value;
      if (savedTime !== null) player.seek(savedTime);
      else if (reducedMotion) player.seek(player.duration * .6);
      if (wantsPlayback) player.play();
      else player.pause();
    } catch (error) {
      if (token === generation) pending = null;
      if (!disposed && !abort.signal.aborted && token === generation) onError(error);
    }
  }
  return {
    setActive(value) {
      if (disposed || active === value) return;
      active = value;
      if (!active) {
        cancelPending();
        if (player) {
          // Inspect the user's actual state before our own policy pauses it.
          wantsPlayback = !player.paused; savedTime = player.currentTime;
          player.pause();
          if (releaseInactive) { player.destroy(); player = null; }
        }
      } else if (player) {
        if (wantsPlayback) player.play();
      } else if (!pending) void start();
    },
    dispose() {
      if (disposed) return;
      disposed = true; active = false; cancelPending();
      if (player) { destroy(player); player = null; }
    },
  };
}

export function createVisibilityCoordinator() {
  const previews = new Set();
  let documentVisible = true, currentDocs = null;
  function update() {
    const visibleDocs = [...previews].filter(preview => preview.docs && preview.ratio > 0);
    // Keep the current preview on equal intersections, avoiding scroll jitter.
    currentDocs = visibleDocs.reduce((best, item) => !best || item.ratio > best.ratio ? item : best,
      currentDocs && visibleDocs.includes(currentDocs) ? currentDocs : null);
    for (const preview of previews) {
      preview.controller.setActive(documentVisible && preview.ratio > 0 && (!preview.docs || preview === currentDocs));
    }
  }
  return {
    register(controller, {docs = false} = {}) {
      const preview = {controller, docs, ratio: 0}; previews.add(preview);
      return {
        intersection(ratio) { preview.ratio = Math.max(0, Math.min(1, ratio)); update(); },
        dispose() { previews.delete(preview); if (currentDocs === preview) currentDocs = null; controller.dispose(); update(); },
      };
    },
    documentVisibility(visible) { documentVisible = visible; update(); },
  };
}
