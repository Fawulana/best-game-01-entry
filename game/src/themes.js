// One visual identity per wall: sky gradient, ground glow, accent colour and the
// background motif the renderer paints behind the bricks. The motif is drawn from
// seeded positions and the clock alone, so it never allocates and never desyncs
// the simulation. Themes are pure data — the world never reads them.

export const LEVEL_THEMES = [
  {
    name: 'Dawn Violet',
    skyTop: '#150a33', skyBottom: '#070312', ground: '#1c0f38', accent: '#b45cff',
    motif: 'stars', blurb: 'Where the light first broke through.',
  },
  {
    name: 'Aurora Teal',
    skyTop: '#062a2e', skyBottom: '#04141a', ground: '#0b2e33', accent: '#39e6ff',
    motif: 'aurora', blurb: 'Twin spires under a restless sky.',
  },
  {
    name: 'Emberfall',
    skyTop: '#33100a', skyBottom: '#120402', ground: '#33150a', accent: '#ff7a2f',
    motif: 'embers', blurb: 'The heart burns, and it remembers.',
  },
  {
    name: 'Steel Blue',
    skyTop: '#101a30', skyBottom: '#070b18', ground: '#16233d', accent: '#8f9bb3',
    motif: 'grid', blurb: 'A gate that never opened.',
  },
  {
    name: 'Maze Green',
    skyTop: '#0a2a1a', skyBottom: '#04120a', ground: '#12351f', accent: '#7dff9e',
    motif: 'vines', blurb: 'Every corridor leads somewhere.',
  },
  {
    name: 'Choir Magenta',
    skyTop: '#2e0a2e', skyBottom: '#140414', ground: '#331038', accent: '#ff5ce1',
    motif: 'rings', blurb: 'The crystals sing in harmony.',
  },
  {
    name: 'Void Indigo',
    skyTop: '#0a0a2e', skyBottom: '#03030c', ground: '#12123a', accent: '#5c7cff',
    motif: 'void', blurb: 'Something patient waits within.',
  },
  {
    name: 'Core Crimson',
    skyTop: '#330a10', skyBottom: '#120204', ground: '#3a0f14', accent: '#ff5c3d',
    motif: 'core', blurb: 'Break the Core Warden.',
  },
];

/** The theme of a level number (1-based), clamped to the list. */
export function themeOf(level) {
  return LEVEL_THEMES[Math.max(0, Math.min(LEVEL_THEMES.length - 1, level - 1))];
}
