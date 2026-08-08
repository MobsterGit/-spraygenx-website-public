// Spray GenX Image Manager — v3.4
// Auto-attaches uploads, provides visual previews, upload progress notifications,
// and a native Image Blocks list with an inline Delete button.
// Private Scriptable control panel. Replace only GITHUB_TOKEN yourself.

const OWNER="MobsterGit", REPO="-spraygenx-website-public", BRANCH="main";
const GITHUB_TOKEN="token-here";
const LIBRARY_PATH="data/image-library.json";
const CONVERTED_PATH="data/converted-images.json";
const INBOX_ROOT="images/inbox";
const MAX_BATCH=24;
const RAW_ALLOWED=["heic","heif","jpg","jpeg","png","webp","tif","tiff","bmp","gif"];
const DEFAULT_VIEWS=["library","latest","search"];
const api=p=>`https://api.github.com/repos/${OWNER}/${REPO}/contents/${p}`;
const rawUrl=p=>`https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${String(p||"").split("/").map(encodeURIComponent).join("/")}`;

let LIB=null;

function today(){return new Date().toISOString().slice(0,10)}
function stamp(){return new Date().toISOString().replace(/[-:T.Z]/g,"").slice(0,14)}
function slug(v){return String(v||"block").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80)||"block"}
function csv(v){return String(v||"").split(",").map(x=>x.trim()).filter(Boolean)}
function imgPath(i){return typeof i==="string"?i:(i&&i.path?i.path:"")}
function ext(path){let m=String(path||"").toLowerCase().match(/\.([a-z0-9]+)$/);return m?m[1]:""}
function base(path){return String(path||"").split("/").pop().replace(/\.[^.]+$/,"" )||"image"}
function folderOf(p){let parts=String(p||"").split("/");return parts.length>2?parts.slice(2,-1).join("/")||"converted":"converted"}
function titleCase(v){return String(v||"").replace(/[-_]/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
function unique(a){return [...new Set((a||[]).filter(Boolean))]}
function b64(s){return Data.fromString(s).toBase64String()}
function decode(s){return Data.fromBase64String(String(s||"").replace(/\n/g,"")).toRawString()}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}

async function alertMsg(title,msg){let a=new Alert();a.title=title;a.message=msg||"";a.addAction("OK");await a.present()}
async function confirm(title,msg,yes="Yes"){let a=new Alert();a.title=title;a.message=msg||"";a.addDestructiveAction(yes);a.addCancelAction("Cancel");return await a.presentAlert()===0}
async function ask(title,placeholder,value=""){let a=new Alert();a.title=title;a.addTextField(placeholder,value);a.addAction("OK");a.addCancelAction("Cancel");let r=await a.presentAlert();if(r<0)return null;return a.textFieldValue(0).trim()}
async function choose(title,items,msg=""){let a=new Alert();a.title=title;if(msg)a.message=msg;items.forEach(x=>a.addAction(x.label||String(x)));a.addCancelAction("Cancel");let i=await a.presentSheet();return i<0?null:items[i]}

async function gh(path,method="GET",body=null){
  if(!GITHUB_TOKEN||GITHUB_TOKEN==="token-here"||GITHUB_TOKEN==="PASTE_NEW_TOKEN_HERE")throw new Error("Paste your GitHub token into GITHUB_TOKEN first.");
  let url=api(path)+(method==="GET"?`?ref=${BRANCH}`:"");
  let r=new Request(url);r.method=method;
  r.headers={Authorization:`Bearer ${GITHUB_TOKEN}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
  if(body){r.headers["Content-Type"]="application/json";r.body=JSON.stringify(body)}
  let j=await r.loadJSON();
  if(r.response.statusCode<200||r.response.statusCode>299)throw new Error(`${method} ${path}\n${r.response.statusCode}\n${JSON.stringify(j,null,2)}`);
  return j;
}
async function getJson(path){let f=await gh(path);return{json:JSON.parse(decode(f.content)),sha:f.sha}}
async function putJson(path,obj,sha,msg){return await gh(path,"PUT",{message:msg,content:b64(JSON.stringify(obj,null,2)+"\n"),sha,branch:BRANCH})}
async function putBinary(path,data,msg){return await gh(path,"PUT",{message:msg,content:data.toBase64String(),branch:BRANCH})}

function normalizeLibrary(l){
  l=l||{};l.categories=Array.isArray(l.categories)?l.categories:[];l.blocks=Array.isArray(l.blocks)?l.blocks:[];
  l.blocks=l.blocks.map((b,n)=>{
    let cats=Array.isArray(b.categories)?b.categories.filter(Boolean):[];
    let cat=b.category||cats[0]||(l.categories[0]&&l.categories[0].id)||"uncategorized";
    cats=unique([cat,...cats]);
    let locs=unique([...(Array.isArray(b.siteLocations)?b.siteLocations:[]),...Object.keys(b.views||{}).filter(k=>b.views[k])]);
    if(!locs.length)locs=DEFAULT_VIEWS.slice();
    let imgs=(b.images||[]).map(i=>typeof i==="string"?{path:i,caption:"",visible:true,alt:b.title||""}:{path:i.path||"",caption:i.caption||"",alt:i.alt||i.caption||b.title||"",visible:i.visible===false?false:true,role:i.role||""}).filter(i=>i.path);
    let weight=Number.isFinite(Number(b.weight))?Number(b.weight):25;
    return {id:b.id||`${slug(b.title||"image-block")}-${n+1}`,slug:b.slug||slug(b.title||"image-block"),title:b.title||"Untitled Image Block",summary:b.summary||b.description||"Completed Spray GenX project.",customer:b.customer||"",location:b.location||"",date:b.date||today(),category:cat,categories:cats,tags:Array.isArray(b.tags)?b.tags:csv(b.tags),status:b.status||(b.visible===false?"hidden":"published"),visible:b.visible===false?false:true,weight,priority:weight,views:Object.fromEntries(locs.map(x=>[x,true])),siteLocations:locs,fallback:b.fallback||"latest",cover:b.cover||(imgs[0]&&imgs[0].path)||"",images:imgs};
  });
  return l;
}
async function load(){LIB=await getJson(LIBRARY_PATH);LIB.json=normalizeLibrary(LIB.json)}
async function ensureLoaded(){if(LIB&&LIB.json)return true;try{await load();return true}catch(e){await alertMsg("Library Unavailable",String(e.message||e));return false}}
async function saveLibrary(msg){LIB.json.updated=today();await putJson(LIBRARY_PATH,LIB.json,LIB.sha,msg);LIB=await getJson(LIBRARY_PATH);LIB.json=normalizeLibrary(LIB.json)}
function categoryLabel(id){let c=(LIB.json.categories||[]).find(x=>x.id===id);return c?c.label:id}
function health(b){let w=[];if(!b.title||/^untitled/i.test(b.title))w.push("title");if(!b.summary)w.push("summary");if(!b.tags.length)w.push("tags");if(!b.images.length)w.push("images");if(!b.cover)w.push("cover");return w}

async function progressPing(done,total,project){
  if(done%5!==0&&done!==total)return;
  try{let n=new Notification();n.title=`Spray GenX Upload: ${done}/${total}`;n.body=`${project}: ${done} image${done===1?"":"s"} uploaded.`;n.sound="default";await n.schedule()}catch(_){}
}

async function attachUploadedToBlock(projectName,paths){
  if(!paths.length||!await ensureLoaded())return null;
  let projectSlug=slug(projectName);
  let b=(LIB.json.blocks||[]).find(x=>x.slug===projectSlug||slug(x.title)===projectSlug);
  if(!b){
    b={id:`${projectSlug}-${stamp()}`,slug:projectSlug,title:titleCase(projectName),summary:"Completed Spray GenX project.",customer:"",location:"",date:today(),category:"uncategorized",categories:["uncategorized","jobsite-process"],tags:[],status:"published",visible:true,weight:25,priority:25,views:{library:true,latest:true,search:true},siteLocations:DEFAULT_VIEWS.slice(),fallback:"latest",cover:"",images:[]};
    LIB.json.blocks.unshift(b);
  }
  let existing=new Set((b.images||[]).map(imgPath));
  for(let p of paths)if(!existing.has(p)){b.images.push({path:p,caption:"",alt:b.title,visible:true,role:""});existing.add(p)}
  if(!b.cover&&b.images.length){b.cover=imgPath(b.images[0]);b.images[0].role="cover"}
  b.status="published";b.visible=true;b.date=today();
  await saveLibrary(`Attach ${paths.length} uploaded image(s) to ${b.title}`);
  return b;
}

async function uploadImageObjects(images,sourceLabel="Photos"){
  images=(images||[]).filter(Boolean).slice(0,MAX_BATCH);
  if(!images.length){await alertMsg("No Photos","No photos were received.");return}
  let project=await ask("Upload Batch / Project","Example: industrial-floor-painting",today());if(project===null)return;project=slug(project);
  let run=stamp(),uploaded=[],fm=FileManager.local();
  for(let i=0;i<images.length;i++){
    let n=String(i+1).padStart(3,"0"),safe=`photo-${run}-${n}.jpg`,temp=fm.joinPath(fm.temporaryDirectory(),safe);
    fm.writeImage(temp,images[i]);
    let repoPath=`${INBOX_ROOT}/${project}/${safe}`;
    await putBinary(repoPath,fm.read(temp),`Inbox upload: ${safe}`);
    uploaded.push(repoPath);try{fm.remove(temp)}catch(_){}
    await progressPing(i+1,images.length,titleCase(project));
  }
  let b=await attachUploadedToBlock(project,uploaded);
  await alertMsg("Upload Complete",`${uploaded.length} photo(s) uploaded from ${sourceLabel}.\n\n${b?`Added to image block: ${b.title}`:"Images uploaded, but library attachment could not be completed."}`);
}
async function uploadOnePhoto(){let img;try{img=await Photos.fromLibrary()}catch(e){return}if(img)await uploadImageObjects([img],"Photo Library")}
async function uploadSharedPhotos(){let images=Array.isArray(args.images)?args.images.filter(Boolean):[];if(!images.length){await alertMsg("No Shared Photos","Photos → Select → choose multiple photos → Share → Scriptable → this Image Manager.");return false}await uploadImageObjects(images,`Share Sheet (${images.length} selected)`);return true}
async function uploadMultipleFiles(){
  let project=await ask("Upload Batch / Project","Example: industrial-floor-painting",today());if(project===null)return;project=slug(project);
  let paths=[];try{paths=await DocumentPicker.open(["public.image"])}catch(e){await alertMsg("File Picker Error",String(e.message||e));return}
  if(!Array.isArray(paths))paths=paths?[paths]:[];paths=unique(paths).slice(0,MAX_BATCH);
  if(!paths.length){await alertMsg("No Files","No files selected.");return}
  let bad=paths.filter(p=>!RAW_ALLOWED.includes(ext(p)));if(bad.length){await alertMsg("Unsupported File",`Detected: ${unique(bad.map(p=>ext(p)||"(no extension)")).join(", ")}`);return}
  let fm=FileManager.local(),run=stamp(),uploaded=[];
  for(let i=0;i<paths.length;i++){
    let p=paths[i],n=String(i+1).padStart(3,"0"),safe=`${slug(base(p))}-${run}-${n}.${ext(p)}`,repoPath=`${INBOX_ROOT}/${project}/${safe}`;
    await putBinary(repoPath,fm.read(p),`Inbox upload: ${safe}`);
    uploaded.push(repoPath);await progressPing(i+1,paths.length,titleCase(project));
  }
  let b=await attachUploadedToBlock(project,uploaded);
  await alertMsg("Batch Upload Complete",`${uploaded.length} file(s) uploaded.\n\n${b?`Added to image block: ${b.title}`:"Images uploaded, but library attachment could not be completed."}`);
}
async function uploadMenu(){
  let shared=Array.isArray(args.images)&&args.images.length,items=[];
  if(shared)items.push({label:`Import ${Math.min(args.images.length,MAX_BATCH)} Shared Photos Now`,id:"shared"});
  items.push({label:"Import Multiple Photos — Share Sheet",id:"sharehelp"},{label:`Select Multiple Files — Files (up to ${MAX_BATCH})`,id:"files"},{label:"Choose One Photo — Photo Library",id:"one"});
  let a=await choose("Upload Images",items,"Uploads attach directly to the matching image block.");if(!a)return;
  if(a.id==="shared")await uploadSharedPhotos();
  if(a.id==="sharehelp")await alertMsg("Multiple Photos","Photos → Select → choose photos → Share → Scriptable → this Image Manager.");
  if(a.id==="files")await uploadMultipleFiles();
  if(a.id==="one")await uploadOnePhoto();
}

async function editBlock(b){
  let vals=[];
  for(let f of [["Title",b.title],["Summary",b.summary],["Customer",b.customer],["Location",b.location],["Tags comma separated",(b.tags||[]).join(", ")]]){let v=await ask("Edit Image Block",f[0],f[1]);if(v===null)return null;vals.push(v)}
  b.title=vals[0]||b.title;b.summary=vals[1]||"Completed Spray GenX project.";b.customer=vals[2];b.location=vals[3];b.tags=csv(vals[4]);b.slug=slug(b.title);
  return b;
}
async function newBlock(){
  let title=await ask("New Image Block","Title","");if(!title)return;
  if(!await ensureLoaded())return;
  let b={id:`${slug(title)}-${stamp()}`,slug:slug(title),title,summary:"Completed Spray GenX project.",customer:"",location:"",date:today(),category:"uncategorized",categories:["uncategorized"],tags:[],status:"draft",visible:true,weight:25,priority:25,views:{library:true,latest:true,search:true},siteLocations:DEFAULT_VIEWS.slice(),fallback:"latest",cover:"",images:[]};
  LIB.json.blocks.unshift(b);await saveLibrary(`Studio add image block: ${title}`);await alertMsg("Saved",`${title}\n\nImage Block created.`);
}

async function viewBlockImages(b){
  let images=(b.images||[]).filter(im=>imgPath(im));
  if(!images.length){await alertMsg("No Images",`${b.title} has no images.`);return}
  let cards=images.map((im,i)=>{let p=imgPath(im),cover=p===b.cover||im.role==="cover";return `<figure><a href="${esc(rawUrl(p))}"><img src="${esc(rawUrl(p))}" loading="lazy"></a><figcaption>${i+1}${cover?" · COVER":""}</figcaption></figure>`}).join("");
  let html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0d1824;color:#fff;font-family:-apple-system;padding:16px}h1{font-size:22px}.sub{opacity:.65;margin-bottom:16px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}figure{margin:0;background:#142638;border-radius:12px;overflow:hidden}img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover}figcaption{padding:9px 10px;font-size:12px}</style></head><body><h1>${esc(b.title)}</h1><div class="sub">${images.length} image${images.length===1?"":"s"} · tap for full size</div><div class="grid">${cards}</div></body></html>`;
  let w=new WebView();await w.loadHTML(html);await w.present(true);
}

async function deleteBlock(b){
  let ok=await confirm("Delete Image Block?",`${b.title}\n\nThis removes the block from the library. The underlying image files remain on GitHub.`,"Delete Block");
  if(!ok)return false;
  LIB.json.blocks=(LIB.json.blocks||[]).filter(x=>x.id!==b.id);
  await saveLibrary(`Delete image block: ${b.title}`);
  return true;
}

async function blockActions(b){
  let act=await choose(b.title,[{label:"View Images",id:"view"},{label:"Edit Block",id:"edit"},{label:"Hide / Show",id:"toggle"},{label:"Delete Block",id:"delete"},{label:"Health",id:"health"}]);
  if(!act)return;
  if(act.id==="view")await viewBlockImages(b);
  if(act.id==="edit"){let nb=await editBlock(b);if(nb){Object.assign(b,nb);await saveLibrary(`Studio edit image block: ${b.title}`)}}
  if(act.id==="toggle"){b.visible=b.visible===false?true:false;b.status=b.visible?"published":"hidden";await saveLibrary(`Studio toggle image block: ${b.title}`)}
  if(act.id==="delete")await deleteBlock(b);
  if(act.id==="health"){let h=health(b);await alertMsg("Health",h.length?`Needs: ${h.join(", ")}`:"Looks good.")}
}

async function manageBlocks(){
  if(!await ensureLoaded())return;
  let table=new UITable();table.showSeparators=true;
  let header=new UITableRow();header.isHeader=true;header.addText("Image Blocks",`${LIB.json.blocks.length} total · tap a block to open`);table.addRow(header);
  for(let b of LIB.json.blocks){
    let row=new UITableRow();row.height=64;row.dismissOnSelect=false;
    let text=row.addText(b.title,`${categoryLabel(b.category)} · ${(b.images||[]).length} image${(b.images||[]).length===1?"":"s"}`);text.widthWeight=78;
    let del=row.addButton("Delete");del.widthWeight=22;
    row.onSelect=async()=>{await blockActions(b)};
    del.onTap=async()=>{
      if(await deleteBlock(b)){
        table.removeRow(row);
        table.reload();
      }
    };
    table.addRow(row);
  }
  await table.present(true);
}

function convertedImages(c){return (c.images||[]).filter(x=>x.converted&&x.status!=="ignored")}
function usedPaths(){let s=new Set();(LIB.json.blocks||[]).forEach(b=>(b.images||[]).forEach(im=>{let p=imgPath(im);if(p)s.add(p)}));return s}
async function publishConverted(){
  let cf;try{cf=await getJson(CONVERTED_PATH)}catch(e){await alertMsg("No converted index","data/converted-images.json was not found yet.");return}
  if(!await ensureLoaded())return;
  let used=usedPaths(),avail=convertedImages(cf.json).filter(x=>!used.has(x.converted));
  if(!avail.length){await alertMsg("Nothing New","No unpublished converted images found.");return}
  let groups={};avail.forEach(x=>{let f=folderOf(x.converted);(groups[f]=groups[f]||[]).push(x)});
  let keys=Object.keys(groups).sort().reverse(),pick=await choose("Converted Batch",keys.map(k=>({label:`${k} — ${groups[k].length}`,id:k})).concat([{label:`All unpublished — ${avail.length}`,id:"__all"}]));if(!pick)return;
  let batch=pick.id==="__all"?avail:groups[pick.id],title=await ask("Block Title","Project title",titleCase(pick.id==="__all"?folderOf(batch[0].converted):pick.id));if(!title)return;
  await attachUploadedToBlock(title,batch.map(x=>x.converted));await alertMsg("Published",`${title}\n${batch.length} converted image(s) attached.`);
}
async function healthCheck(){if(!await ensureLoaded())return;let rows=[];LIB.json.blocks.forEach(b=>{let h=health(b);if(h.length)rows.push(`${b.title}: ${h.join(", ")}`)});await alertMsg("Health Check",rows.length?rows.join("\n\n"):"No obvious issues found.")}
async function counts(){if(!await ensureLoaded())return;let blocks=LIB.json.blocks||[],imgs=blocks.reduce((n,b)=>n+(b.images||[]).filter(i=>i.visible!==false).length,0);await alertMsg("Studio Counts",`Blocks: ${blocks.length}\nVisible images: ${imgs}\nCategories: ${(LIB.json.categories||[]).length}`)}
async function exportJson(){if(!await ensureLoaded())return;Pasteboard.copy(JSON.stringify(LIB.json,null,2));await alertMsg("Exported","Current image-library.json copied to clipboard.")}

async function main(){
  if(Array.isArray(args.images)&&args.images.length){await uploadSharedPhotos();return}
  while(true){
    let a=await choose("Spray GenX Image Manager v3.4",[
      {label:"Upload Images",id:"upload"},
      {label:"Image Blocks — View / Edit / Delete",id:"manage"},
      {label:"Publish Converted Images",id:"converted"},
      {label:"+ New Image Block",id:"new"},
      {label:"Health Check",id:"health"},
      {label:"Counts",id:"counts"},
      {label:"Export JSON",id:"export"},
      {label:"Reload Library",id:"reload"},
      {label:"Done",id:"done"}
    ]);
    if(!a||a.id==="done")break;
    if(a.id==="upload"){await uploadMenu();continue}
    if(a.id==="reload"){LIB=null;await ensureLoaded();continue}
    if(a.id==="manage")await manageBlocks();
    if(a.id==="converted")await publishConverted();
    if(a.id==="new")await newBlock();
    if(a.id==="health")await healthCheck();
    if(a.id==="counts")await counts();
    if(a.id==="export")await exportJson();
  }
}
main().catch(async e=>{await alertMsg("Studio Error",String(e.message||e))});