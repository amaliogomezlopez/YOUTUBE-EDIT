export const CAROUSEL_LAYOUTS = [
  'cover-hero',
  'photo-annotation',
  'feature-list',
  'pros-cons',
  'comparison',
  'stat',
  'steps',
  'quote',
  'verdict',
  'cta'
];

export const CAROUSEL_FORMATS = {
  'instagram-feed': {id: 'instagram-feed', label: 'Instagram 4:5', width: 1080, height: 1350, mime: 'image/jpeg'},
  vertical: {id: 'vertical', label: 'Stories / TikTok 9:16', width: 1080, height: 1920, mime: 'image/jpeg'}
};

export const CAROUSEL_THEMES = {
  forge: {paper: '#f7f7f4', ink: '#15181d', accent: '#f05a28', accentInk: '#1c0d08', soft: '#d9dde2', panel: '#ffffff'},
  cobalt: {paper: '#eef3f8', ink: '#10253c', accent: '#1769ff', accentInk: '#ffffff', soft: '#bfd0df', panel: '#ffffff'},
  signal: {paper: '#f4f0e7', ink: '#11110f', accent: '#e45f35', accentInk: '#ffffff', soft: '#d8d0c1', panel: '#fffdf8'},
  night: {paper: '#121419', ink: '#f5f6f8', accent: '#ff7445', accentInk: '#1c0d08', soft: '#343a45', panel: '#1d2128'}
};

export const CAROUSEL_LIMITS = {
  sourceCharacters: 30_000,
  minSlides: 5,
  maxSlides: 10,
  headlineCharacters: 110,
  bodyCharacters: 520,
  labelCharacters: 28,
  imageBytes: 20 * 1024 * 1024
};

export function carouselFormat(value) {
  return CAROUSEL_FORMATS[value] || CAROUSEL_FORMATS['instagram-feed'];
}
