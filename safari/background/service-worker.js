/* Dynamic RTL v2.1 - background (MV3 service worker / Firefox background page).
 * Event-driven only: icon paint + toggle + install migration. No per-tab
 * badge churn, no callback-pyramid helpers; tiny promise wrappers.
 */
'use strict';
const api=(typeof chrome!='undefined'&&chrome.runtime)?chrome:browser;
const DEF={mode:'enable_all',siteOverrides:{},font:'vazirmatn',customFontDataUrl:'',customFontName:'',customFontFormat:'',debug:!1};
const sget=(k)=>new Promise((r)=>{try{api.storage.local.get(k,(x)=>{void api.runtime.lastError;r(x||{})})}catch(_){r({})}});
const sset=(p)=>new Promise((r)=>{try{api.storage.local.set(p,()=>{void api.runtime.lastError;r()})}catch(_){r()}});
const sdel=(k)=>new Promise((r)=>{try{api.storage.local.remove(k,()=>{void api.runtime.lastError;r()})}catch(_){r()}});
const tget=(id)=>new Promise((r,j)=>{try{api.tabs.get(id,(t)=>{const e=api.runtime.lastError;e?j(new Error(e.message||String(e))):r(t)})}catch(e){j(e)}});
const tq=(q)=>new Promise((r)=>{try{api.tabs.query(q,(t)=>{void api.runtime.lastError;r(t||[])})}catch(_){r([])}});
function tmsg(tabId,msg){return new Promise((res)=>{try{api.tabs.sendMessage(tabId,msg,{frameId:0},(rp)=>{void api.runtime.lastError;res(rp||null)})}catch(_){res(null)}})}
function setIcon(o){try{const r=api.action.setIcon(o);if(r&&r.then)r.catch(()=>{})}catch(_){}}
const normH=(h)=>(h||'').toLowerCase().replace(/^www\./,'');
function findOv(o,h){if(!o)return null;h=normH(h);if(!h)return null;if(o[h])return o[h];const p=h.split('.');for(let i=1;i<p.length-1;i++){const q=p.slice(i).join('.');if(o[q])return o[q]}return null}
function siteOn(s,h){const o=findOv(s.siteOverrides,h);if(o==='on')return!0;if(o==='off')return!1;return s.mode==='enable_all'}
async function loadS(){return Object.assign({},DEF,await sget(null))}
function hostOf(tab){try{if(!tab||!tab.url)return'';const u=new URL(tab.url);if(!/^(https?|file|ftp):/.test(u.protocol))return'';return u.hostname||''}catch(_){return''}}
const ICON_ON={16:'icons/icon-active-16.png',32:'icons/icon-active-32.png',48:'icons/icon-active-48.png',128:'icons/icon-active-128.png'};
const ICON_OFF={16:'icons/icon-inactive-16.png',32:'icons/icon-inactive-32.png',48:'icons/icon-inactive-48.png',128:'icons/icon-inactive-128.png'};
async function paint(tab){try{if(!tab||tab.id==null)return;const host=hostOf(tab);if(!host){setIcon({tabId:tab.id,path:ICON_OFF});return}
let en=null;const rp=await tmsg(tab.id,{type:'DYNRTL_GET_STATE'});if(rp&&typeof rp.active=='boolean')en=rp.active;
if(en===null)en=siteOn(await loadS(),host);setIcon({tabId:tab.id,path:en?ICON_ON:ICON_OFF})}catch(_){}}
async function paintAll(){try{const tabs=await tq({});await Promise.all(tabs.map(paint))}catch(_){}}
async function toggle(tabId){let tab;try{tab=await tget(tabId)}catch(_){return{ok:!1,reason:'no-tab'}}
const host=hostOf(tab);if(!host)return{ok:!1,reason:'no-host'};
const s=await loadS(),ov=Object.assign({},s.siteOverrides||{});
let cur=null;const rp=await tmsg(tabId,{type:'DYNRTL_GET_STATE'});if(rp&&typeof rp.active=='boolean')cur=rp.active;
if(cur===null)cur=siteOn(s,host);
const next=cur?'off':'on';ov[normH(host)]=next;await sset({siteOverrides:ov});
try{api.tabs.sendMessage(tabId,{type:'DYNRTL_RECONCILE'},()=>void api.runtime.lastError)}catch(_){}
await paint(tab);return{ok:!0,host:normH(host),state:next}}
async function migrate(){try{const st=await sget(null);const patch={};let mg=!1;
if(Array.isArray(st.exceptions)&&st.exceptions.length){const ov=Object.assign({},st.siteOverrides||{});const off=(st.mode||DEF.mode)==='enable_all'?'off':'on';
for(const e of st.exceptions){const h=normH(e);if(h&&!ov[h])ov[h]=off}patch.siteOverrides=ov;mg=!0}
if(mg)await sset(patch);
const leg=['exceptions','enabled','autoDetectInputs'].filter((k)=>k in st);if(leg.length)await sdel(leg)}catch(e){console.error('[Dynamic RTL] migration error',e)}}
async function seed(){try{const st=await loadS();const p={};for(const k of Object.keys(DEF))if(st[k]===undefined)p[k]=DEF[k];if(Object.keys(p).length)await sset(p)}catch(e){console.error('[Dynamic RTL] seed error',e)}}
api.runtime.onInstalled.addListener(async()=>{await migrate();await seed();paintAll()});
if(api.runtime.onStartup&&api.runtime.onStartup.addListener)api.runtime.onStartup.addListener(async()=>{await migrate();paintAll()});
api.tabs.onActivated.addListener(async({tabId})=>{try{paint(await tget(tabId))}catch(_){}});
api.tabs.onUpdated.addListener((tabId,ci,tab)=>{if(ci.status==='loading'||ci.url)paint(tab)});
api.storage.onChanged.addListener((ch,area)=>{if(area!=='local')return;if('siteOverrides'in ch||'mode'in ch)paintAll()});
api.runtime.onMessage.addListener((msg,sender,sendResponse)=>{if(!msg||!msg.type)return;
if(msg.type==='DYNRTL_TOGGLE_CURRENT'){const id=msg.tabId||(sender.tab&&sender.tab.id);if(id==null){sendResponse({ok:!1,reason:'no-tab'});return!0}
toggle(id).then(sendResponse).catch((e)=>sendResponse({ok:!1,reason:'error',error:String(e)}));return!0}
if(msg.type==='DYNRTL_REFRESH_ICONS'){paintAll().then(()=>sendResponse({ok:!0}));return!0}
if(msg.type==='DYNRTL_REPORT_STATE'){const id=sender.tab&&sender.tab.id;if(id!=null)setIcon({tabId:id,path:msg.active?ICON_ON:ICON_OFF});sendResponse({ok:!0});return!0}});
