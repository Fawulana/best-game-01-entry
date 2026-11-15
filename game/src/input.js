// Keyboard and pointer input. Held keys give a steering direction; one-shot presses
// (launch, fire, pause) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. The mouse steers the paddle
// directly: moving it sets a target x, and clicking launches or fires.

export const ACTION_LAUNCH = 1;
export const ACTION_FIRE = 2;
export const ACTION_PAUSE = 4;
export const ACTION_MUTE = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const LAUNCH = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  let left = false;
  let right = false;
  let actions = 0;
  let mouseX = null;
  let mouseSeenAt = 0;

  function toFieldX(clientX) {
    const rect = canvas.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * 1280;
  }

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (LAUNCH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_LAUNCH | ACTION_FIRE;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    mouseX = toFieldX(event.clientX);
    mouseSeenAt = performance.now();
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouseX = toFieldX(event.clientX);
    mouseSeenAt = performance.now();
    actions |= ACTION_LAUNCH | ACTION_FIRE;
  });

  return {
    /** -1 for left, 1 for right, 0 for neither or both. */
    direction() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** The paddle's mouse target in field coordinates, or null when the mouse is idle. */
    mouseTarget() {
      if (mouseX === null) return null;
      // The mouse stops steering a second after it last moved, so the keys take over.
      if (performance.now() - mouseSeenAt > 1000) return null;
      return mouseX;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
