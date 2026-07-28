import {parseCliArgs} from '../../lib/utils.js';
import {
  ChannelRegistry,
  channelPublicDto
} from './channel-registry.js';
import {
  EditorialEpisodeRepository
} from './repository.js';
import {
  episodePublicDto,
  episodeSummaryDto
} from './dto.js';

export function editorialVideoUsage() {
  return `Shortsmith · episodios editoriales

Uso:
  npm run editorial-video -- create --channel economia-historias [--title "Título"]
  npm run editorial-video -- show --episode <id> [--channel economia-historias]
  npm run editorial-video -- list --channel economia-historias
  npm run editorial-video -- channels`;
}

function required(args, name) {
  const value = String(args[name] || '').trim();
  if (value) return value;
  const error = new Error(`Falta la opción obligatoria --${name}.`);
  error.code = 'EDITORIAL_CLI_ARGUMENT_REQUIRED';
  error.status = 400;
  throw error;
}

export async function runEditorialVideoCli(
  argv,
  {
    registry = new ChannelRegistry(),
    repository = new EditorialEpisodeRepository({
      channelRegistry: registry
    }),
    stdout = (value) => console.log(value)
  } = {}
) {
  const [command, ...rest] = argv;
  if (!command || ['help', '--help', '-h'].includes(command)) {
    stdout(editorialVideoUsage());
    return null;
  }
  const args = parseCliArgs(rest);
  let result;
  if (command === 'channels') {
    result = await registry.list();
    result = result.map(channelPublicDto);
  } else if (command === 'create') {
    const channelId = required(args, 'channel');
    await registry.load(channelId);
    result = episodePublicDto(
      await repository.create({
        channelId,
        title: args.title || 'Nuevo episodio'
      })
    );
  } else if (command === 'show') {
    const episodeId = required(args, 'episode');
    const manifest = args.channel
      ? await repository.load(String(args.channel), episodeId)
      : await repository.find(episodeId);
    result = episodePublicDto(manifest);
  } else if (command === 'list') {
    const channelId = required(args, 'channel');
    await registry.load(channelId);
    result = (await repository.list({channelId})).map(episodeSummaryDto);
  } else {
    const error = new Error(
      `Comando editorial desconocido: ${command}\n\n${editorialVideoUsage()}`
    );
    error.code = 'EDITORIAL_CLI_UNKNOWN_COMMAND';
    error.status = 400;
    throw error;
  }
  stdout(JSON.stringify(result, null, 2));
  return result;
}
