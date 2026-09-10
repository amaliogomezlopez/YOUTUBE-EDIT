import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {candidates,validateSoundRatings} from '../src/modules/talking-head/sound-preferences.js';
const root=path.resolve(import.meta.dirname,'..');
const file=path.join(root,'data/talking-head/sound-preferences.json');
const port=Number(process.env.TALKING_HEAD_SOUND_PORT || 3057);
const origin=`http://127.0.0.1:${port}`;
const available=candidates.filter(c=>existsSync(path.join(root,'remotion-animations/public',c.file)));
createServer(async(req,res)=>{
 try {
  if(req.headers.host!==`127.0.0.1:${port}`){res.writeHead(403).end();return;}
  const url=new URL(req.url,origin);
  if(req.method==='GET' && url.pathname==='/'){
   res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await readFile(path.join(root,'public/talking-head-sounds.html')));return;
  }
  if(req.method==='GET' && url.pathname==='/api/sounds'){
   const saved=existsSync(file)?JSON.parse(await readFile(file,'utf8')):{ratings:{}};
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({candidates:available,...saved}));return;
  }
  if(req.method==='GET' && url.pathname.startsWith('/audio/')){
   const c=available.find(x=>x.id===url.pathname.slice(7));if(!c){res.writeHead(404).end();return;}
   res.setHeader('Content-Type','audio/wav');res.end(await readFile(path.join(root,'remotion-animations/public',c.file)));return;
  }
  if(req.method==='POST' && url.pathname==='/api/ratings'){
   if(req.headers.origin!==origin || req.headers['content-type']!=='application/json'){res.writeHead(403).end();return;}
   let body='';for await(const part of req){body+=part;if(body.length>12000){res.writeHead(413).end();return;}}
   const ratings=validateSoundRatings(JSON.parse(body).ratings);
   await mkdir(path.dirname(file),{recursive:true});
   await writeFile(file,JSON.stringify({ratings,updatedAt:new Date().toISOString()},null,2)+'\n');
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({saved:true}));return;
  }
  res.writeHead(404).end();
 }catch(error){res.writeHead(400,{'Content-Type':'application/json'}).end(JSON.stringify({error:error.message}));}
}).listen(port,'127.0.0.1',()=>console.log(origin));
