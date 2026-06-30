import test from 'node:test';
import assert from 'node:assert/strict';
import {buildClipPublishing, postForPlatform} from '../src/lib/publishing.js';

test('builds clip-specific publishing package with front-loaded hashtags', () => {
  const publishing = buildClipPublishing({
    id: 'clip-glm',
    rank: 2,
    suggestedTitle: 'GLM 5.2 gana por precio? Mi veredicto claro',
    text: 'GLM 5.2 no solo compite por calidad: el precio cambia completamente la comparativa contra GPT y Claude.'
  }, {
    hashtags: '#IA #InteligenciaArtificial #Shorts #GPT'
  });

  const tags = publishing.hashtags.split(/\s+/);
  assert.equal(tags.length, 14);
  assert.ok(tags.includes('#GLM52'));
  assert.equal(publishing.priorityHashtags.length, 4);
  assert.ok(publishing.youtube_shorts.description.startsWith(publishing.priorityHashtags.join(' ')));
  assert.equal(publishing.schedule.recommendedOffsetHours, 36);
});

test('postForPlatform prefers selected clip package over global metadata', () => {
  const metadata = {
    platform_posts: {
      youtube_shorts: {title: 'Titulo global', description: 'Descripcion global'}
    }
  };
  const clip = {
    publishing: {
      youtube_shorts: {title: 'Titulo del clip', description: '#IA #Shorts'}
    }
  };

  assert.equal(postForPlatform(metadata, clip, 'youtube_shorts').title, 'Titulo del clip');
});
