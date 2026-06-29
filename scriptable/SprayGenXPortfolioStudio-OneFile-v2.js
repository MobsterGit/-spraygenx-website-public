// Spray GenX Portfolio Studio — One File v2.1
// Private Scriptable control panel. Replace only GITHUB_TOKEN yourself.
// No Keychain, no token prompts, no hidden auth behavior.

const OWNER="MobsterGit", REPO="-spraygenx-website-public", BRANCH="main";
const GITHUB_TOKEN="PASTE_NEW_TOKEN_HERE";
const LIBRARY_PATH="data/image-library.json";
const PORTFOLIO_PATH="data/portfolio.json";
const CONVERTED_PATH="data/converted-images.json";
const MAX_BATCH=24;
const DEFAULT_VIEWS=["library","latest","search"];
const api=p=>`https://api.github.com/repos/${OWNER}/${REPO}/contents/${p}`;

let LIB=null, PORT=null;

function today(){return new Date().toISOString().slice(0,10)}
function stamp(){return new Date().toISOString().replace(/[-:T.Z]/g,"").slice(0,14)}
function slug(v){return String(v||"block").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80)||"block"}
function csv(v){return String(v||"").split(",").map(x=>x.trim()).filter(Boolean)}
function imgPath(i){return typeof i==="string"?i:(i&&i.path?i.path:"")}
function fileName(p){return String(p||"").split("/").pop()||""}
function folderOf(p){let parts=String(p||"").split("/");return parts.length>2?parts.slice(2,-1).join("/")||"converted":"converted"}
function titleCase(v){return String(v||"").replace(/[-_]/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
function unique(a){return [...new Set(a.filter(Boolean))]}
function b64(s){return Data.fromString(s).toBase64String()}
function decode(s){return Data.fromBase64String(String(s||"").replace(/\n/g,"")).toRawString()}
function fileExt(path){let p=String(path||"").toLowerCase();if(p.endsWith(".jpg")||p.endsWith(".jpeg"))return"jpg";if(p.endsWith(".png"))return"png";return""}

async function alertMsg(title,msg){let a=new Alert();a.title=title;a.message=msg||"";a.addAction("OK");await a.present()}
async function confirm(title,msg,yes="Yes"){let a=new Alert();a.title=title;a.message=msg||"";a.addDestructiveAction(yes);a.addCancelAction("Cancel");return await a.presentAlert()===0}
async function ask(title,placeholder,value=""){let a=new Alert();a.title=title;a.addTextField(placeholder,value);a.addAction("OK");a.addCancelAction("Cancel");let r=await a.presentAlert();if(r<0)return null;return a.textFieldValue(0).trim()}
async function askMany(title,msg,fields){let a=new Alert();a.title=title;if(msg)a.message=msg;fields.forEach(f=>a.addTextField(f.p||"",f.v||""));a.addAction("OK");a.addCancelAction("Cancel");let r=await a.presentAlert();if(r<0)return null;return fields.map((_,i)=>a.textFieldValue(i).trim())}
async function choose(title,items,msg=""){let a=new Alert();a.title=title;if(msg)a.message=msg;items.forEach(x=>a.addAction(x.label||String(x)));a.addCancelAction("Cancel");let i=await a.presentSheet();return i<0?null:items[i]}

async function gh(path,method="GET",body=null){
  if(!GITHUB_TOKEN||GITHUB_TOKEN==="PASTE_NEW_TOKEN_HERE") throw new Error("Paste your GitHub token into GITHUB_TOKEN first.");
  let url=api(path)+(method==="GET"?`?ref=${BRANCH}`:"");
  let r=new Request(url);r.method=method;r.headers={Authorization:`Bearer ${GITHUB_TOKEN}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
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
    let views=b.views||{};
    let locs=unique([...(Array.isArray(b.siteLocations)?b.siteLocations:[]),...Object.keys(views).filter(k=>views[k])]);
    if(!locs.length)locs=DEFAULT_VIEWS.slice();
    let imgs=(b.images||[]).map((i,idx)=>typeof i==="string"?{path:i,caption:"",visible:true,alt:b.title||""}:{path:i.path||"",caption:i.caption||"",alt:i.alt||i.caption||b.title||"",visible:i.visible===false?false:true,role:i.role||""}).filter(i=>i.path);
    let weight=Number.isFinite(Number(b.weight))?Number(b.weight):(Number.isFinite(Number(b.priority))?Number(b.priority):25);
    return {id:b.id||`${slug(b.title||"image-block")}-${n+1}`,slug:b.slug||slug(b.title||"image-block"),title:b.title||"Untitled Image Block",summary:b.summary||b.description||"Completed Spray GenX project.",customer:b.customer||"",location:b.location||"",date:b.date||today(),category:cat,categories:cats,tags:Array.isArray(b.tags)?b.tags:csv(b.tags),status:b.status||(b.visible===false?"hidden":"published"),visible:b.visible===false?false:true,weight,priority:weight,views:Object.fromEntries(locs.map(x=>[x,true])),siteLocations:locs,fallback:b.fallback||"latest",cover:b.cover||(imgs[0]&&imgs[0].path)||"",images:imgs};
  });
  return l;
}
function categoryLabel(id){let c=(LIB.json.categories||[]).find(x=>x.id===id);return c?c.label:id}
function health(b){let w=[];if(!b.title||/^untitled/i.test(b.title))w.push("title");if(!b.summary||b.summary==="Completed Spray GenX project.")w.push("summary");if(!b.tags.length)w.push("tags");if(!b.images.length)w.push("images");if(!b.cover)w.push("cover");if(b.categories.includes("uncategorized"))w.push("category");return w}
async function load(){LIB=await getJson(LIBRARY_PATH);LIB.json=normalizeLibrary(LIB.json);try{PORT=await getJson(PORTFOLIO_PATH)}catch(e){PORT=null}}
async function saveLibrary(msg){LIB.json.updated=today();await putJson(LIBRARY_PATH,LIB.json,LIB.sha,msg);LIB=await getJson(LIBRARY_PATH);LIB.json=normalizeLibrary(LIB.json)}

async function pickCategory(multi=false,current=[]){
  let cats=LIB.json.categories||[];let chosen=[];
  while(true){let item=await choose(multi?"Add Category":"Choose Category",cats.map(c=>({label:(current.includes(c.id)||chosen.includes(c.id)?"✓ ":"")+c.label,id:c.id})));if(!item)break;chosen.push(item.id);if(!multi)break;if(!await confirm("Add Another Category?","Add another category to this same block?","Add More"))break}
  return multi?unique([...current,...chosen]):(chosen[0]||current[0]||"uncategorized");
}
async function pickFiles(){
  let paths=[],seen=new Set();
  while(paths.length<MAX_BATCH){
    let picked;try{picked=await DocumentPicker.openFile(["public.jpeg","public.jpg","public.png"],true)}catch(e){picked=await DocumentPicker.openFile()}
    let arr=Array.isArray(picked)?picked:[picked];
    for(let p of arr){if(!p||seen.has(p))continue;seen.add(p);paths.push(p);if(paths.length>=MAX_BATCH)break}
    if(arr.length>1||paths.length>=MAX_BATCH)break;
    if(!await confirm("Add More Images?",`${paths.length} image(s) selected. Add more to this same block?`,`Add More`))break;
  }
  let bad=paths.filter(p=>!fileExt(p));
  if(bad.length)throw new Error("Only JPG, JPEG, or PNG files are supported in this direct upload flow. Use the converted image flow for HEIC/mixed files.");
  let fm=FileManager.local();
  return paths.map(p=>({path:p,ext:fileExt(p),data:fm.read(p)}));
}
async function uploadImagesForBlock(b){
  let items=await pickFiles(); if(!items.length)return [];
  let base=slug(b.title), time=stamp(), cat=b.category||"uncategorized", uploaded=[];
  for(let i=0;i<items.length;i++){
    let n=String((b.images||[]).length+i+1).padStart(3,"0"), repoPath=`images/library/${cat}/${base}-${time}-${n}.${items[i].ext}`;
    await putBinary(repoPath,items[i].data,`Studio upload image: ${b.title} ${n}`);
    uploaded.push({path:repoPath,caption:"",alt:b.title,visible:true,role:(!b.cover&&i===0)?"cover":""});
  }
  return uploaded;
}
async function editBlock(existing=null){
  let b=existing?JSON.parse(JSON.stringify(existing)):{title:"",summary:"Completed Spray GenX project.",customer:"",location:"",date:today(),category:"uncategorized",categories:[],tags:[],weight:25,status:"draft",siteLocations:DEFAULT_VIEWS.slice(),images:[],cover:""};
  let vals=await askMany(existing?"Edit Image Block":"New Image Block","Enter once. Reuse everywhere.",[
    {p:"Title",v:b.title},{p:"Summary",v:b.summary},{p:"Customer",v:b.customer},{p:"Location",v:b.location},{p:"Tags comma separated",v:b.tags.join(", ")},{p:"Weight 0-100",v:String(b.weight)},{p:"Site locations",v:b.siteLocations.join(", ")},{p:"Image paths, comma separated",v:b.images.map(imgPath).join(", ")}
  ]); if(!vals)return null;
  b.title=vals[0]||"Untitled Image Block"; b.summary=vals[1]||"Completed Spray GenX project."; b.customer=vals[2]; b.location=vals[3]; b.tags=csv(vals[4]); b.weight=Math.max(0,Math.min(100,Number(vals[5])||25)); b.priority=b.weight; b.siteLocations=csv(vals[6]); if(!b.siteLocations.length)b.siteLocations=DEFAULT_VIEWS.slice(); b.views=Object.fromEntries(b.siteLocations.map(v=>[v,true]));
  let paths=csv(vals[7]); if(paths.length)b.images=paths.map((p,i)=>({path:p,caption:"",alt:b.title,visible:true,role:i===0?"cover":""}));
  b.category=await pickCategory(false,[b.category]); b.categories=await pickCategory(true,b.categories&&b.categories.length?b.categories:[b.category]); if(!b.categories.includes(b.category))b.categories.unshift(b.category);
  let st=await choose("Status",["draft","published","hidden","archived"].map(x=>({label:x,id:x})),`Current: ${b.status}`); if(st)b.status=st.id; b.visible=b.status!=="hidden";
  b.id=b.id||`${slug(b.title)}-${stamp()}`; b.slug=slug(b.title); b.cover=b.cover||(b.images[0]&&b.images[0].path)||"";
  return b;
}
async function newBlock(){let b=await editBlock(null);if(!b)return;if(await confirm("Upload Images Now?","Select JPG/PNG files and attach them to this Image Block.","Upload Images")){let imgs=await uploadImagesForBlock(b);b.images.push(...imgs);if(!b.cover&&imgs[0])b.cover=imgs[0].path}LIB.json.blocks.unshift(b);await saveLibrary(`Studio add image block: ${b.title}`);await alertMsg("Saved",`${b.title}\n\nImage Block created with ${b.images.length} image(s).`)}
async function chooseBlock(){let blocks=LIB.json.blocks||[];let item=await choose("Image Blocks",blocks.map((b,i)=>({label:`${b.title} — ${categoryLabel(b.category)} — ${b.images.length} img`,i})));return item?blocks[item.i]:null}
async function manageBlock(){let b=await chooseBlock();if(!b)return;let act=await choose(b.title,["Edit Block","Upload / Add Images","View Images / Paths","Hide / Show","Copy Block JSON","Health"].map(x=>({label:x,id:x})));if(!act)return;
  if(act.id==="Edit Block"){let nb=await editBlock(b);if(!nb)return;Object.assign(b,nb);await saveLibrary(`Studio edit image block: ${b.title}`)}
  if(act.id==="Upload / Add Images"){let imgs=await uploadImagesForBlock(b);b.images.push(...imgs);if(!b.cover&&imgs[0])b.cover=imgs[0].path;await saveLibrary(`Studio add images to block: ${b.title}`);await alertMsg("Images Added",`${imgs.length} image(s) uploaded.`)}
  if(act.id==="View Images / Paths"){await alertMsg(b.title,b.images.map((im,i)=>`${i+1}. ${im.visible===false?"[hidden] ":""}${imgPath(im)}`).join("\n")||"No images")}
  if(act.id==="Hide / Show"){b.visible=b.visible===false?true:false;b.status=b.visible?"published":"hidden";await saveLibrary(`Studio toggle image block: ${b.title}`)}
  if(act.id==="Copy Block JSON"){Pasteboard.copy(JSON.stringify(b,null,2));await alertMsg("Copied","Block JSON copied to clipboard.")}
  if(act.id==="Health"){let h=health(b);await alertMsg("Health",h.length?`Needs: ${h.join(", ")}`:"Looks good.")}
}
function convertedImages(c){return (c.images||[]).filter(x=>x.converted&&x.status!=="ignored")}
function usedPaths(){let s=new Set();(LIB.json.blocks||[]).forEach(b=>(b.images||[]).forEach(im=>{let p=imgPath(im);if(p)s.add(p)}));return s}
async function publishConverted(){let cf;try{cf=await getJson(CONVERTED_PATH)}catch(e){await alertMsg("No converted index","data/converted-images.json was not found yet.");return}let used=usedPaths(),avail=convertedImages(cf.json).filter(x=>!used.has(x.converted));if(!avail.length){await alertMsg("Nothing New","No unpublished converted images found.");return}let groups={};avail.forEach(x=>{let f=folderOf(x.converted);(groups[f]=groups[f]||[]).push(x)});let keys=Object.keys(groups).sort().reverse();let pick=await choose("Converted Batch",keys.map(k=>({label:`${k} — ${groups[k].length}`,id:k})).concat([{label:`All unpublished — ${avail.length}`,id:"__all"}]));if(!pick)return;let batch=pick.id==="__all"?avail:groups[pick.id];let title=await ask("Block Title",titleCase(pick.id==="__all"?folderOf(batch[0].converted):pick.id),titleCase(pick.id==="__all"?folderOf(batch[0].converted):pick.id));if(!title)return;let summary=await ask("Summary","Completed Spray GenX project.","Completed Spray GenX project.");let tags=csv(await ask("Tags","painting, refinishing, completed work","painting, refinishing, completed work"));let cat=await pickCategory(false,[]);let b={id:`${slug(title)}-${stamp()}`,slug:slug(title),title,summary:summary||"Completed Spray GenX project.",customer:"",location:"",date:today(),category:cat,categories:[cat],tags,status:"published",visible:true,weight:25,priority:25,views:{library:true,latest:true,search:true},siteLocations:DEFAULT_VIEWS.slice(),fallback:"latest",cover:batch[0].converted,images:batch.map((x,i)=>({path:x.converted,caption:"",alt:title,visible:true,role:i===0?"cover":""}))};LIB.json.blocks.unshift(b);await saveLibrary(`Studio publish converted block: ${title}`);await alertMsg("Published",`${title}\n${b.images.length} converted image(s) added.`)}
async function healthCheck(){let rows=[];LIB.json.blocks.forEach(b=>{let h=health(b);if(h.length)rows.push(`${b.title}: ${h.join(", ")}`)});await alertMsg("Health Check",rows.length?rows.join("\n\n"):"No obvious issues found.")}
async function counts(){let blocks=LIB.json.blocks||[],imgs=blocks.reduce((n,b)=>n+b.images.filter(i=>i.visible!==false).length,0),published=blocks.filter(b=>b.visible!==false&&b.status!=="draft").length;await alertMsg("Studio Counts",`Blocks: ${blocks.length}\nPublished: ${published}\nVisible images: ${imgs}\nCategories: ${(LIB.json.categories||[]).length}`)}
async function exportJson(){Pasteboard.copy(JSON.stringify(LIB.json,null,2));await alertMsg("Exported","Current image-library.json copied to clipboard.")}
async function main(){await load();while(true){let a=await choose("Spray GenX Portfolio Studio",[
  {label:"+ New Image Block",id:"new"},{label:"Edit / View Image Blocks",id:"manage"},{label:"Publish Converted Images",id:"converted"},{label:"Health Check",id:"health"},{label:"Counts",id:"counts"},{label:"Export JSON",id:"export"},{label:"Done",id:"done"}
]); if(!a||a.id==="done")break; if(a.id==="new")await newBlock(); if(a.id==="manage")await manageBlock(); if(a.id==="converted")await publishConverted(); if(a.id==="health")await healthCheck(); if(a.id==="counts")await counts(); if(a.id==="export")await exportJson();}}

main().catch(async e=>{await alertMsg("Studio Error",String(e.message||e))});
