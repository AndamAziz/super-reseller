// Native MAG250 WebKit predates modern React/browser APIs; keep this isolated
// device bootstrap ES5-compatible. Catalog and playback remain server-authorized.
import logoAsset from '@/assets/kurdistan-iptv-logo.png.asset.json';

export function portalScreen(): Response {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>KURDISTAN IPTV · MAG Portal</title><meta name="description" content="KURDISTAN IPTV subscriber MAC portal.">
<meta property="og:title" content="KURDISTAN IPTV · MAG Portal"><meta property="og:description" content="KURDISTAN IPTV subscriber MAC portal."><meta property="og:type" content="website"><meta name="twitter:card" content="summary">
<style>:root{--background:#101715;--foreground:#f2f5f3;--muted:#b8c4be;--accent:#a5e15a;--surface:#202c25;--border:#415347}*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--foreground);font:24px Arial,sans-serif;letter-spacing:0}main{max-width:1200px;margin:auto;padding:32px}h1{font-size:34px;margin:0 0 24px}nav{margin-bottom:24px}button{font:inherit;cursor:pointer;color:var(--foreground);background:var(--surface);border:2px solid var(--border);border-radius:4px;padding:12px 18px;margin:4px;min-height:52px}button:focus{outline:3px solid var(--accent);color:var(--accent)}#status{color:var(--muted);min-height:32px;margin:16px 0}#items button{display:block;width:100%;text-align:left;margin:6px 0}footer{margin-top:20px}#player{width:100%;max-height:65vh;display:none}@media(max-width:600px){main{padding:16px}body{font-size:18px}h1{font-size:28px}}</style>
<style>.portal-brand{margin-bottom:24px}.portal-brand img{display:block;width:240px;height:240px;max-width:100%;object-fit:contain;margin:0 auto 16px}.portal-brand h1{margin-bottom:0}@media(max-width:600px){.portal-brand img{width:192px;height:192px}}</style>
</head><body><main><header class="portal-brand"><img src="${logoAsset.url}" alt="Kurdistan IPTV — Kurdistan map" width="144" height="144"><h1>KURDISTAN IPTV</h1></header><nav id="modes"><button data-mode="itv">TV</button><button data-mode="vod">Movies</button><button data-mode="series">Series</button></nav><div id="status" role="status">Connecting...</div><video id="player" controls></video><section id="items" aria-label="Channels"></section><footer><button id="back">Back</button><button id="previous">Previous</button><button id="next">Next</button></footer></main>
<script>(function(){
'use strict';
var token='',mac='',mode='itv',category='*',page=1,screen='categories',total=0,movie='',season='',playing=false;
var status=document.getElementById('status'),items=document.getElementById('items'),video=document.getElementById('player');
var device=window.gSTB||window.stb;
function message(text){status.textContent=text;}
function api(type,action,params,done){
 var query='type='+encodeURIComponent(type)+'&action='+encodeURIComponent(action)+'&JsHttpRequest=1-xml';
 if(mac){query+='&mac='+encodeURIComponent(mac);}
 for(var key in params){if(Object.prototype.hasOwnProperty.call(params,key)){query+='&'+encodeURIComponent(key)+'='+encodeURIComponent(params[key]);}}
 var xhr=new XMLHttpRequest();xhr.open('GET','server/load.php?'+query,true);xhr.timeout=12000;
 if(token){xhr.setRequestHeader('Authorization','Bearer '+token);}
 xhr.onreadystatechange=function(){if(xhr.readyState!==4){return;}try{if(xhr.status!==200){throw new Error('Portal unavailable ('+xhr.status+')');}var result=JSON.parse(xhr.responseText).js;if(result&&result.error){throw new Error(result.error);}done(result);}catch(e){message(e.message||'Portal unavailable');}};
 xhr.ontimeout=function(){message('Portal timed out. Please retry.');};xhr.onerror=function(){message('Portal unavailable. Please retry.');};xhr.send(null);
}
function clear(){items.textContent='';message('Loading...');}
function row(label,click){var b=document.createElement('button');b.textContent=label;b.onclick=click;items.appendChild(b);}
function focusFirst(){var b=items.getElementsByTagName('button')[0];if(b){b.focus();}}
function categories(){screen='categories';movie='';season='';page=1;clear();api(mode,mode==='itv'?'get_genres':'get_categories',{},function(data){row('All',function(){category='*';list();});for(var i=0;i<data.length;i++){(function(c){row(c.title,function(){category=c.id;list();});})(data[i]);}message('');focusFirst();});}
function list(){screen='list';clear();var params={p:page===1?0:page};params[mode==='itv'?'genre':'category']=category;if(movie){params.movie_id=movie;}if(season){params.season_id=season;}
 api(mode,'get_ordered_list',params,function(data){total=data.total_items;for(var i=0;i<data.data.length;i++){(function(item){row((item.number?item.number+'. ':'')+item.name,function(){if(mode==='series'&&!item.cmd){if(item.is_season){season=item.id;}else{movie=item.id;}page=1;list();}else{play(item);}});})(data.data[i]);}message(data.data.length?'': 'No channels available');focusFirst();});}
function play(item){message('Loading...');api(mode,'create_link',{cmd:item.cmd},function(link){var url=link.cmd.replace(/^ffmpeg /,'');if(!/^https?:\\/\\//.test(url)){message('Invalid playback link');return;}playing=true;if(device&&typeof device.Play==='function'){device.Play(url);message(item.name);}else{video.style.display='block';video.src=url;var attempt=video.play();if(attempt&&attempt.catch){attempt.catch(function(){message('Playback unavailable in this browser');});}}});}
function back(){if(playing){if(device&&typeof device.Stop==='function'){device.Stop();}video.pause();video.removeAttribute('src');video.style.display='none';playing=false;message('');return;}if(season){season='';page=1;list();}else if(movie){movie='';page=1;list();}else{categories();}}
document.getElementById('back').onclick=back;
document.getElementById('previous').onclick=function(){if(screen==='list'&&page>1){page--;list();}};
document.getElementById('next').onclick=function(){if(screen==='list'&&page*14<total){page++;list();}};
var buttons=document.getElementById('modes').getElementsByTagName('button');for(var i=0;i<buttons.length;i++){buttons[i].onclick=function(){mode=this.getAttribute('data-mode');categories();};}
document.onkeydown=function(e){e=e||window.event;var code=e.keyCode;if(code===27||code===8||code===461){back();if(e.preventDefault){e.preventDefault();}return false;}if(code===38||code===40||code===37||code===39){var all=document.getElementsByTagName('button'),index=0;for(var j=0;j<all.length;j++){if(all[j]===document.activeElement){index=j;break;}}index=Math.max(0,Math.min(all.length-1,index+((code===38||code===37)?-1:1)));all[index].focus();if(e.preventDefault){e.preventDefault();}return false;}};
try{if(device&&typeof device.GetDeviceMacAddress==='function'){mac=device.GetDeviceMacAddress();}if(device&&typeof device.InitPlayer==='function'){device.InitPlayer();}}catch(e){}
api('stb','handshake',{},function(data){token=data.token;api('stb','get_profile',{},function(){api('stb','get_modules',{},function(){api('stb','get_localization',{},function(){categories();});});});});
})();</script></body></html>`;
  // Old MAG WebKit lacks CSS variables: resolve the screen's semantic tokens
  // at delivery time rather than relying on device-side variable support.
  const tokens = new Map(Array.from(html.matchAll(/(--[a-z]+):([^;}]+)/g), match => [match[1], match[2]]));
  return new Response(html.replace(/var\((--[a-z]+)\)/g, (_, name: string) => tokens.get(name) ?? 'inherit'), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' } });
}