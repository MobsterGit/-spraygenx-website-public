// Spray GenX Image Uploader — v3.9 SAFE
// Existing-block selector + single and bulk uploads.
// Paste your GitHub token below. This uploader NEVER creates a block by guessing a typed name.

const OWNER="MobsterGit";
const REPO="-spraygenx-website-public";
const BRANCH="main";
const GITHUB_TOKEN="token-here";
const LIBRARY_PATH="data/image-library.json";
const INBOX_ROOT="images/inbox";

const api=p=>`https://api.github.com/repos/${OWNER}/${REPO}/contents/${p}`;
function stamp(){return new Date().toISOString().replace(/[-:T.Z]/g,"").slice(0,14)}
function slug(v){return String(v||"block").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80)||"block"}
function b64(s){return Data.fromString(s).toBase64String()}
function decode(s){return Data.fromBase64String(String(s||"").replace(/\n/g,"")).toRawString()}
function imgPath(i){return typeof i==="string"?i:(i&&i.path?i.path:"")}
function nowTime(){return new Date().toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}

async function alertMsg(title,msg){let a=new Alert();a.title=title;a.message=msg||"";a.addAction("OK");await a.presentAlert()}
async function choose(title,items,msg=""){let a=new Alert();a.title=title;if(msg)a.message=msg;items.forEach(x=>a.addAction(x.label));a.addCancelAction("Cancel");let i=await a.presentSheet();return i<0?null:items[i]}
async function gh(path,method="GET",body=null){
  if(!GITHUB_TOKEN||GITHUB_TOKEN==="token-here")throw new Error("Paste your GitHub token into GITHUB_TOKEN first.");
  let r=new Request(api(path)+(method==="GET"?`?ref=${BRANCH}&_=${Date.now()}`:""));r.method=method;
  r.headers={Authorization:`Bearer ${GITHUB_TOKEN}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
  if(body){r.headers["Content-Type"]="application/json";r.body=JSON.stringify(body)}
  let j=await r.loadJSON();if(r.response.statusCode<200||r.response.statusCode>299)throw new Error(`${method} ${path}\nHTTP ${r.response.statusCode}\n${JSON.stringify(j,null,2)}`);return j;
}
async function getLibrary(){let f=await gh(LIBRARY_PATH);let json=JSON.parse(decode(f.content));if(!Array.isArray(json.blocks))throw new Error("SAFETY STOP: live library has no blocks array.");return{json,sha:f.sha}}
async function putLibrary(obj,sha,msg){return await gh(LIBRARY_PATH,"PUT",{message:msg,content:b64(JSON.stringify(obj,null,2)+"\n"),sha,branch:BRANCH})}
async function putBinary(path,data,msg){return await gh(path,"PUT",{message:msg,content:data.toBase64String(),branch:BRANCH})}

async function selectExistingBlock(){
  let live=await getLibrary();
  let blocks=live.json.blocks.slice().sort((a,b)=>String(a.title||"").localeCompare(String(b.title||"")));
  if(!blocks.length){await alertMsg("No Image Blocks","Create the project block first, then upload photos to it.");return null}
  let items=blocks.map(b=>({label:`${b.title||b.id}  ·  ${(b.images||[]).length} photos`,block:b}));
  let pick=await choose("Select Existing Project",items,"Choose exactly where these photos belong. Attachment uses the permanent block ID.");
  return pick?pick.block:null;
}

function uniqueName(i){return `photo-${stamp()}-${String(i+1).padStart(2,"0")}.jpg`}
async function imageToJpegData(img,i){let fm=FileManager.local(),p=fm.joinPath(fm.temporaryDirectory(),uniqueName(i));fm.writeImage(p,img);let d=fm.read(p);try{fm.remove(p)}catch(_){}return d}

async function attachByBlockId(blockId,paths){
  let live=await getLibrary(),beforeCount=live.json.blocks.length,idx=live.json.blocks.findIndex(b=>b.id===blockId);
  if(idx<0)throw new Error("SAFETY STOP: selected block no longer exists in the current GitHub library.");
  let b=live.json.blocks[idx],beforeImages=(b.images||[]).length,existing=new Set((b.images||[]).map(imgPath));
  b.images=Array.isArray(b.images)?b.images:[];
  for(let p of paths)if(!existing.has(p))b.images.push({path:p,caption:"",alt:b.title||"Spray GenX project photo",visible:true,role:""});
  if(!b.cover&&b.images.length){b.cover=imgPath(b.images[0]);if(typeof b.images[0]==="object")b.images[0].role="cover"}
  live.json.blocks[idx]=b;live.json.updated=new Date().toISOString().slice(0,10);
  if(live.json.blocks.length!==beforeCount)throw new Error("SAFETY STOP: unrelated block count changed. Library was not written.");
  await putLibrary(live.json,live.sha,`Attach ${paths.length} image(s) to ${b.title}`);
  let check=await getLibrary(),saved=check.json.blocks.find(x=>x.id===blockId);
  if(!saved)throw new Error("VERIFY FAILED: target block was not read back.");
  if(check.json.blocks.length!==beforeCount)throw new Error("VERIFY FAILED: library block count changed.");
  let savedPaths=new Set((saved.images||[]).map(imgPath)),missing=paths.filter(p=>!savedPaths.has(p));
  if(missing.length)throw new Error(`VERIFY FAILED: ${missing.length} uploaded image(s) are not attached to the selected block.`);
  if((saved.images||[]).length<beforeImages+paths.filter(p=>!existing.has(p)).length)throw new Error("VERIFY FAILED: image count is lower than expected.");
  return saved;
}

async function uploadImagesToBlock(block,images){
  if(!images||!images.length)return;
  let paths=[],failed=[];
  for(let i=0;i<images.length;i++){
    let name=uniqueName(i),path=`${INBOX_ROOT}/${slug(block.slug||block.title||block.id)}/${name}`;
    try{let data=await imageToJpegData(images[i],i);await putBinary(path,data,`Upload ${i+1}/${images.length}: ${block.title}`);paths.push(path)}catch(e){failed.push(`${i+1}: ${String(e.message||e)}`)}
  }
  if(!paths.length)throw new Error(`No photos uploaded.\n${failed.join("\n")}`);
  let saved=await attachByBlockId(block.id,paths);
  let msg=`${saved.title}\n\n${paths.length} photo${paths.length===1?"":"s"} uploaded\n${paths.length} attached to existing block\nGitHub read-back verified: ${nowTime()}`;
  if(failed.length)msg+=`\n\n⚠ ${failed.length} photo${failed.length===1?"":"s"} failed before attachment.\n${failed.join("\n")}`;
  await alertMsg(failed.length?"⚠ PARTIAL UPLOAD — VERIFIED":"✓ PHOTOS UPLOADED & VERIFIED",msg);
}

async function uploadOne(){
  let block=await selectExistingBlock();if(!block)return;
  let img;try{img=await Photos.fromLibrary()}catch(_){return}if(!img)return;
  try{await uploadImagesToBlock(block,[img])}catch(e){await alertMsg("✕ UPLOAD FAILED — NOT VERIFIED",String(e.message||e))}
}

async function pickBulkImages(){
  // Scriptable's Photos picker is single-select. This loop gives a reliable bulk queue:
  // choose a photo, tap Add Another, repeat, then Upload Selected.
  let images=[];
  while(true){
    let img;try{img=await Photos.fromLibrary()}catch(_){break}if(!img)break;images.push(img);
    let next=await choose("Bulk Upload Queue",[{label:"Add Another Photo",id:"add"},{label:`Upload ${images.length} Selected Photo${images.length===1?"":"s"}`,id:"done"}],`${images.length} photo${images.length===1?"":"s"} queued.`);
    if(!next||next.id==="done")break;
  }
  return images;
}
async function uploadBulk(){
  let block=await selectExistingBlock();if(!block)return;
  let images=await pickBulkImages();if(!images.length)return;
  try{await uploadImagesToBlock(block,images)}catch(e){await alertMsg("✕ BULK UPLOAD FAILED — NOT VERIFIED",String(e.message||e))}
}

async function main(){
  while(true){
    let a=await choose("Spray GenX Image Uploader v3.9 SAFE",[{label:"Upload One Photo → Existing Block",id:"one"},{label:"Bulk Upload → Existing Block",id:"bulk"},{label:"Done",id:"done"}],"No typed project names. Select the existing block first; attachment is by permanent block ID.");
    if(!a||a.id==="done")break;if(a.id==="one")await uploadOne();if(a.id==="bulk")await uploadBulk();
  }
}
main().catch(async e=>await alertMsg("Uploader Error",String(e.message||e)));
