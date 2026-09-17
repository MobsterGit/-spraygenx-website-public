(function(){
  'use strict';

  const robots=(document.querySelector('meta[name="robots"]')?.content||'').toLowerCase();
  if(robots.includes('noindex')||document.querySelector('meta[http-equiv="refresh" i]'))return;

  const canonicalOrigin='https://spraygenx.com';
  const normalizePath=value=>{
    let path=value||'/';
    try{path=new URL(path,location.origin).pathname}catch(_){path='/'}
    if(path!=='/'&&!path.endsWith('/')&&/\/index\.html$/i.test(path))path=path.replace(/index\.html$/i,'');
    return path||'/';
  };
  const currentPath=normalizePath(location.pathname);
  if(currentPath==='/'||currentPath==='/index.html')return;

  const pageTitle=()=>{
    const og=document.querySelector('meta[property="og:title"]')?.content;
    const heading=document.querySelector('main h1, .field-report-hero h1, .case-intro h1');
    const raw=(og||heading?.textContent||document.title||'Spray GenX').trim();
    return raw.split(/\s+\|\s+/)[0].trim();
  };

  const item=(name,path)=>({name,path:normalizePath(path)});
  const trails={
    '/about.html':[item('Home','/'),item('About','/about.html')],
    '/services.html':[item('Home','/'),item('Services','/services.html')],
    '/gallery.html':[item('Home','/'),item('Portfolio','/gallery.html')],
    '/reviews.html':[item('Home','/'),item('Reviews','/reviews.html')],
    '/contact.html':[item('Home','/'),item('Contact','/contact.html')],
    '/latest.html':[item('Home','/'),item('Latest Projects and Content','/latest.html')],
    '/photo-library.html':[item('Home','/'),item('Portfolio','/gallery.html'),item('Image Library','/photo-library.html')],
    '/industrial-ceiling-painting/':[item('Home','/'),item('Services','/services.html'),item('Industrial Ceiling Painting','/industrial-ceiling-painting/')],
    '/restoration-projects/':[item('Home','/'),item('Portfolio','/gallery.html'),item('Historic Restoration Projects','/restoration-projects/')],
    '/restoration-projects/riley-house-twinsburg/':[item('Home','/'),item('Portfolio','/gallery.html'),item('Historic Restoration Projects','/restoration-projects/'),item('Riley House Exterior Restoration','/restoration-projects/riley-house-twinsburg/')],
    '/regional-updates.html':[item('Home','/'),item('Industry Insights','/regional-updates.html')],
    '/report-about.html':[item('Home','/'),item('Industry Insights','/regional-updates.html'),item('Editorial Standards','/report-about.html')],
    '/reports/flat-black-open-deck-ceiling-painting/':[item('Home','/'),item('Industry Insights','/regional-updates.html'),item('Flat Black and Open-Deck Ceiling Painting','/reports/flat-black-open-deck-ceiling-painting/')],
    '/flat-black-ceiling-spray/':[item('Home','/'),item('Services','/services.html'),item('Industrial Ceiling Painting','/industrial-ceiling-painting/'),item('Flat Black Ceiling Spray Painting','/flat-black-ceiling-spray/')],
    '/commercial-dryfall-ceiling-painting-dealership/':[item('Home','/'),item('Services','/services.html'),item('Industrial Ceiling Painting','/industrial-ceiling-painting/'),item('Dealership Dryfall Ceiling Painting','/commercial-dryfall-ceiling-painting-dealership/')],
    '/industrial-painting/dry-fall-painting/':[item('Home','/'),item('Services','/services.html'),item('Industrial Ceiling Painting','/industrial-ceiling-painting/'),item('Dry-Fall Painting','/industrial-painting/dry-fall-painting/')],
    '/spray-genx-industrial-painting/':[item('Home','/'),item('Services','/services.html'),item('Industrial Painting','/spray-genx-industrial-painting/')],
    '/industrial-spray/':[item('Home','/'),item('Services','/services.html'),item('Industrial Spray Painting','/industrial-spray/')]
  };

  function humanize(segment){
    return decodeURIComponent(segment||'')
      .replace(/\.(html?|php)$/i,'')
      .replace(/[-_]+/g,' ')
      .replace(/\b\w/g,char=>char.toUpperCase());
  }

  function fallbackTrail(path){
    const parts=path.split('/').filter(Boolean);
    if(!parts.length)return [];
    const result=[item('Home','/')];
    let assembled='';
    parts.forEach((part,index)=>{
      assembled+='/'+part;
      const last=index===parts.length-1;
      const target=last?path:assembled+'/';
      result.push(item(last?pageTitle():humanize(part),target));
    });
    return result;
  }

  const trail=(trails[currentPath]||fallbackTrail(currentPath)).filter(Boolean);
  if(trail.length<2)return;

  function absoluteUrl(path){return new URL(path,canonicalOrigin).href;}

  function hasBreadcrumbJsonLd(){
    return Array.from(document.querySelectorAll('script[type="application/ld+json"]')).some(script=>{
      try{
        const data=JSON.parse(script.textContent||'null');
        const nodes=Array.isArray(data)?data:(data?.['@graph']||[data]);
        return nodes.some(node=>node?.['@type']==='BreadcrumbList');
      }catch(_){return false;}
    });
  }

  function addStructuredData(){
    if(hasBreadcrumbJsonLd())return;
    const data={
      '@context':'https://schema.org',
      '@type':'BreadcrumbList',
      itemListElement:trail.map((crumb,index)=>({
        '@type':'ListItem',
        position:index+1,
        name:crumb.name,
        item:absoluteUrl(crumb.path)
      }))
    };
    const script=document.createElement('script');
    script.type='application/ld+json';
    script.dataset.sgxBreadcrumb='true';
    script.textContent=JSON.stringify(data);
    document.head.appendChild(script);
  }

  function addVisibleBreadcrumb(){
    if(document.querySelector('.sgx-breadcrumbs, nav[aria-label="Breadcrumb"]'))return;
    if(document.querySelector('.breadcrumbs'))return;

    const nav=document.createElement('nav');
    nav.className='sgx-breadcrumbs';
    nav.setAttribute('aria-label','Breadcrumb');

    const inner=document.createElement('div');
    inner.className='sgx-breadcrumbs-inner';
    const list=document.createElement('ol');
    list.setAttribute('itemscope','');
    list.setAttribute('itemtype','https://schema.org/BreadcrumbList');

    trail.forEach((crumb,index)=>{
      const li=document.createElement('li');
      li.setAttribute('itemprop','itemListElement');
      li.setAttribute('itemscope','');
      li.setAttribute('itemtype','https://schema.org/ListItem');

      if(index<trail.length-1){
        const link=document.createElement('a');
        link.href=crumb.path;
        link.setAttribute('itemprop','item');
        const name=document.createElement('span');
        name.setAttribute('itemprop','name');
        name.textContent=crumb.name;
        link.appendChild(name);
        li.appendChild(link);
      }else{
        const current=document.createElement('span');
        current.className='sgx-breadcrumb-current';
        current.setAttribute('aria-current','page');
        current.setAttribute('itemprop','name');
        current.textContent=crumb.name;
        li.appendChild(current);
        const url=document.createElement('meta');
        url.setAttribute('itemprop','item');
        url.content=absoluteUrl(crumb.path);
        li.appendChild(url);
      }

      const position=document.createElement('meta');
      position.setAttribute('itemprop','position');
      position.content=String(index+1);
      li.appendChild(position);
      list.appendChild(li);
    });

    inner.appendChild(list);
    nav.appendChild(inner);
    const anchor=document.querySelector('.site-header, .report-masthead');
    const main=document.querySelector('main');
    if(anchor)anchor.insertAdjacentElement('afterend',nav);
    else if(main)main.insertAdjacentElement('beforebegin',nav);
    else document.body.prepend(nav);
  }

  if(!document.querySelector('link[href="/breadcrumbs.css"]')){
    const css=document.createElement('link');
    css.rel='stylesheet';
    css.href='/breadcrumbs.css';
    document.head.appendChild(css);
  }

  addStructuredData();
  addVisibleBreadcrumb();
})();
