/* Spray GenX Studio Engine
   Normalizes Image Blocks / Project Records so the same data can feed Studio,
   the public image library, portfolio views, homepage sections, and future tools. */
(function(){
  const SGX = window.SGXStudio = window.SGXStudio || {};

  function text(value, fallback=''){
    return value === undefined || value === null ? fallback : String(value).trim();
  }

  function array(value){
    if(Array.isArray(value)) return value.filter(v=>v !== undefined && v !== null && String(v).trim() !== '');
    if(value === undefined || value === null || String(value).trim() === '') return [];
    return [String(value).trim()];
  }

  function slugify(value){
    return text(value,'untitled')
      .toLowerCase()
      .replace(/&/g,' and ')
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/^-+|-+$/g,'') || 'untitled';
  }

  function normalizeImage(img, index){
    const path = typeof img === 'string' ? img : text(img && img.path);
    return {
      id: text(img && img.id, `image-${String(index+1).padStart(3,'0')}`),
      path,
      caption: text(img && img.caption),
      alt: text(img && img.alt || img && img.caption),
      visible: img && img.visible === false ? false : true,
      role: text(img && img.role),
      dateTaken: text(img && (img.dateTaken || img.date_taken)),
      gps: img && img.gps ? img.gps : null,
      width: img && img.width ? img.width : null,
      height: img && img.height ? img.height : null
    };
  }

  function normalizeBlock(block, index){
    const title = text(block.title, `Untitled Image Block ${index+1}`);
    const primaryCategory = text(block.category, array(block.categories)[0] || 'uncategorized');
    const categories = Array.from(new Set([primaryCategory, ...array(block.categories)].filter(Boolean)));
    const images = array(block.images).map(normalizeImage).filter(img=>img.path);
    const views = Object.assign({
      library: true,
      portfolio: false,
      home: false,
      featured: false,
      latest: true,
      search: true
    }, block.views || {});
    const siteLocations = Array.from(new Set([...array(block.siteLocations), ...Object.keys(views).filter(k=>views[k])])).filter(Boolean);
    const weight = Number.isFinite(Number(block.weight)) ? Number(block.weight) : (Number.isFinite(Number(block.priority)) ? Number(block.priority) : 25);
    return {
      raw: block,
      id: text(block.id, slugify(title)),
      slug: text(block.slug, slugify(title)),
      title,
      summary: text(block.summary || block.description, 'Completed Spray GenX project.'),
      body: text(block.body),
      customer: text(block.customer),
      location: text(block.location),
      city: text(block.city),
      state: text(block.state),
      date: text(block.date),
      category: primaryCategory,
      categories,
      tags: array(block.tags).map(t=>text(t)).filter(Boolean),
      status: text(block.status, block.visible === false ? 'hidden' : 'published'),
      visible: block.visible === false ? false : true,
      weight,
      priority: Number.isFinite(Number(block.priority)) ? Number(block.priority) : weight,
      views,
      siteLocations,
      fallback: text(block.fallback, 'latest'),
      cover: text(block.cover) || (images.find(img=>img.visible)?.path || ''),
      images,
      metadata: block.metadata || {},
      mileage: block.mileage || null,
      proposal: block.proposal || null,
      invoice: block.invoice || null
    };
  }

  function normalizeLibrary(data){
    const categories = Array.isArray(data && data.categories) ? data.categories : [];
    const blocks = Array.isArray(data && data.blocks) ? data.blocks.map(normalizeBlock) : [];
    return {
      version: data && data.version || 1,
      updated: data && data.updated || '',
      categories,
      blocks
    };
  }

  function categoryLabel(categories, id){
    const cat = (categories || []).find(c=>c.id === id);
    return cat ? cat.label : (id || 'Uncategorized');
  }

  function blockHealth(block){
    const warnings = [];
    if(!block.title || /^untitled/i.test(block.title)) warnings.push('Missing title');
    if(!block.summary || block.summary === 'Completed Spray GenX project.') warnings.push('Needs custom summary');
    if(!block.categories.length || block.categories.includes('uncategorized')) warnings.push('Uncategorized');
    if(!block.tags.length) warnings.push('No tags');
    if(!block.images.length) warnings.push('No images');
    if(!block.cover) warnings.push('Missing cover image');
    block.images.forEach((img,i)=>{
      if(!img.path) warnings.push(`Image ${i+1} missing path`);
      if(img.visible === false) warnings.push(`Image ${i+1} hidden`);
    });
    return warnings;
  }

  function sortBlocks(blocks, mode='weight-date'){
    return blocks.slice().sort((a,b)=>{
      if(mode === 'date') return String(b.date||'').localeCompare(String(a.date||''));
      if(mode === 'title') return String(a.title||'').localeCompare(String(b.title||''));
      return (b.weight - a.weight) || String(b.date||'').localeCompare(String(a.date||''));
    });
  }

  function filterBlocks(blocks, opts={}){
    const q = text(opts.query).toLowerCase();
    return (blocks || []).filter(block=>{
      if(opts.visibleOnly !== false && block.visible === false) return false;
      if(opts.category && opts.category !== 'all' && !block.categories.includes(opts.category)) return false;
      if(opts.view && !block.siteLocations.includes(opts.view) && !block.views[opts.view]) return false;
      if(!q) return true;
      const haystack = [block.title, block.summary, block.customer, block.location, block.city, block.state, block.category, ...block.categories, ...block.tags, ...block.images.map(i=>i.path)].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  SGX.slugify = slugify;
  SGX.normalizeBlock = normalizeBlock;
  SGX.normalizeLibrary = normalizeLibrary;
  SGX.categoryLabel = categoryLabel;
  SGX.blockHealth = blockHealth;
  SGX.sortBlocks = sortBlocks;
  SGX.filterBlocks = filterBlocks;
})();
