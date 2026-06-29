import {manualResult, missing, validateVideoAsset} from './common.js';

const REQUIRED_ENV = ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_ACCESS_TOKEN'];

export async function publishToTiktok({videoFile, metadata}) {
  const assetError = validateVideoAsset(videoFile);
  if (assetError) {
    return {platform: 'tiktok', status: 'failed', error: assetError};
  }

  const post = metadata.platform_posts?.tiktok ?? {};
  const missingEnv = missing(REQUIRED_ENV);
  if (missingEnv.length) {
    return manualResult('tiktok', 'Faltan credenciales de TikTok Content Posting API y scopes de publicacion.', {
      missingEnv,
      officialApi: 'TikTok Content Posting API',
      asset: videoFile,
      caption: post.caption || metadata.summary?.short
    });
  }

  return manualResult('tiktok', 'Conector preparado; falta completar init/upload/publish segun el modo aprobado por TikTok.', {
    officialApi: 'TikTok Content Posting API',
    asset: videoFile,
    caption: post.caption
  });
}
