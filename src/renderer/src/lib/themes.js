// Selectable colour themes. The actual palettes live as CSS variables in
// index.css ([data-theme='…']); this registry drives the Settings picker and
// applies the choice by setting data-theme on <html>. Swatches are static
// previews (the picker shows every theme at once, so they can't read live vars).
export const THEMES = [
  { id: 'ember', label: 'Espresso & Ember', swatches: ['#1F1813', '#EC9A45', '#54D6A0'] },
  { id: 'midnight', label: 'Midnight', swatches: ['#161B26', '#56C5E2', '#5ADCAC'] },
  { id: 'vino', label: 'Vino', swatches: ['#26161B', '#E0B86E', '#78CD9E'] }
]

const IDS = THEMES.map((t) => t.id)

// Apply a theme to the document, falling back to the default for unknown ids.
export function applyTheme(id) {
  document.documentElement.dataset.theme = IDS.includes(id) ? id : 'ember'
}
