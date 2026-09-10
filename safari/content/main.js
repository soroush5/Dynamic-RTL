/* Dynamic RTL: finds Persian/Arabic text on the page and flips it RTL. */
(()=>{'use strict';if(window.__DYNRTL__)return;window.__DYNRTL__=1;
const api=(typeof chrome!='undefined'&&chrome.runtime)?chrome:browser;
const RTL_RE=/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const SKIP=new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','OBJECT','EMBED','CANVAS','SVG','VIDEO','AUDIO','CODE','PRE','KBD','SAMP','TT','XMP','TEMPLATE']);
const SKIP_SEL='.kix-page,.kix-canvas-tile-content,.docs-texteventtarget-iframe,.waffle,.punch-viewer,.CodeMirror,.monaco-editor,.ace_editor';
const INLINE=new Set(['A','ABBR','B','BDI','BDO','BIG','BR','CITE','CODE','DATA','DFN','EM','I','KBD','MARK','Q','S','SAMP','SMALL','SPAN','STRONG','SUB','SUP','TIME','U','VAR','WBR','FONT','LABEL']);
const LAND=new Set(['BODY','HTML','HEAD','MAIN','NAV','HEADER','FOOTER','ASIDE','SECTION','ARTICLE','DIALOG','FORM']);
const DEF={mode:'enable_all',siteOverrides:{},font:'vazirmatn',customFontDataUrl:'',customFontName:'',customFontFormat:'',debug:!1};
const top=window.top===window;
let S=Object.assign({},DEF),on=!1;
const dirty=new Set();
let timer=0,queued=!1,mo=null,cool=!1,coolT=0,coolLv=0,trips=[];
let shadowHosts=[];
let inputOn=!1;
const idle=window.requestIdleCallback?(cb)=>window.requestIdleCallback(cb,{timeout:180}):(cb)=>setTimeout(cb,32);
const now=()=>performance.now();
const normH=(h)=>(h||'').toLowerCase().replace(/^www\./,'');
function findOv(o,h){if(!o)return null;h=normH(h);if(!h)return null;if(o[h])return o[h];const p=h.split('.');for(let i=1;i<p.length-1;i++){const q=p.slice(i).join('.');if(o[q])return o[q]}return null}
function isRtlLang(v){if(!v)return!1;return v==='fa'||v==='ar'}
function docIsRtl(){try{const h=document.documentElement;if(!h)return!1;const l=(h.getAttribute('lang')||'').toLowerCase().trim().split(/[-_]/)[0];if(isRtlLang(l))return!0;if((h.getAttribute('dir')||'').toLowerCase()==='rtl')return!0}catch(_){}return!1}
function skippable(el){if(!el||el.nodeType!==1)return!0;const t=el.tagName;if(t&&SKIP.has(t))return!0;if(el.hasAttribute&&el.hasAttribute('data-dynrtl-skip'))return!0;try{if(el.matches(SKIP_SEL))return!0}catch(_){}return!1}
function inEditor(el){let c=el;for(let i=0;c&&c.nodeType===1&&i<4;i++){const ce=c.getAttribute&&c.getAttribute('contenteditable');if(ce==='false')return!1;if(ce==='true'||ce===''||ce==='plaintext-only')return!0;c=c.parentNode}return!1}
function hasTagged(el){let c=el;for(let i=0;c&&i<8;i++){if(c.__d)return!0;c=c.parentElement}return!1}
function blockAnc(el){if(!el)return null;let c=el,li=null;for(let i=0;c&&i<5;i++){if(c.nodeType!==1){c=c.parentNode;continue}if(LAND.has(c.tagName))return li;if(!INLINE.has(c.tagName))return c;li=c;c=c.parentNode}return null}
function tag(el){if(!el||el.nodeType!==1||el.__d)return;if(el.tagName&&LAND.has(el.tagName))return;if(el.tagName==='INPUT'||el.tagName==='TEXTAREA')return;if(inEditor(el))return;if(el.children&&el.children.length>200)return;try{el.classList.add('dynrtl-rtl')}catch(_){}el.__d=1}
function procText(t){const v=t.nodeValue;if(!v||!RTL_RE.test(v))return;const p=t.parentElement;if(!p||p.__d||hasTagged(p))return;if(skippable(p)||inEditor(p))return;const b=blockAnc(p);if(b)tag(b)}
function walk(root,budget,shadowOut){if(!root)return budget;if(root.nodeType===1){if(root.__d||skippable(root))return budget}
let tw;try{tw=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{acceptNode(n){if(n.nodeType===1){if(n.__d)return NodeFilter.FILTER_REJECT;const tg=n.tagName;if(tg&&SKIP.has(tg))return NodeFilter.FILTER_REJECT;try{if(n.matches(SKIP_SEL))return NodeFilter.FILTER_REJECT}catch(_){}if(n.shadowRoot&&!n.__ds)shadowOut.push(n);return NodeFilter.FILTER_SKIP}const p=n.parentElement;if(!p||p.__d)return NodeFilter.FILTER_REJECT;if(!n.nodeValue||!RTL_RE.test(n.nodeValue))return NodeFilter.FILTER_SKIP;return NodeFilter.FILTER_ACCEPT}})}catch(_){return budget}
let n;while((n=tw.nextNode())){procText(n);if(--budget<=0)return budget}return budget}
function walkTree(root,budget){if(budget==null)budget=1000;if(!root)return budget;const st=[root];while(st.length){const nd=st.pop();if(!nd)continue;const out=[];if(nd.nodeType===1||nd.nodeType===11||nd.nodeType===9){budget=walk(nd,budget,out);if(budget<=0)return budget;for(let i=0;i<out.length;i++){obsShadow(out[i].shadowRoot,out[i]);st.push(out[i].shadowRoot)}}else if(nd.nodeType===3&&nd.parentElement)procText(nd)}return budget}
function applyInput(el){if(!el||el.nodeType!==1||el.__di)return;el.__di=1;try{if(!el.hasAttribute('dir'))el.setAttribute('dir','auto')}catch(_){}try{el.classList.add('dynrtl-rtl-input')}catch(_){}}
function onFocus(ev){const t=ev.target;if(!t||t.nodeType!==1)return;if(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable)applyInput(t)}
function attInput(){if(inputOn)return;inputOn=!0;document.addEventListener('focusin',onFocus,!0)}
function detInput(){if(!inputOn)return;inputOn=!1;document.removeEventListener('focusin',onFocus,!0)}
function markDirty(el){if(!el)return;if(dirty.size>256){dirty.clear();const r=document.body||document.documentElement;if(r)dirty.add(r);return}dirty.add(el)}
function schedule(){if(cool||queued||timer)return;if(document.readyState==='loading'){timer=setTimeout(()=>{timer=0;flush()},0);return}timer=setTimeout(()=>{timer=0;queued=!0;idle(flush)},120)}
function flush(){queued=!1;if(!on||cool)return;const t0=now();const list=Array.from(dirty);dirty.clear();let budget=1000,over=!1;for(let i=0;i<list.length;i++){const el=list[i];if(!el)continue;if(el.nodeType===1&&!el.isConnected)continue;try{budget=walkTree(el,budget)}catch(_){}if(budget<=0||now()-t0>10){for(let j=i+1;j<list.length;j++)if(list[j])dirty.add(list[j]);over=!0;break}}
const dur=now()-t0;if(over&&dur>=12){trip();return}if(dirty.size)schedule()}
function trip(){const t=now();trips.push(t);trips=trips.filter((x)=>t-x<4000);coolLv=Math.min(coolLv+(trips.length>=3?2:1),8);
const wait=Math.min(800*Math.pow(2,coolLv-1),6000);cool=!0;stopObs();if(timer){clearTimeout(timer);timer=0}queued=!1;dirty.clear();if(coolT)clearTimeout(coolT);coolT=setTimeout(uncool,wait)}
function uncool(){coolT=0;if(!on){cool=!1;return}cool=!1;startObs();const r=document.body||document.documentElement;if(r){dirty.add(r);queued=!0;idle(flush)}}
function onMut(muts){if(!on||cool)return;if(muts.length>80&&document.readyState!=='loading'){trip();return}let w=!1;for(let i=0;i<muts.length;i++){const m=muts[i];if(m.type!=='childList')continue;const a=m.addedNodes;for(let j=0;j<a.length;j++){const n=a[j];if(n.nodeType===1){markDirty(n);w=!0;if(n.shadowRoot)obsShadow(n.shadowRoot,n)}else if(n.nodeType===3&&n.parentElement){markDirty(n.parentElement);w=!0}}}if(w)schedule()}
function obsShadow(sr,host){if(!sr||!host||host.__ds)return;host.__ds=1;shadowHosts.push(host);try{const o=new MutationObserver(onMut);o.observe(sr,{subtree:!0,childList:!0});(o.__h=host,shadowObs.push(o))}catch(_){}}
const shadowObs=[];
function startObs(){if(mo)return;const t=document.body||document.documentElement||document;mo=new MutationObserver(onMut);try{mo.observe(t,{subtree:!0,childList:!0})}catch(_){}}
function stopObs(){if(mo){try{mo.disconnect()}catch(_){}mo=null}for(const o of shadowObs){try{o.disconnect()}catch(_){}}shadowObs.length=0;for(const h of shadowHosts){try{h.__ds=0}catch(_){}}shadowHosts=[]}
function applyFont(){const id='dynrtl-custom-font-style';let st=document.getElementById(id);if(S.font==='custom'&&S.customFontDataUrl){const fmt=S.customFontFormat||'woff2-variations';const css="@font-face{font-family:'DynRTL Custom';src:url(\""+S.customFontDataUrl+'") format("'+fmt+'"),url("'+S.customFontDataUrl+'");font-weight:100 900;font-style:normal;font-display:swap;}:root{--dynrtl-font-stack:\'DynRTL Custom\',\'Vazirmatn DynRTL\',\'Vazirmatn\',\'Tahoma\',sans-serif;}';if(!st){st=document.createElement('style');st.id=id;(document.head||document.documentElement).appendChild(st)}st.textContent=css}else if(st)st.remove()}
function activate(){if(on)return;on=!0;coolLv=0;trips=[];applyFont();attInput();startObs();markDirty(document.body||document.documentElement);schedule()}
function deactivate(){if(!on)return;on=!1;stopObs();detInput();if(timer){clearTimeout(timer);timer=0}if(coolT){clearTimeout(coolT);coolT=0}cool=!1;queued=!1;dirty.clear();try{const els=document.querySelectorAll('.dynrtl-rtl,.dynrtl-rtl-input,.dynrtl-rtl-input-aligned');for(let i=0;i<els.length;i++){const e=els[i];e.classList.remove('dynrtl-rtl');e.classList.remove('dynrtl-rtl-input');e.classList.remove('dynrtl-rtl-input-aligned');try{e.__d=0;e.__di=0}catch(_){}}}catch(_){}const cs=document.getElementById('dynrtl-custom-font-style');if(cs)cs.remove()}
function autoSkipped(){if(findOv(S.siteOverrides,location.hostname))return!1;if(S.mode!=='enable_all')return!1;return docIsRtl()}
function computeActive(){const o=findOv(S.siteOverrides,location.hostname);if(o==='on')return!0;if(o==='off')return!1;if(S.mode!=='enable_all')return!1;if(docIsRtl())return!1;return!0}
function report(en){if(!top)return;try{api.runtime.sendMessage({type:'DYNRTL_REPORT_STATE',active:!!en,autoSkipped:autoSkipped()},()=>void api.runtime.lastError)}catch(_){}}
function reconcile(){const en=computeActive();if(en&&!on)activate();else if(!en&&on)deactivate();else if(en&&on)applyFont();report(en)}
function loadS(){return new Promise((res)=>{try{api.storage.local.get(null,(st)=>{S=Object.assign({},DEF,st||{});res(S)})}catch(_){res(S)}})}
api.storage.onChanged.addListener((ch,area)=>{if(area!=='local')return;let t=!1;for(const k of Object.keys(ch)){if(k in DEF){S[k]=ch[k].newValue!==undefined?ch[k].newValue:DEF[k];t=!0}}if(t)reconcile()});
api.runtime.onMessage.addListener((msg,sender,sendResponse)=>{if(!msg||!msg.type)return;if(msg.type==='DYNRTL_GET_STATE'){if(!top)return;sendResponse({host:location.hostname,active:on,autoSkipped:autoSkipped(),settings:S});return!0}if(msg.type==='DYNRTL_RECONCILE'){loadS().then(reconcile);sendResponse({ok:!0});return!0}});
function boot(){if(boot.done)return;boot.done=!0;reconcile()}
// Tag right away with defaults; settings arrive a moment later and correct us.
try{if(!docIsRtl())activate()}catch(_){}
loadS().then(()=>{boot()});
window.addEventListener('pagehide',()=>{stopObs();detInput();if(timer)clearTimeout(timer);if(coolT)clearTimeout(coolT)},{once:!0})})();
