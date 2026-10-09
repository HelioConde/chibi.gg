import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const stylesPath=fileURLToPath(new URL("../src/styles.css", import.meta.url));
const polishPath=fileURLToPath(new URL("../src/quality-polish.css", import.meta.url));
const homePath=fileURLToPath(new URL("../src/styles-home.generated.css", import.meta.url));
const fullPath=fileURLToPath(new URL("../src/styles-full.generated.css", import.meta.url));

const original=await readFile(stylesPath,"utf8");
const polish=await readFile(polishPath,"utf8");

// Only move selectors belonging unequivocally to advanced screens.
// Mixed selectors, globals, .home-* and @keyframes always stay in the
// landing stylesheet. All original CSS is restored for advanced screens.
const advancedClass=/\.(?:profile-|player-|history-|match-|lobby-|leaderboard-|overlay-|statistics-|global-meta-|global-comps-|comp-row|comps-|builder-|dna-|coach-|riot-data-|guided-review-|journal-|lesson-|session-)/i;
function splitSelectors(value){
  const selectors=[];
  let start=0,depth=0,quote="",escaped=false;
  for(let i=0;i<value.length;i++){
    const ch=value[i];
    if(quote){
      if(escaped)escaped=false;
      else if(ch==="\\")escaped=true;
      else if(ch===quote)quote="";
      continue;
    }
    if(ch==="'"||ch==='"'){quote=ch;continue;}
    if(ch==="("||ch==="["){depth++;continue;}
    if(ch===")"||ch==="]"){depth--;continue;}
    if(ch===","&&depth===0){selectors.push(value.slice(start,i));start=i+1;}
  }
  selectors.push(value.slice(start));
  return selectors;
}
function advancedOnly(selector){
  return splitSelectors(selector).every(part=>
    advancedClass.test(part)&&
    !/\.home-|\.landing|\.topbar|\.global-search|\.mobile-product|\.site-footer|\.brand|\.site-background/i.test(part)
  );
}

const core=postcss.root(),advanced=postcss.root();
let moved=0,kept=0;
function partition(nodes,light,extra){
  for(const node of nodes){
    if(node.type==="rule"){
      if(advancedOnly(node.selector)){extra.append(node.clone());moved++;}
      else{light.append(node.clone());kept++;}
    }else if(node.type==="atrule"&&node.nodes&&/^(media|supports|container|layer)$/i.test(node.name)){
      const a=node.clone({nodes:[]}),b=node.clone({nodes:[]});
      partition(node.nodes,a,b);
      if(a.nodes?.length)light.append(a);
      if(b.nodes?.length)extra.append(b);
    }else{
      light.append(node.clone());
    }
  }
}
partition(postcss.parse(original,{from:stylesPath}).nodes,core,advanced);
const home=core.toString()+"\n"+polish+"\n";
const full=original+"\n"+polish+"\n";
await writeFile(homePath,home);
await writeFile(fullPath,full);
const totalBytes=Buffer.byteLength(original);
const removedBytes=totalBytes-Buffer.byteLength(core.toString());
console.log(`CSS route partition: ${kept} home/global rules, ${moved} advanced rules; ${(removedBytes/1024).toFixed(1)} KiB deferred (${(100*removedBytes/totalBytes).toFixed(1)}%).`);
if(moved<100||removedBytes<30000)throw Error("CSS split was ineffective: inspect selector classifications");
