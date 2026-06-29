import {manualResult, missing, validateVideoAsset} from './common.js';

const REQUIRED_ENV = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'];

export async function publishToX({videoFile, metadata}) {
  const assetError = validateVideoAsset(videoFile);
  if (assetError) {
    return {platform: 'x', status: 'failed', error: assetError};
  }

  const post = metadata.platform_posts?.x ?? {};
  const missingEnv = missing(REQUIRED_ENV);
  if (missingEnv.length) {
    return manualResult('x', 'Faltan credenciales de X API con permisos de escritura y subida de media.', {
      missingEnv,
      officialApi: 'X API media upload + post create',
      asset: videoFile,
      text: post.text || metadata.summary?.short
    });
  }

  return manualResult('x', 'Conector preparado; falta implementar subida chunked de media y creacion del post.', {
    officialApi: 'X API media upload + post create',
    asset: videoFile,
    text: post.text
  });
}
