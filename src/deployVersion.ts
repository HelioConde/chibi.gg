declare const __APP_VERSION__: string;

type DeployVersionPayload={
  version?:string;
  deployedAt?:string;
};

const CURRENT_VERSION=typeof __APP_VERSION__==="string" ? __APP_VERSION__ : "dev";
const CHECK_INTERVAL_MS=60000;

let timer:number|null=null;
let updating=false;

function versionUrl(){
  const url=new URL(import.meta.env.BASE_URL+"version.json",window.location.origin);
  url.searchParams.set("_",String(Date.now()));
  return url.toString();
}

function showUpdateNotice(version:string){
  if(document.querySelector(".deploy-update-toast"))return;

  const toast=document.createElement("div");
  toast.className="deploy-update-toast";
  toast.setAttribute("role","status");

  const message=document.createElement("span");
  message.textContent="Uma nova versão do Chibi está disponível.";
  const button=document.createElement("button");
  button.type="button";
  button.className="deploy-update-button";
  button.textContent="Atualizar agora";
  button.addEventListener("click",()=>forceFreshReload(version));

  const dismiss=document.createElement("button");
  dismiss.type="button";
  dismiss.className="deploy-update-dismiss";
  dismiss.textContent="Depois";
  dismiss.setAttribute("aria-label","Fechar aviso de atualização");
  dismiss.addEventListener("click",()=>toast.remove());

  toast.append(message,button,dismiss);
  document.body.appendChild(toast);
}

function forceFreshReload(version:string){
  const url=new URL(window.location.href);
  url.searchParams.set("__deploy",version.slice(0,12));
  window.location.replace(url.toString());
}

async function checkForDeploy(){
  if(updating||document.hidden||CURRENT_VERSION==="dev")return;

  try{
    const response=await fetch(versionUrl(),{
      cache:"no-store",
      headers:{
        "cache-control":"no-cache",
        "pragma":"no-cache",
      },
    });

    if(!response.ok)return;

    const payload=await response.json() as DeployVersionPayload;
    const nextVersion=String(payload.version||"").trim();

    if(!nextVersion||nextVersion===CURRENT_VERSION)return;

    updating=true;
    showUpdateNotice(nextVersion);
  }catch{
    // A falha de checagem nunca deve atrapalhar o uso normal do site.
  }
}

function cleanReloadMarker(){
  const url=new URL(window.location.href);
  if(!url.searchParams.has("__deploy"))return;

  url.searchParams.delete("__deploy");
  window.history.replaceState(window.history.state,"",url.toString());
}

export function startDeployWatcher(){
  if(typeof window==="undefined"||CURRENT_VERSION==="dev")return ()=>{};

  cleanReloadMarker();

  const onFocus=()=>{ void checkForDeploy(); };
  const onVisibility=()=>{
    if(!document.hidden)void checkForDeploy();
  };

  // Version polling should not compete with the first meaningful paint.
  window.setTimeout(()=>{ void checkForDeploy(); },8000);
  timer=window.setInterval(()=>{ void checkForDeploy(); },CHECK_INTERVAL_MS);

  window.addEventListener("focus",onFocus);
  document.addEventListener("visibilitychange",onVisibility);

  return ()=>{
    if(timer!==null){
      window.clearInterval(timer);
      timer=null;
    }
    window.removeEventListener("focus",onFocus);
    document.removeEventListener("visibilitychange",onVisibility);
  };
}
