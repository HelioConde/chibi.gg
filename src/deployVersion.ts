declare const __APP_VERSION__: string;

type DeployVersionPayload={
  version?:string;
  deployedAt?:string;
};

const CURRENT_VERSION=typeof __APP_VERSION__==="string" ? __APP_VERSION__ : "dev";
const CHECK_INTERVAL_MS=12000;
const RELOAD_DELAY_MS=900;

let timer:number|null=null;
let updating=false;

function versionUrl(){
  const url=new URL(import.meta.env.BASE_URL+"version.json",window.location.origin);
  url.searchParams.set("_",String(Date.now()));
  return url.toString();
}

function showUpdateNotice(){
  if(document.querySelector(".deploy-update-toast"))return;

  const toast=document.createElement("div");
  toast.className="deploy-update-toast";
  toast.setAttribute("role","status");
  toast.innerHTML="<span>Nova versão publicada.<br><small>Atualizando o Chibi automaticamente…</small></span>";
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
    showUpdateNotice();

    window.setTimeout(()=>{
      forceFreshReload(nextVersion);
    },RELOAD_DELAY_MS);
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

  window.setTimeout(()=>{ void checkForDeploy(); },2500);
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
