document.querySelectorAll('[data-year]').forEach(el=>{el.textContent=new Date().getFullYear()});
document.querySelectorAll('.top-note').forEach(el=>{el.textContent='Commercial - Residential - Industrial Painting and Refinishing • Northeast Ohio'});

function linkPath(link){try{return new URL(link.href,location.href).pathname}catch(_){return ''}}
function hasLink(container,path){return Array.from(container.querySelectorAll('a')).some(link=>linkPath(link)===path)}
function insertMenuLink(container,path,label,beforePaths=[]){
  if(hasLink(container,path))return;
  const link=document.createElement('a');
  link.href=path;
  link.textContent=label;
  if(location.pathname===path)link.classList.add('active');
  const before=Array.from(container.querySelectorAll('a')).find(item=>beforePaths.includes(linkPath(item)));
  container.insertBefore(link,before||null);
}

document.querySelectorAll('.links').forEach(links=>{
  insertMenuLink(links,'/latest.html','Latest',['/regional-updates.html','/about.html']);
  insertMenuLink(links,'/regional-updates.html','Insights',['/about.html']);
});
document.querySelectorAll('.mobile-panel-inner').forEach(panel=>{
  insertMenuLink(panel,'/latest.html','Latest',['/regional-updates.html','/about.html']);
  insertMenuLink(panel,'/regional-updates.html','Industry Insights',['/about.html']);
});

if(!document.querySelector('link[href="/mobile-polish.css"]')){const polish=document.createElement('link');polish.rel='stylesheet';polish.href='/mobile-polish.css';document.head.appendChild(polish);}
if(!document.querySelector('link[href="/latest-content.css"]')){const latestCss=document.createElement('link');latestCss.rel='stylesheet';latestCss.href='/latest-content.css';document.head.appendChild(latestCss);}
if(!document.querySelector('link[rel="icon"]')){const fav=document.createElement('link');fav.rel='icon';fav.type='image/svg+xml';fav.href='/favicon.svg';document.head.appendChild(fav);}
if(!document.querySelector('script[src="/breadcrumbs.js"]')){const breadcrumbs=document.createElement('script');breadcrumbs.src='/breadcrumbs.js';document.head.appendChild(breadcrumbs);}

