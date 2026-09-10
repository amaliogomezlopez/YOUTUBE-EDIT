import {alignFolderSoundEdges} from '../video-studio/sound-edges.js';
import path from 'node:path';
import {ROOT, DATA_DIR, readJson} from '../../lib/utils.js';
import {REMOTION_ROOT} from '../shorts-studio/constants.js';
import {importFolderSounds} from '../video-studio/folder-sounds.js';
import {semanticSoundSelection} from './sound-usage.js';
import {writeJson} from '../../lib/utils.js';
import {selectTalkingHeadSounds} from './sound-preferences.js';

export const SOUND_DROP_FOLDER = path.join(ROOT,'SONIDOS-REELS');
export async function loadTalkingHeadSounds({log=()=>{}} = {}) {
  const imported = await importFolderSounds({folder:SOUND_DROP_FOLDER,publicRoot:path.join(REMOTION_ROOT,'public'),manifestFile:path.join(DATA_DIR,'talking-head','folder-sounds.json'),log});
  if (imported.entries.length) {
    const selection=semanticSoundSelection(await alignFolderSoundEdges(imported,path.join(REMOTION_ROOT,'public')));
    for (const warning of selection.warnings) log(warning);
    await writeJson(path.join(DATA_DIR,'talking-head','sound-catalog.json'),selection);
    return selection;
  }
  const preferences = await readJson(path.join(DATA_DIR,'talking-head','sound-preferences.json')).catch(()=>null);
  return {...selectTalkingHeadSounds(preferences),folder:SOUND_DROP_FOLDER};
}
