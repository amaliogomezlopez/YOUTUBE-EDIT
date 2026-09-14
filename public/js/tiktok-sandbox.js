const $ = selector => document.querySelector(selector);
const status = text => { $('#status').textContent = text; };
let creator = null;
let previewUrl = '';
async function api(route, body) {
  const response = await fetch(`/api/tiktok-sandbox/${route}`, body ? {method:'POST',headers:{'x-shortsmith-csrf':'1',...(body instanceof FormData ? {} : {'content-type':'application/json'})},body:body instanceof FormData ? body : JSON.stringify(body)} : {});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo completar la operación.');
  return result;
}
async function refresh() {
  const state = await api('status');
  $('#connect').disabled = !state.configured;
  $('#setup').hidden = state.configured;
  $('#publication').hidden = !state.connected;
  if (!state.connected) { status(state.configured ? 'Credenciales cargadas. Autoriza ahora la cuenta con TikTok.' : 'Introduce las credenciales del Sandbox creado en TikTok Developers.'); return; }
  const result = await api('account');
  $('#account').replaceChildren();
  if (result.user.avatar_url) { const img = new Image(); img.src = result.user.avatar_url; img.alt = ''; $('#account').append(img); }
  const name = document.createElement('strong'); name.textContent = result.creator?.creator_nickname || result.user.display_name; $('#account').append(name);
  creator = result.creator;
  $('#privacy').replaceChildren(new Option('Selecciona una opción', ''));
  // Sandbox can only demonstrate private Direct Post; selection is never automatic.
  if (creator?.privacy_level_options?.includes('SELF_ONLY')) $('#privacy').add(new Option('Solo yo · prueba privada', 'SELF_ONLY'));
  for (const [name, flag] of [['allowComment','comment_disabled'],['allowDuet','duet_disabled'],['allowStitch','stitch_disabled']]) {
    const input = $(`[name=${name}]`); input.checked = false; input.disabled = !creator || Boolean(creator[flag]);
  }
  status(result.creatorError || `Cuenta conectada. Límite actual de vídeo: ${creator.max_video_post_duration_sec} segundos.`);
}
$('#credentials').addEventListener('submit', async event => {
  event.preventDefault();
  try { await api('config', Object.fromEntries(new FormData(event.target))); event.target.reset(); await refresh(); } catch(error) {status(error.message);}
});
$('#connect').addEventListener('click', async () => {try {const result = await api('start', {}); location.assign(result.url);} catch(error) {status(error.message);}});
$('#refresh').addEventListener('click', () => refresh().catch(error => status(error.message)));
$('#video').addEventListener('change', event => { if(previewUrl) URL.revokeObjectURL(previewUrl); const file = event.target.files[0]; previewUrl = file ? URL.createObjectURL(file) : ''; $('#preview').src = previewUrl; $('[name=consent]').checked = false; });
$('[name=mode]').addEventListener('change', event => { $('#direct').hidden = event.target.value !== 'direct'; $('#privacy').required = event.target.value === 'direct'; $('[name=consent]').checked = false; });
$('#publish').addEventListener('submit', async event => {
  event.preventDefault();
  const data = new FormData(event.target);
  if (data.get('mode') === 'direct' && (!creator || data.get('privacyLevel') !== 'SELF_ONLY')) return status('Selecciona Solo yo, si TikTok permite la prueba para esta cuenta.');
  $('#send').disabled = true;
  status('Subiendo el MP4 mediante la API oficial. Espera a que TikTok confirme el resultado.');
  try {const result = await api('publish', data); status(JSON.stringify(result, null, 2)); if(result.publishId) [name=publishId].value = result.publishId;} catch(error) {status(error.message);} finally {$('#send').disabled = false; $('[name=consent]').checked = false;}
});
refresh().catch(error => status(error.message));

$('#track').addEventListener('submit', async event => {
  event.preventDefault();
  try { const result = await api('publication-status', Object.fromEntries(new FormData(event.target))); status(JSON.stringify(result, null, 2)); } catch(error) { status(error.message); }
});