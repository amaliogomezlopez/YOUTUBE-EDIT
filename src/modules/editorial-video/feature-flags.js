const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function editorialVideoFeatureFlags(environment = process.env) {
  return {
    uiEnabled: TRUE_VALUES.has(
      String(environment.SHORTSMITH_EDITORIAL_VIDEO_UI_ENABLED || '')
        .trim()
        .toLowerCase()
    )
  };
}