(function(){const id='G-XN257ZSZ7H';if(window.__sgxGaLoaded)return;window.__sgxGaLoaded=true;window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config',id);const ga=document.createElement('script');ga.async=true;ga.src='https://www.googletagmanager.com/gtag/js?id='+id;document.head.appendChild(ga);})();

fetch('/data/site-settings.json?ts='+Date.now()).then(r=>r.ok?r.json():null).then(s=>{if(s&&s.logo){const logoUrl=new URL(s.logo,location.origin+'/').href;document.querySelectorAll('.brand-logo,.footer-logo,.home-footer-logo').forEach(img=>{img.src=logoUrl+'?ts='+Date.now();});}}).catch(()=>{});

document.querySelectorAll('.footer-grid').forEach(grid=>{const copy=grid.children&&grid.children[1];if(copy){copy.innerHTML='© <span data-year>'+new Date().getFullYear()+'</span> Spray GenX LLC. Professional Painting • Refinishing • Commercial Coatings <span class="footer-inline-links"><span>•</span><a href="/gallery.html">Portfolio</a><span>•</span><a href="/latest.html">Latest</a><span>•</span><a href="/regional-updates.html">Industry Insights</a><span>•</span><a href="/photo-library.html">Image Library</a></span>';}});
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
shareButton.innerHTML='<svg class="svg-icon" aria-hidden="true"><use href="/icons.svg#i-share"></use></svg><span>Share</span>';
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

const LATEST_EXCLUDED_PATHS=new Set([
  '/',
  '/index.html',
  '/services.html',
  '/gallery.html',
  '/photo-library.html',
  '/about.html',
  '/reviews.html',
  '/contact.html',
  '/report-about.html',
  '/latest.html',
  '/restoration-projects/'
]);

function escapeLatest(value){return String(value||'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char]));}
function cleanLatestTitle(value){return String(value||'Spray GenX Update').split(/\s+\|\s+/)[0].trim();}
function inferLatestSection(path,title){
  const haystack=(path+' '+title).toLowerCase();
  if(haystack.includes('restoration'))return 'Historic Restoration';
  if(haystack.includes('regional-update')||haystack.includes('coatings report')||haystack.includes('industry'))return 'Industry Insights';
  if(haystack.includes('ceiling'))return 'Technical Service';
  if(haystack.includes('case-study')||haystack.includes('project'))return 'Project Case Study';
  return 'Spray GenX Update';
}
function formatLatestDate(value){
  if(!value)return '';
  const date=new Date(value+'T12:00:00');
  return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(date);
}
function absoluteLatestImage(raw,pagePath){
  if(!raw)return '/images/hero-image-cropped.jpg';
  try{return new URL(raw,new URL(pagePath,location.origin)).href}catch(_){return '/images/hero-image-cropped.jpg'}
}
async function fetchLatestPage(entry){
  try{
    const response=await fetch(entry.path+(entry.path.includes('?')?'&':'?')+'sgxmeta='+Date.now());
    if(!response.ok)return null;
    const html=await response.text();
    const doc=new DOMParser().parseFromString(html,'text/html');
    const robots=(doc.querySelector('meta[name="robots"]')?.content||'').toLowerCase();
    if(robots.includes('noindex')||doc.querySelector('meta[http-equiv="refresh" i]'))return null;
    const title=cleanLatestTitle(doc.querySelector('meta[property="og:title"]')?.content||doc.title);
    const description=doc.querySelector('meta[property="og:description"]')?.content||doc.querySelector('meta[name="description"]')?.content||'New Spray GenX project and technical content.';
    const image=absoluteLatestImage(doc.querySelector('meta[property="og:image"]')?.content||doc.querySelector('.hero-bg,.case-hero img,.case-card img,img')?.getAttribute('src'),entry.path);
    return {path:entry.path,lastmod:entry.lastmod,title,description,image,section:inferLatestSection(entry.path,title)};
  }catch(_){return null;}
}
async function loadLatestItems(){
  const response=await fetch('/sitemap.xml?ts='+Date.now());
  if(!response.ok)throw new Error('Unable to load sitemap');
  const xml=new DOMParser().parseFromString(await response.text(),'application/xml');
  if(xml.querySelector('parsererror'))throw new Error('Invalid sitemap');
  const entries=Array.from(xml.querySelectorAll('url')).map(node=>{
    const loc=node.querySelector('loc')?.textContent?.trim()||'';
    const lastmod=node.querySelector('lastmod')?.textContent?.trim()||'';
    let path='';
    try{path=new URL(loc,location.origin).pathname}catch(_){path=''}
    return {path,lastmod};
  }).filter(entry=>entry.path&&!LATEST_EXCLUDED_PATHS.has(entry.path));
  entries.sort((a,b)=>String(b.lastmod).localeCompare(String(a.lastmod))||a.path.localeCompare(b.path));
  const details=await Promise.all(entries.slice(0,24).map(fetchLatestPage));
  return details.filter(Boolean).sort((a,b)=>String(b.lastmod).localeCompare(String(a.lastmod))||a.title.localeCompare(b.title));
}
function latestCard(item){
  return `<a class="latest-card" href="${escapeLatest(item.path)}"><span class="latest-card-image"><img loading="lazy" src="${escapeLatest(item.image)}" alt="${escapeLatest(item.title)}"></span><span class="latest-card-body"><span class="latest-card-meta"><span class="latest-card-section">${escapeLatest(item.section)}</span>${item.lastmod?`<span class="latest-card-date">${escapeLatest(formatLatestDate(item.lastmod))}</span>`:''}</span><h3>${escapeLatest(item.title)}</h3><p>${escapeLatest(item.description)}</p><span class="latest-card-arrow">Read More →</span></span></a>`;
}
function renderLatest(container,items,limit){
  const selected=limit?items.slice(0,limit):items;
  container.innerHTML=selected.length?selected.map(latestCard).join(''):'<div class="latest-empty">No recently published pages are available yet.</div>';
}
function ensureHomepageLatestSection(){
  const path=location.pathname;
  if(path!=='/'&&path!=='/index.html')return null;
  let section=document.getElementById('homeLatestSection');
  if(section)return section.querySelector('#homeLatestContent');
  const anchor=document.querySelector('.home-footer-panels');
  if(!anchor)return null;
  section=document.createElement('section');
  section.id='homeLatestSection';
  section.className='latest-home';
  section.innerHTML='<div class="shell"><div class="section-head"><div><div class="section-label">New on SprayGenX.com</div><h2>Latest projects and technical content</h2></div><a class="btn" href="/latest.html">View Everything New →</a></div><div class="latest-grid" id="homeLatestContent"><div class="latest-empty">Loading the latest Spray GenX content…</div></div></div>';
  anchor.parentNode.insertBefore(section,anchor);
  return section.querySelector('#homeLatestContent');
}

const homeLatest=ensureHomepageLatestSection();
const archiveLatest=document.getElementById('latestContentArchive');
if(homeLatest||archiveLatest){
  loadLatestItems().then(items=>{
    if(homeLatest)renderLatest(homeLatest,items,3);
    if(archiveLatest)renderLatest(archiveLatest,items,0);
  }).catch(()=>{
    const fallback='<a class="latest-card" href="/restoration-projects/riley-house-twinsburg/"><span class="latest-card-image"><img loading="lazy" src="https://i0.wp.com/twinsburghistoricalsociety.org/wp-content/uploads/2023/01/69732441_469510443889708_1449842562398420992_o.jpg?resize=900%2C675&ssl=1" alt="Riley House exterior restoration"></span><span class="latest-card-body"><span class="latest-card-meta"><span class="latest-card-section">Historic Restoration</span></span><h3>Riley House Exterior Restoration</h3><p>Preservation-focused exterior restoration and field documentation in Twinsburg, Ohio.</p><span class="latest-card-arrow">Read Case Study →</span></span></a>';
    if(homeLatest)homeLatest.innerHTML=fallback;
    if(archiveLatest)archiveLatest.innerHTML=fallback;
  });
}

if(location.pathname.startsWith('/restoration-projects/riley-house-twinsburg/')){
  const gallery=document.querySelector('.gallery');
  if(gallery&&!document.querySelector('.sgx-photo-credit')){
    const credit=document.createElement('p');
    credit.className='sgx-photo-credit';
    credit.innerHTML='<strong>Photography credit:</strong> Every Riley House photograph shown here was taken by Denny Smith of Spray GenX LLC as original project and field documentation. The Twinsburg Historical Society hosts copies of selected photographs on its project page.';
    gallery.parentNode.insertBefore(credit,gallery);
  }
}
