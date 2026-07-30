const CONTEXTUAL_BACKGROUND =
  /background|photo|image|video|footage|documentary|texture|b-roll|broll/i;

const backgroundKey = (asset) => {
  if (!asset) return null;
  if (typeof asset === 'string') return asset;
  return asset.path ?? asset.src ?? asset.id ?? null;
};

const contextualBackgrounds = (scene) => {
  const candidates = [
    scene.backgroundAsset,
    scene.backgroundMedia,
    scene.props?.backgroundAsset,
    scene.props?.backgroundMedia,
    ...(scene.assets ?? []),
    ...(scene.props?.assets ?? [])
  ].filter(Boolean);

  return candidates.filter((asset) => {
    if (typeof asset === 'string') return CONTEXTUAL_BACKGROUND.test(asset);
    return CONTEXTUAL_BACKGROUND.test(
      [
        asset.type,
        asset.kind,
        asset.role,
        asset.family,
        asset.path,
        asset.src
      ].filter(Boolean).join(' ')
    );
  });
};

export default {
  id: 'block-background-asset-variety',
  run(context, rule) {
    const scenes = context.scenes ?? [];
    if (scenes.length < 4) return [];

    const minimum =
      rule.params?.minimumContextualBackgroundScenes ??
      Math.min(2, scenes.length);
    const qualifyingScenes = scenes
      .map(contextualBackgrounds)
      .filter((assets) => assets.length > 0);
    const distinctBackgrounds = new Set(
      qualifyingScenes.flat().map(backgroundKey).filter(Boolean)
    );

    if (
      qualifyingScenes.length >= minimum &&
      distinctBackgrounds.size >= minimum
    ) {
      return [];
    }

    return [{
      message:
        `El bloque usa ${qualifyingScenes.length} escenas con fondo contextual y ` +
        `${distinctBackgrounds.size} fondos distintos; necesita al menos ${minimum} ` +
        'fotografías, vídeos, texturas documentales o assets de fondo ligados a la locución.'
    }];
  }
};
