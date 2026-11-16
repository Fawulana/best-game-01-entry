// Keyboard and pointer input. Held keys give a steering direction; one-shot presses
// (launch, fire, pause, menu moves) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. The mouse steers
// the paddle directly: moving it sets a target x, and clicking launches or fires.
// Clicks also report their field position, so menus answer them precisely.

export const ACTION_LAUNCH = 1;
export const ACTION_FIRE = 2;
export const ACTION_PAUSE = 4;
export const ACTION_MUTE = 8;
export const ACTION_UP = 16;
export const ACTION_DOWN = 32;
export const ACTION_BACK = 64;
export const ACTION_QUIT = 128;
export const ACTION_DASH = 256;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LAUNCH = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const QUIT = new Set(['KeyQ']);
const DASH = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  let left = false;
  let right = false;
  let actions = 0;
  let mouseX = null;
  let mouseSeenAt = 0;
  let click = null;

  // The canvas fills the window and the renderer letterboxes the 1280x720 field
  // inside it: invert that transform so a pointer lands on the field it points at.
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / 1280, rect.height / 720);
    const offsetX = (rect.width - 1280 * scale) / 2;
    const offsetY = (rect.height - 720 * scale) / 2;
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (UP.has(event.code)) {
      if (!event.repeat) actions |= ACTION_UP;
    } else if (DOWN.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DOWN;
    } else if (LAUNCH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_LAUNCH | ACTION_FIRE;
    } else if (DASH.has(event.code)) {
      // Shift dashes the paddle: a one-shot burst, never a held repeat.
      if (!event.repeat) actions |= ACTION_DASH;
    } else if (PAUSE.has(event.code)) {
      // Escape also goes back in menus; the loop reads it by screen.
      if (!event.repeat) actions |= ACTION_PAUSE | (event.code === 'Escape' ? ACTION_BACK : 0);
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (QUIT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_QUIT;
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
    mouseX = toField(event.clientX, event.clientY).x;
    mouseSeenAt = performance.now();
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = toField(event.clientX, event.clientY);
    mouseX = point.x;
    mouseSeenAt = performance.now();
    click = point;
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
    /** The latest click's field position since the last call, or null. */
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
  };
}
