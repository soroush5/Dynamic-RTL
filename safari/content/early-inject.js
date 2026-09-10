/* Dynamic RTL v2.1 - early CSS (document_start). One <style>, zero JS after paint. */
(()=>{'use strict';if(window.__DYNRTL_EARLY__)return;window.__DYNRTL_EARLY__=1;
const api=(typeof chrome!='undefined'&&chrome.runtime)?chrome:browser;
let fontUrl='';try{fontUrl=api.runtime.getURL('fonts/Vazirmatn-Variable.woff2')}catch(_){}
const css="@font-face{font-family:'Vazirmatn DynRTL';src:url(\""+fontUrl+'") format(\'woff2-variations\'),url("'+fontUrl+'") format(\'woff2\');font-weight:100 900;font-style:normal;font-display:swap;unicode-range:U+0600-06FF,U+0750-077F,U+08A0-08FF,U+FB50-FDFF,U+FE70-FEFF;}'
+":root{--dynrtl-font-stack:'Vazirmatn DynRTL','Vazirmatn','Tahoma','Segoe UI',sans-serif;}"
+'.dynrtl-rtl{direction:rtl!important;text-align:right!important;font-family:var(--dynrtl-font-stack)!important;}'
+'.dynrtl-rtl code,.dynrtl-rtl kbd,.dynrtl-rtl samp,.dynrtl-rtl var,.dynrtl-rtl tt,.dynrtl-rtl pre,.dynrtl-rtl [data-dynrtl-keep-ltr]{direction:ltr!important;unicode-bidi:isolate!important;text-align:initial!important;}'
+'.dynrtl-rtl a,.dynrtl-rtl cite,.dynrtl-rtl [role="link"]{unicode-bidi:plaintext!important;text-align:initial!important;}'
+'.dynrtl-rtl-input{font-family:var(--dynrtl-font-stack)!important;text-align:start!important;}'
+'.dynrtl-rtl-input::placeholder{opacity:1;transition:opacity 240ms cubic-bezier(0.2,0,0,1)!important;}'
+'.dynrtl-rtl-input{transition:text-indent 260ms cubic-bezier(0.2,0,0,1)!important;}'
+'.dynrtl-rtl-input:focus:placeholder-shown{text-indent:1.6em!important;}'
+'.dynrtl-rtl-input:focus::placeholder{opacity:0!important;}'
+'@media (prefers-reduced-motion:reduce){.dynrtl-rtl-input,.dynrtl-rtl-input::placeholder{transition:none!important;}.dynrtl-rtl-input:focus:placeholder-shown{text-indent:0!important;}}'
+'.dynrtl-rtl-input-aligned{text-align:right!important;}'
+'[data-dynrtl-skip],[data-dynrtl-skip] *{direction:ltr!important;text-align:initial!important;font-family:inherit!important;}';
function inject(){if(document.getElementById('dynrtl-base-style'))return;const s=document.createElement('style');s.id='dynrtl-base-style';s.setAttribute('data-dynrtl','base');s.textContent=css;const t=document.head||document.documentElement;if(t)t.appendChild(s)}
inject();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:!0});})();
