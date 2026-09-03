export const CAPTION_PRESETS = Object.freeze({
  'progressive-reference': Object.freeze({
    preset: 'progressive-reference', layout: 'reference-stack', font: 'Arial', primary: '#FFFFFF', accent: '#FFFFFF', activeColor: '#FFFFFF',
    baseFontSize: 86, heroScale: 2.12, leadScale: 1, tailScale: 1.12, position: 'lower-middle', align: 'center', uppercase: false,
    emphasis: 'auto', maxWords: 6, maxPageDuration: 3.05, pauseBreak: 0.34, maxLineChars: 16, marginX: 120, outlineSize: 0, shadow: 0, tracking: -1
  }),
  'progressive-punchy': Object.freeze({
    preset: 'progressive-punchy', font: 'Bahnschrift', primary: '#FFFFFF', accent: '#FFFFFF', activeColor: '#FFFFFF',
    baseFontSize: 86, heroScale: 1.78, leadScale: 1, tailScale: 1, position: 'lower', align: 'left', uppercase: true,
    emphasis: 'auto', maxWords: 5, maxPageDuration: 2.35, pauseBreak: 0.3, maxLineChars: 14, marginX: 130, outlineSize: 3, shadow: 2, tracking: 0
  }),
  'progressive-editorial': Object.freeze({
    preset: 'progressive-editorial', font: 'Arial Black', primary: '#FFFFFF', accent: '#FFFFFF', activeColor: '#FFFFFF',
    baseFontSize: 82, heroScale: 2.02, leadScale: 1, tailScale: 1, position: 'lower-middle', align: 'left', uppercase: true,
    emphasis: 'auto', maxWords: 7, maxPageDuration: 3.2, pauseBreak: 0.42, maxLineChars: 18, marginX: 150, outlineSize: 3, shadow: 2, tracking: 0
  }),
  'progressive-clean': Object.freeze({
    preset: 'progressive-clean', font: 'Arial Black', primary: '#FFFFFF', accent: '#F7D54A', activeColor: '#F7D54A',
    baseFontSize: 78, heroScale: 1.45, leadScale: 1, tailScale: 1, position: 'lower-middle', align: 'left', uppercase: false,
    emphasis: 'auto', maxWords: 8, maxPageDuration: 3.4, pauseBreak: 0.46, maxLineChars: 20, marginX: 140, outlineSize: 4, shadow: 2, tracking: 0
  }),
  'karaoke-highlight': Object.freeze({
    preset: 'karaoke-highlight', font: 'Schibsted Grotesk', primary: '#FFFFFF', accent: '#7CFF6A', activeColor: '#7CFF6A',
    baseFontSize: 72, heroScale: 1, leadScale: 1, tailScale: 1, position: 'safe-lower', align: 'center', uppercase: true,
    emphasis: 'off', maxWords: 4, maxLineWords: 4, maxPageChars: 20, maxLines: 2, maxPageDuration: 2.1, pauseBreak: 0.32,
    maxLineChars: 14, marginX: 90, outlineSize: 5, shadow: 2, tracking: 0
  })
});
