// Spray GenX Image Manager — v3.8 SAFE
// Add your GitHub token below. Every mutation starts from the CURRENT GitHub JSON
// and is read back/verified before success is reported.

const OWNER="MobsterGit";
const REPO="-spraygenx-website-public";
const BRANCH="main";
const GITHUB_TOKEN="token-here";
const LIBRARY_PATH="data/image-library.json";
const INBOX_ROOT="images/inbox";
const DEFAULT_VIEWS=["library","latest","search"];
const api=p=>`https://api.github.com/repos/${OWNER}/${REPO}/contents/${p}`;
const rawUrl=p=>`https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${String(p||"").split("/").map(encodeURIComponent).join("/")}`;
let LIB=null;

function today(){return new Date().toISOString().slice(0,10)}
function nowTime(){return new Date().toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}
function stamp(){return new Date().toISOString().replace(/[-:T.Z]/g,"").slice(0,14)}
function slug(v){return String(v||"block").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80)||"block"}
function csv(v){return String(v||"").split(",").map(x=>x.trim()).filter(Boolean)}
function unique(a){return [...new Set((a||[]).filter(Boolean))]}
function imgPath(i){return typeof i==="string"?i:(i&&i.path?i.path:"")}
function b64(s){return Data.fromString(s).toBase64String()}
function decode(s){return Data.fromBase64String(String(s||"").replace(/\n/g,"")).toRawString()}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
function sleep(ms){return new Promise(resolve=>Timer.schedule(ms/1000,false,resolve))}

async function alertMsg(title,msg){let a=new Alert();a.title=title;a.message=msg||"";a.addAction("OK");await a.presentAlert()}
async function confirm(title,msg,yes="Yes"){let a=new Alert();a.title=title;a.message=msg||"";a.addDestructiveAction(yes);a.addCancelAction("Cancel");return await a.presentAlert()===0}
async function ask(title,placeholder,value=""){let a=new Alert();a.title=title;a.addTextField(placeholder,value);a.addAction("OK");a.addCancelAction("Cancel");let r=await a.presentAlert();return r<0?null:a.textFieldValue(0).trim()}
async function choose(title,items,msg=""){let a=new Alert();a.title=title;if(msg)a.message=msg;items.forEach(x=>a.addAction(x.label||String(x)));a.addCancelAction("Cancel");let i=await a.presentSheet();return i<0?null:items[i]}

