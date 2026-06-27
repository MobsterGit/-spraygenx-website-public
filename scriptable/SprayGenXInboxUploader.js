// Spray GenX Inbox Uploader v1.0
// Separate Scriptable script for raw photo intake.
// Replace only GITHUB_TOKEN. Uploads mixed image types to images/inbox/.
// GitHub Actions converts them to web-ready JPEGs in images/converted/.

const OWNER="MobsterGit",REPO="-spraygenx-website-public",BRANCH="main",GITHUB_TOKEN="PASTE_NEW_TOKEN_HERE",MAX_BATCH=30;
const INBOX_ROOT="images/inbox";
const ALLOWED=["heic","heif","jpg","jpeg","png","webp","tif","tiff","bmp","gif"];
const api=p=>`https://api.github.com/repos/${OWNER}/${REPO}/contents/${p}`;

function stamp(){return new Date().toISOString().replace(/[-:T.Z]/g,"").slice(0,14)}
function today(){return new Date().toISOString().slice(0,10)}
function slug(v){return String(v||"upload").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70)||"upload"}
function ext(path){let m=String(path||"").toLowerCase().match(/\.([a-z0-9]+)$/);return m?m[1]:""}
function base(path){return String(path||"").split('/').pop().replace(/\.[^.]+$/,'')||"image"}
function cleanFolder(v){return slug(v||today())}

async function gh(url,method="GET",body=null){let r=new Request(url);r.method=method;r.headers={Authorization:`Bearer ${GITHUB_TOKEN}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};if(body){r.headers["Content-Type"]="application/json";r.body=JSON.stringify(body)}let j=await r.loadJSON();if(j.message&&j.documentation_url)throw new Error(JSON.stringify(j,null,2));return j}
async function put(path,data,msg){return await gh(api(path),"PUT",{message:msg,content:data.toBase64String(),branch:BRANCH})}
async function ask(title,ph,val=""){let a=new Alert();a.title=title;a.addTextField(ph,val);a.addAction("OK");a.addCancelAction("Cancel");let r=await a.presentAlert();if(r<0)throw new Error("Cancelled");return a.textFieldValue(0).trim()}
async function yesNo(title,msg,yes="Add More",no="Done"){let a=new Alert();a.title=title;a.message=msg;a.addAction(yes);a.addCancelAction(no);return await a.presentAlert()===0}
async function pickerOnce(){let out;try{out=await DocumentPicker.openFile([],true)}catch(e){out=await DocumentPicker.openFile()}return Array.isArray(out)?out:[out]}
async function pickItems(){let paths=[],seen=new Set();while(paths.length<MAX_BATCH){let picked=await pickerOnce();for(let p of picked){if(!p||seen.has(p))continue;seen.add(p);paths.push(p);if(paths.length>=MAX_BATCH)break}if(paths.length>=MAX_BATCH)break;if(picked.length>1)break;let more=await yesNo("Add More Files?",`${paths.length} file(s) selected. Add more to this same inbox upload?\n\nLimit: ${MAX_BATCH}`,"Add More","Done");if(!more)break}let bad=paths.filter(p=>!ALLOWED.includes(ext(p)));if(bad.length)throw new Error(`Unsupported file type. Allowed: ${ALLOWED.join(", ")}`);let fm=FileManager.local();return paths.slice(0,MAX_BATCH).map(p=>({path:p,ext:ext(p),name:base(p),data:fm.read(p)}))}
async function uploadRawInbox(){let folder=await ask("Inbox Folder Name","Example: residential-interiors-wadsworth",today());folder=cleanFolder(folder);let items=await pickItems();if(!items.length)throw new Error("No files selected");let run=stamp(),uploaded=[];for(let i=0;i<items.length;i++){let n=String(i+1).padStart(3,"0"),safe=`${slug(items[i].name)}-${run}-${n}.${items[i].ext}`,repoPath=`${INBOX_ROOT}/${folder}/${safe}`;await put(repoPath,items[i].data,`Inbox upload: ${safe}`);uploaded.push(repoPath)}let a=new Alert();a.title="Inbox Upload Complete";a.message=`${uploaded.length} file(s) uploaded to:\n${INBOX_ROOT}/${folder}/\n\nGitHub will now convert them to web JPEG files in images/converted/.`;a.addAction("OK");await a.present()}
async function instructions(){let a=new Alert();a.title="How This Works";a.message=`1. Upload raw mixed images here.\n2. GitHub Action converts them in the background.\n3. Web-ready JPEGs appear in images/converted/.\n\nAllowed:\n${ALLOWED.join(", ")}\n\nThis does not publish them directly to the website yet.`;a.addAction("OK");await a.present()}
async function menu(){let a=new Alert();a.title="Spray GenX Inbox Uploader";a.message=`Raw intake uploader\nBatch limit: ${MAX_BATCH} files`;a.addAction("Upload Raw Images");a.addAction("How This Works");a.addCancelAction("Cancel");return await a.presentAlert()}
try{if(!GITHUB_TOKEN||GITHUB_TOKEN==="PASTE_NEW_TOKEN_HERE")throw new Error("Paste your GitHub token into GITHUB_TOKEN first.");let c=await menu();if(c===0)await uploadRawInbox();else if(c===1)await instructions()}catch(e){let a=new Alert();a.title="Error";a.message=String(e);a.addAction("OK");await a.present()}
