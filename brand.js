document.querySelectorAll('[data-year]').forEach(el=>{el.textContent=new Date().getFullYear()});
document.querySelectorAll('.top-note').forEach(el=>{el.textContent='Commercial - Residential - Industrial Painting and Refinishing • Northeast Ohio'});
document.querySelectorAll('.links').forEach(links=>{if(!links.querySelector('a[href="regional-updates.html"]')){const link=document.createElement('a');link.href='regional-updates.html';link.textContent='Insights';const about=links.querySelector('a[href="about.html"]');links.insertBefore(link,about||null);}});
document.querySelectorAll('.mobile-panel-inner').forEach(panel=>{if(!panel.querySelector('a[href="regional-updates.html"]')){const link=document.createElement('a');link.href='regional-updates.html';link.textContent='Industry Insights';const about=panel.querySelector('a[href="about.html"]');panel.insertBefore(link,about||null);}});
if(!document.querySelector('link[href^="mobile-polish.css"]')){const polish=document.createElement('link');polish.rel='stylesheet';polish.href='mobile-polish.css';document.head.appendChild(polish);}
if(!document.querySelector('link[rel="icon"]')){const fav=document.createElement('link');fav.rel='icon';fav.type='image/svg+xml';fav.href='favicon.svg';document.head.appendChild(fav);}
(function(){const id='G-XN257ZSZ7H';if(window.__sgxGaLoaded)return;window.__sgxGaLoaded=true;window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config',id);const ga=document.createElement('script');ga.async=true;ga.src='https://www.googletagmanager.com/gtag/js?id='+id;document.head.appendChild(ga);})();
fetch('data/site-settings.json?ts='+Date.now()).then(r=>r.ok?r.json():null).then(s=>{if(s&&s.logo){document.querySelectorAll('.brand-logo,.footer-logo,.home-footer-logo').forEach(img=>{img.src=s.logo+'?ts='+Date.now();});}}).catch(()=>{});
document.querySelectorAll('.footer-grid').forEach(grid=>{const copy=grid.children&&grid.children[1];if(copy){copy.innerHTML='© <span data-year>'+new Date().getFullYear()+'</span> Spray GenX LLC. Professional Painting • Refinishing • Commercial Coatings <span class="footer-inline-links"><span>•</span><a href="gallery.html">Portfolio</a><span>•</span><a href="regional-updates.html">Industry Insights</a><span>•</span><a href="photo-library.html">Image Library</a></span>';}});
document.querySelectorAll('.socials').forEach(el=>{el.innerHTML='<a href="https://www.facebook.com/spraygenx" target="_blank" rel="noopener" aria-label="Spray GenX on Facebook">f</a>';});
const shareUrl=location.origin+location.pathname;
const shareText='Spray GenX LLC - Commercial, residential, and industrial painting in Northeast Ohio.';
function trackEvent(name,params){if(window.gtag)window.gtag('event',name,params||{});}
function shareSprayGenX(){trackEvent('share_click',{page_title:document.title,page_location:location.href});if(navigator.share){navigator.share({title:document.title,text:shareText,url:shareUrl}).catch(()=>{});return;}const subject=encodeURIComponent('Spray GenX LLC');const body=encodeURIComponent(shareText+'\n\n'+shareUrl);window.location.href='mailto:?subject='+subject+'&body='+body;}
const menuButton=document.getElementById('mobileMenuButton');
const mobilePanel=document.getElementById('mobilePanel');
if(menuButton&&mobilePanel){
  menuButton.addEventListener('click',()=>{
    const isOpen=mobilePanel.classList.toggle('open');
    menuButton.setAttribute('aria-expanded',isOpen?'true':'false');
    menuButton.textContent=isOpen?'×':'☰';
  });
  mobilePanel.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
    mobilePanel.classList.remove('open');
    menuButton.setAttribute('aria-expanded','false');
    menuButton.textContent='☰';
  }));
}
const shareButton=document.createElement('button');
shareButton.className='share-site-button';
shareButton.type='button';
shareButton.setAttribute('aria-label','Share Spray GenX');
shareButton.innerHTML='<svg class="svg-icon" aria-hidden="true"><use href="icons.svg#i-share"></use></svg><span>Share</span>';
document.body.appendChild(shareButton);
shareButton.addEventListener('click',shareSprayGenX);
const backToTop=document.createElement('button');
backToTop.className='back-to-top';
backToTop.type='button';
backToTop.setAttribute('aria-label','Back to top');
backToTop.textContent='↑';
document.body.appendChild(backToTop);
const prefersReduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function toggleBackToTop(){backToTop.classList.toggle('visible',window.scrollY>360)}
window.addEventListener('scroll',toggleBackToTop,{passive:true});
toggleBackToTop();
backToTop.addEventListener('click',()=>{window.scrollTo({top:0,behavior:prefersReduced?'auto':'smooth'})});
document.querySelectorAll('a[href^="#"]').forEach(a=>{a.addEventListener('click',e=>{const id=a.getAttribute('href');if(id&&id.length>1){const target=document.querySelector(id);if(target){e.preventDefault();target.scrollIntoView({behavior:prefersReduced?'auto':'smooth',block:'start'});}}})});
const emailButton=document.getElementById('emailButton');
const estimateForm=document.getElementById('estimateForm');
const emailAddress='Spray'+'GenX'+'@'+'gmail'+'.com';
if(emailButton){emailButton.addEventListener('click',()=>{trackEvent('email_click',{page_location:location.href});window.location.href='mailto:'+emailAddress+'?subject='+encodeURIComponent('Estimate Request')});}
if(estimateForm){estimateForm.addEventListener('submit',e=>{e.preventDefault();trackEvent('estimate_form_submit',{page_location:location.href});const d=new FormData(e.currentTarget);const body=['Name: '+(d.get('name')||''),'Phone: '+(d.get('phone')||''),'Project Address: '+(d.get('address')||''),'Project Type: '+(d.get('type')||''),'','Project Details:',d.get('details')||'','','Photos can be attached to this email.'].join('\n');window.location.href='mailto:'+emailAddress+'?subject='+encodeURIComponent('Spray GenX Estimate Request')+'&body='+encodeURIComponent(body);});}