async function gh(path,method="GET",body=null){
  if(!GITHUB_TOKEN||GITHUB_TOKEN==="token-here")throw new Error("Paste your GitHub token into GITHUB_TOKEN first.");
  let r=new Request(api(path)+(method==="GET"?`?ref=${BRANCH}&_=${Date.now()}`:""));
  r.method=method;
  r.headers={Authorization:`Bearer ${GITHUB_TOKEN}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
  if(body){r.headers["Content-Type"]="application/json";r.body=JSON.stringify(body)}
  let j=await r.loadJSON();
  if(r.response.statusCode<200||r.response.statusCode>299)throw new Error(`${method} ${path}\nHTTP ${r.response.statusCode}\n${JSON.stringify(j,null,2)}`);
  return j;
}
async function getJson(path){let f=await gh(path);return{json:JSON.parse(decode(f.content)),sha:f.sha}}
async function putJson(path,obj,sha,msg){return await gh(path,"PUT",{message:msg,content:b64(JSON.stringify(obj,null,2)+"\n"),sha,branch:BRANCH})}
async function putBinary(path,data,msg){return await gh(path,"PUT",{message:msg,content:data.toBase64String(),branch:BRANCH})}
function categoryLabel(id,lib=LIB&&LIB.json){let c=((lib&&lib.categories)||[]).find(x=>x.id===id);return c?c.label:(id||"Uncategorized")}
async function load(){LIB=await getJson(LIBRARY_PATH);if(!Array.isArray(LIB.json.blocks))throw new Error("Live library has no blocks array.");if(!Array.isArray(LIB.json.categories))LIB.json.categories=[];return LIB}
async function ensureLoaded(){try{await load();return true}catch(e){await alertMsg("Library Unavailable",String(e.message||e));return false}}
function findBlock(lib,id){return (lib.blocks||[]).find(b=>b.id===id)}

async function safeMutateBlock(blockId,mutator,message,verifyFn=null){
  let live=await getJson(LIBRARY_PATH);
  if(!Array.isArray(live.json.blocks))throw new Error("SAFETY STOP: live image-library.json has no blocks array.");
  const beforeCount=live.json.blocks.length;
  const idx=live.json.blocks.findIndex(b=>b.id===blockId);
  if(idx<0)throw new Error(`SAFETY STOP: block ${blockId} was not found in the current GitHub library.`);
  let changed=JSON.parse(JSON.stringify(live.json.blocks[idx]));
  await mutator(changed,live.json);
  live.json.blocks[idx]=changed;
  live.json.updated=today();
  if(live.json.blocks.length!==beforeCount)throw new Error("SAFETY STOP: block count changed unexpectedly. Nothing was saved.");
  await putJson(LIBRARY_PATH,live.json,live.sha,message);
  let check=await getJson(LIBRARY_PATH),saved=findBlock(check.json,blockId);
  if(!saved)throw new Error("SAVE FAILED VERIFICATION: block was not read back from GitHub.");
  if((check.json.blocks||[]).length!==beforeCount)throw new Error("SAVE FAILED VERIFICATION: library block count changed.");
  if(verifyFn&&!verifyFn(saved))throw new Error("SAVE FAILED VERIFICATION: saved values do not match.");
  LIB=check;
  return saved;
}
async function safeCreateBlock(block,message){
  let live=await getJson(LIBRARY_PATH);
  if(!Array.isArray(live.json.blocks))throw new Error("SAFETY STOP: live library has no blocks array.");
  if(findBlock(live.json,block.id))throw new Error("SAFETY STOP: block ID already exists.");
  let before=live.json.blocks.length;
  live.json.blocks.unshift(block);live.json.updated=today();
  await putJson(LIBRARY_PATH,live.json,live.sha,message);
  let check=await getJson(LIBRARY_PATH);
  if((check.json.blocks||[]).length!==before+1||!findBlock(check.json,block.id))throw new Error("CREATE FAILED VERIFICATION.");
  LIB=check;return findBlock(check.json,block.id);
}
async function safeDeleteBlock(blockId,title){
  let live=await getJson(LIBRARY_PATH);
  if(!Array.isArray(live.json.blocks))throw new Error("SAFETY STOP: live library has no blocks array.");
  let before=live.json.blocks.length;
  if(!findBlock(live.json,blockId))throw new Error("SAFETY STOP: block no longer exists.");
  live.json.blocks=live.json.blocks.filter(b=>b.id!==blockId);live.json.updated=today();
  if(live.json.blocks.length!==before-1)throw new Error("SAFETY STOP: delete affected an unexpected number of blocks.");
  await putJson(LIBRARY_PATH,live.json,live.sha,`Delete image block: ${title}`);
  let check=await getJson(LIBRARY_PATH);
  if(findBlock(check.json,blockId)||(check.json.blocks||[]).length!==before-1)throw new Error("DELETE FAILED VERIFICATION.");
  LIB=check;
}

// v3.8 FIX: the WebView no longer depends on URL interception.
// Buttons place the form result in window.__sgxResult. Scriptable polls that value,
// dismisses the editor, then runs the already-safe GitHub save routine.
async function editBlockPage(b){
  let cats=((LIB&&LIB.json.categories)||[]).slice().sort((a,z)=>(a.sort||999)-(z.sort||999));
  if(!cats.some(c=>c.id===b.category))cats.push({id:b.category||"uncategorized",label:categoryLabel(b.category)});
  let options=cats.map(c=>`<option value="${esc(c.id)}" ${c.id===b.category?"selected":""}>${esc(c.label)}</option>`).join("");
  let ps=b.projectStatus||(b.status==="draft"?"draft":"work-in-progress");
  let html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>
  *{box-sizing:border-box}body{margin:0;background:#0b1724;color:#f5f8fb;font-family:-apple-system;padding:18px 16px 42px}h1{font-size:24px;margin:4px 0 5px}.sub{color:#91a4b8;font-size:13px;margin-bottom:20px}.field{margin-bottom:16px}label{display:block;font-weight:700;font-size:13px;margin-bottom:7px;color:#dbe8f3}input,textarea,select{width:100%;border:1px solid #31465a;border-radius:11px;background:#122638;color:#fff;padding:12px;font-size:16px}textarea{min-height:100px}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.buttons{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px;position:sticky;bottom:10px}.btn{border:0;border-radius:12px;padding:14px 8px;font-size:15px;font-weight:800}.draft{background:#263b4e;color:#fff}.publish{background:#1486d9;color:#fff}.cancel{width:100%;margin-top:10px;background:transparent;color:#9fb3c5;border:1px solid #31465a;border-radius:12px;padding:12px}.saving{display:none;text-align:center;padding:12px;font-weight:800;color:#8ed0ff}@media(max-width:390px){.row{grid-template-columns:1fr}}
  </style></head><body><h1>Edit Image Block</h1><div class="sub">SAFE v3.8 · Save buttons now return directly to Scriptable.</div>
  <div class="field"><label>Project Title</label><input id="title" value="${esc(b.title||"")}"></div>
  <div class="field"><label>Description / Summary</label><textarea id="summary">${esc(b.summary||"")}</textarea></div>
  <div class="row"><div class="field"><label>Customer</label><input id="customer" value="${esc(b.customer||"")}"></div><div class="field"><label>Location</label><input id="location" value="${esc(b.location||"")}"></div></div>
  <div class="field"><label>Category</label><select id="category">${options}</select></div>
  <div class="field"><label>Tags (comma separated)</label><input id="tags" value="${esc((b.tags||[]).join(", "))}"></div>
  <div class="field"><label>Project Status</label><select id="projectStatus"><option value="work-in-progress" ${ps==="work-in-progress"?"selected":""}>Work in Progress</option><option value="completed" ${ps==="completed"?"selected":""}>Completed</option><option value="draft" ${ps==="draft"?"selected":""}>Draft</option></select></div>
  <div class="field"><label>Website Visibility</label><select id="visibility"><option value="visible" ${b.visible!==false?"selected":""}>Visible</option><option value="hidden" ${b.visible===false?"selected":""}>Hidden</option></select></div>
  <div id="saving" class="saving">Saving… return to Scriptable</div>
  <div class="buttons"><button class="btn draft" onclick="finish('draft')">Save Draft</button><button class="btn publish" onclick="finish('publish')">Save & Publish</button></div>
  <button class="cancel" onclick="finish('cancel')">Cancel</button>
  <script>
  window.__sgxResult=null;
  function val(id){return document.getElementById(id).value}
  function finish(action){
    if(window.__sgxResult)return;
    window.__sgxResult={action:action,title:val('title').trim(),summary:val('summary').trim(),customer:val('customer').trim(),location:val('location').trim(),category:val('category'),tags:val('tags').trim(),projectStatus:val('projectStatus'),visibility:val('visibility')};
    document.getElementById('saving').style.display='block';
    document.querySelectorAll('button').forEach(x=>x.disabled=true);
  }
  </script></body></html>`;

  let w=new WebView();
  await w.loadHTML(html);
  let presentation=w.present(true); // deliberately not awaited yet
  let result=null;
  while(true){
    await sleep(200);
    try{
      let raw=await w.evaluateJavaScript("JSON.stringify(window.__sgxResult || null)");
      if(raw&&raw!=="null"){result=JSON.parse(raw);break}
    }catch(_){break}
  }
  try{w.dismiss()}catch(_){}
  try{await presentation}catch(_){}
  return result||{action:"cancel"};
}

function expectedFromResult(b,r){
  let x=JSON.parse(JSON.stringify(b));
  x.title=r.title||b.title;x.summary=r.summary||"";x.customer=r.customer||"";x.location=r.location||"";
  x.category=r.category||"uncategorized";x.categories=unique([x.category,...(b.categories||[]).filter(c=>c!=="uncategorized"&&c!==x.category)]);
  x.tags=csv(r.tags);x.slug=slug(x.title);x.projectStatus=r.projectStatus||"work-in-progress";
  if(r.action==="draft"){x.status="draft";x.visible=false}else{x.status="published";x.visible=r.visibility!=="hidden";x.date=today()}
  return x;
}
function verifyFields(saved,expected){return saved&&saved.title===expected.title&&saved.summary===expected.summary&&saved.customer===expected.customer&&saved.location===expected.location&&saved.category===expected.category&&JSON.stringify(saved.tags||[])===JSON.stringify(expected.tags||[])&&saved.projectStatus===expected.projectStatus&&saved.status===expected.status&&saved.visible===expected.visible}
async function saveEditor(b,r){
  if(!r||r.action==="cancel")return;
  let expected=expectedFromResult(b,r);
  try{
    let saved=await safeMutateBlock(b.id,x=>Object.assign(x,expected),`${r.action==="draft"?"Save draft":"Publish"} image block: ${expected.title}`,x=>verifyFields(x,expected));
    await alertMsg(r.action==="draft"?"✓ DRAFT SAVED & VERIFIED":"✓ PUBLISHED & VERIFIED",`${saved.title}\n\nCategory: ${categoryLabel(saved.category,LIB.json)}\nStatus: ${saved.projectStatus||saved.status}\nWebsite: ${saved.visible===false?"Hidden":"Visible"}\nVerified from GitHub: ${nowTime()}`);
  }catch(e){await alertMsg("✕ SAVE FAILED — NOT VERIFIED",`${String(e.message||e)}\n\nNothing should be assumed published.`)}
}
async function newBlock(){
  if(!await ensureLoaded())return;
  let id=`new-${stamp()}`;
  let b={id,slug:id,title:"New Project",summary:"",customer:"",location:"",date:today(),category:(LIB.json.categories[0]&&LIB.json.categories[0].id)||"uncategorized",categories:[],tags:[],projectStatus:"work-in-progress",status:"draft",visible:false,weight:25,priority:25,views:{library:true,latest:true,search:true},siteLocations:DEFAULT_VIEWS.slice(),fallback:"latest",cover:"",images:[]};
  let r=await editBlockPage(b);if(!r||r.action==="cancel")return;
  let expected=expectedFromResult(b,r);
  try{let saved=await safeCreateBlock(expected,`${r.action==="draft"?"Create draft":"Publish new"} image block: ${expected.title}`);await alertMsg("✓ CREATED & VERIFIED",`${saved.title}\n\n${saved.visible===false?"Saved as draft/hidden":"Published and visible"}\nVerified from GitHub: ${nowTime()}`)}catch(e){await alertMsg("✕ CREATE FAILED",String(e.message||e))}
}
async function viewImages(b){
  let images=(b.images||[]).filter(im=>imgPath(im));if(!images.length){await alertMsg("No Images",`${b.title} has no images.`);return}
  let cards=images.map((im,i)=>{let p=imgPath(im);return `<figure><a href="${esc(rawUrl(p))}"><img src="${esc(rawUrl(p))}"></a><figcaption>${i+1}${p===b.cover||im.role==="cover"?" · COVER":""}</figcaption></figure>`}).join("");
  let w=new WebView();await w.loadHTML(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0d1824;color:#fff;font-family:-apple-system;padding:14px}.g{display:grid;grid-template-columns:1fr 1fr;gap:10px}figure{margin:0;background:#142638;border-radius:10px;overflow:hidden}img{width:100%;aspect-ratio:1;object-fit:cover}figcaption{padding:8px}</style><h2>${esc(b.title)}</h2><div class="g">${cards}</div>`);await w.present(true)
}
async function blockActions(b){
  let a=await choose(b.title,[{label:"Edit Project — Single Page",id:"edit"},{label:"View Images",id:"view"},{label:"Save as Draft",id:"draft"},{label:b.visible===false?"Publish / Show":"Hide from Website",id:"toggle"},{label:"Delete Block",id:"delete"}],`${b.status||"published"} · ${categoryLabel(b.category)}`);if(!a)return;
  if(a.id==="edit"){let r=await editBlockPage(b);await saveEditor(b,r)}
  if(a.id==="view")await viewImages(b);
  if(a.id==="draft"){try{let saved=await safeMutateBlock(b.id,x=>{x.status="draft";x.visible=false},`Save draft image block: ${b.title}`,x=>x.status==="draft"&&x.visible===false);await alertMsg("✓ DRAFT SAVED & VERIFIED",`${saved.title}\nVerified from GitHub: ${nowTime()}`)}catch(e){await alertMsg("✕ SAVE FAILED",String(e.message||e))}}
  if(a.id==="toggle"){let makeVisible=b.visible===false;try{let saved=await safeMutateBlock(b.id,x=>{x.visible=makeVisible;x.status=makeVisible?"published":"hidden"},`${makeVisible?"Publish":"Hide"} image block: ${b.title}`,x=>x.visible===makeVisible);await alertMsg(makeVisible?"✓ PUBLISHED & VERIFIED":"✓ HIDDEN & VERIFIED",`${saved.title}\nVerified from GitHub: ${nowTime()}`)}catch(e){await alertMsg("✕ UPDATE FAILED",String(e.message||e))}}
  if(a.id==="delete"){if(!await confirm("Delete Image Block?",`${b.title}\n\nImage files remain in GitHub.`,"Delete Block"))return;try{await safeDeleteBlock(b.id,b.title);await alertMsg("✓ DELETED & VERIFIED",`${b.title}\nVerified from GitHub: ${nowTime()}`)}catch(e){await alertMsg("✕ DELETE FAILED",String(e.message||e))}}
}
async function manageBlocks(){
  if(!await ensureLoaded())return;
  let t=new UITable();t.showSeparators=true;let h=new UITableRow();h.isHeader=true;h.addText("Image Blocks",`${LIB.json.blocks.length} total · SAFE v3.8`);t.addRow(h);
  for(let b of LIB.json.blocks){let r=new UITableRow();r.height=62;r.dismissOnSelect=false;let state=b.status==="draft"?"DRAFT":(b.visible===false?"HIDDEN":"LIVE");r.addText(b.title,`${state} · ${categoryLabel(b.category)} · ${(b.images||[]).length} images`);r.onSelect=async()=>{await blockActions(b);t.dismiss()};t.addRow(r)}
  await t.present(true)
}
async function attachUploadedToBlock(projectName,paths){
  if(!paths.length)return null;
  let live=await getJson(LIBRARY_PATH),projectSlug=slug(projectName),b=(live.json.blocks||[]).find(x=>x.slug===projectSlug||slug(x.title)===projectSlug);
  if(!b){let nb={id:`${projectSlug}-${stamp()}`,slug:projectSlug,title:projectName,summary:"",customer:"",location:"",date:today(),category:"uncategorized",categories:["uncategorized"],tags:[],projectStatus:"work-in-progress",status:"draft",visible:false,weight:25,priority:25,views:{library:true,latest:true,search:true},siteLocations:DEFAULT_VIEWS.slice(),fallback:"latest",cover:"",images:paths.map((p,i)=>({path:p,caption:"",alt:projectName,visible:true,role:i===0?"cover":""}))};nb.cover=paths[0]||"";return await safeCreateBlock(nb,`Create uploaded image block: ${projectName}`)}
  let before=(b.images||[]).length;
  return await safeMutateBlock(b.id,x=>{x.images=Array.isArray(x.images)?x.images:[];let existing=new Set(x.images.map(imgPath));for(let p of paths)if(!existing.has(p))x.images.push({path:p,caption:"",alt:x.title||projectName,visible:true,role:""});if(!x.cover&&x.images.length){x.cover=imgPath(x.images[0]);x.images[0].role="cover"}},`Attach ${paths.length} image(s) to ${b.title}`,x=>(x.images||[]).length>=before)
}
async function uploadOnePhoto(){
  let img;try{img=await Photos.fromLibrary()}catch(_){return}if(!img)return;
  let project=await ask("Project / Image Block","Example: Freeman Barn","");if(!project)return;
  let fm=FileManager.local(),name=`photo-${stamp()}.jpg`,tmp=fm.joinPath(fm.temporaryDirectory(),name);fm.writeImage(tmp,img);let path=`${INBOX_ROOT}/${slug(project)}/${name}`;
  try{await putBinary(path,fm.read(tmp),`Inbox upload: ${name}`);let b=await attachUploadedToBlock(project,[path]);await alertMsg("✓ IMAGE UPLOADED & VERIFIED",`${b.title}\n\nImage uploaded and block verified from GitHub.`)}catch(e){await alertMsg("✕ UPLOAD FAILED",String(e.message||e))}
  try{fm.remove(tmp)}catch(_){}
}
async function counts(){if(!await ensureLoaded())return;let b=LIB.json.blocks||[];await alertMsg("Studio Counts",`Blocks: ${b.length}\nLive: ${b.filter(x=>x.status==="published"&&x.visible!==false).length}\nDrafts: ${b.filter(x=>x.status==="draft").length}\nCategories: ${(LIB.json.categories||[]).length}`)}
async function main(){
  while(true){let a=await choose("Spray GenX Image Manager v3.8 SAFE",[{label:"Image Blocks — Edit / Publish",id:"manage"},{label:"Upload One Photo",id:"upload"},{label:"+ New Image Block",id:"new"},{label:"Counts",id:"counts"},{label:"Reload from GitHub",id:"reload"},{label:"Done",id:"done"}],"Project-editor Save buttons fixed. Every write is verified from GitHub.");if(!a||a.id==="done")break;if(a.id==="manage")await manageBlocks();if(a.id==="upload")await uploadOnePhoto();if(a.id==="new")await newBlock();if(a.id==="counts")await counts();if(a.id==="reload"){await ensureLoaded();await alertMsg("Reloaded","Fresh image library loaded from GitHub.")}}
}
main().catch(async e=>await alertMsg("Studio Error",String(e.message||e)));
