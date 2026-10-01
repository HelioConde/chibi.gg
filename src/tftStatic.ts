export type TftStaticEntry = {
  id?: string | number;
  name?: string;
  tier?: number | string;
  queueId?: string | number;
  queueType?: string;
  image?: { full?: string; group?: string };
  traits?: string[];
};

export type TftStaticData = {
  version: string;
  champions: Record<string,TftStaticEntry>;
  items: Record<string,TftStaticEntry>;
  traits: Record<string,TftStaticEntry>;
  augments: Record<string,TftStaticEntry>;
  tacticians: Record<string,TftStaticEntry>;
  queues: Record<string,TftStaticEntry>;
};

let cached: Promise<TftStaticData> | null = null;

async function fetchJson(url:string){
  const response=await fetch(url);
  if(!response.ok) throw new Error("Falha ao carregar assets TFT");
  return response.json();
}

function normalizeCommunityId(value:unknown){
  const raw=String(value??"").trim();
  if(!raw)return "";
  const last=raw.split(/[\\/]/).pop()||raw;
  return last.replace(/\.json$/i,"").trim().toLowerCase();
}

function communityTraitValue(value:unknown){
  if(typeof value==="string")return value.trim();

  if(value&&typeof value==="object"){
    const row=value as Record<string,unknown>;
    const candidate=
      row.id ??
      row.apiName ??
      row.api_name ??
      row.key ??
      row.name ??
      row.displayName;

    return typeof candidate==="string" ? candidate.trim() : "";
  }

  return "";
}

function addCommunityChampion(
  map:Map<string,string[]>,
  value:unknown,
){
  if(!value||typeof value!=="object")return;

  const obj=value as Record<string,unknown>;
  const nested=(obj.character_record||obj.characterRecord) as Record<string,unknown>|undefined;
  const record=nested&&typeof nested==="object" ? nested : obj;

  const characterId=
    record.character_id ??
    record.characterId ??
    record.apiName ??
    record.api_name ??
    record.id ??
    obj.character_id ??
    obj.characterId ??
    obj.apiName ??
    obj.api_name ??
    obj.id;

  const key=normalizeCommunityId(characterId);
  if(!key)return;

  const rawTraits=
    record.traits ??
    record.Traits ??
    obj.traits ??
    obj.Traits;

  if(!Array.isArray(rawTraits))return;

  const traits=[...new Set(
    rawTraits
      .map(communityTraitValue)
      .filter((trait):trait is string=>Boolean(trait))
  )];

  if(traits.length)map.set(key,traits);
}

function buildCommunityTraitMap(payload:unknown){
  const map=new Map<string,string[]>();

  if(Array.isArray(payload)){
    payload.forEach((row)=>addCommunityChampion(map,row));
    return map;
  }

  if(payload&&typeof payload==="object"){
    for(const value of Object.values(payload as Record<string,unknown>)){
      if(Array.isArray(value)){
        value.forEach((row)=>addCommunityChampion(map,row));
      }
    }
  }

  return map;
}

async function fetchCommunityChampionTraits(){
  const root="https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/";

  const teamplanner=await fetchJson(root+"tftchampions-teamplanner.json").catch(()=>null);
  const primary=buildCommunityTraitMap(teamplanner);
  if(primary.size)return primary;

  const champions=await fetchJson(root+"tftchampions.json").catch(()=>null);
  return buildCommunityTraitMap(champions);
}

function mergeCommunityChampionTraits(
  champions:Record<string,TftStaticEntry>,
  communityTraits:Map<string,string[]>,
){
  if(!communityTraits.size)return champions;

  const merged:Record<string,TftStaticEntry>={};

  for(const [key,entry] of Object.entries(champions)){
    const candidates=[
      normalizeCommunityId(key),
      normalizeCommunityId(entry.id),
    ].filter(Boolean);

    let traits:string[]|undefined;
    for(const candidate of candidates){
      traits=communityTraits.get(candidate);
      if(traits?.length)break;
    }

    merged[key]=traits?.length
      ? {...entry,traits}
      : entry;
  }

  return merged;
}

export function loadTftStaticData():Promise<TftStaticData>{
  if(cached) return cached;

  cached=(async()=>{
    const versions=await fetchJson("https://ddragon.leagueoflegends.com/api/versions.json");
    const version=Array.isArray(versions)&&versions[0]?String(versions[0]):"16.17.1";
    const base="https://ddragon.leagueoflegends.com/cdn/"+version+"/data/pt_BR/";

    const [champion,item,trait,augment,tactician,queues,communityTraits]=await Promise.all([
      fetchJson(base+"tft-champion.json"),
      fetchJson(base+"tft-item.json"),
      fetchJson(base+"tft-trait.json"),
      fetchJson(base+"tft-augments.json").catch(()=>({data:{}})),
      fetchJson(base+"tft-tactician.json").catch(()=>({data:{}})),
      fetchJson(base+"tft-queues.json").catch(()=>({data:{}})),
      fetchCommunityChampionTraits().catch(()=>new Map<string,string[]>()),
    ]);

    const champions=mergeCommunityChampionTraits(
      (champion?.data||{}) as Record<string,TftStaticEntry>,
      communityTraits,
    );

    return {
      version,
      champions,
      items:item?.data||{},
      traits:trait?.data||{},
      augments:augment?.data||{},
      tacticians:tactician?.data||{},
      queues:queues?.data||{},
    };
  })();

  return cached;
}

export function staticEntry(
  data:Record<string,TftStaticEntry>|undefined,
  id:string|undefined,
):TftStaticEntry|undefined{
  if(!data||!id) return undefined;
  if(data[id]) return data[id];

  const normalized=id.toLowerCase();
  return Object.values(data).find((entry)=>
    String(entry.id||"").toLowerCase()===normalized
  );
}

export function tftAssetUrl(version:string, kind:"champion"|"item"|"trait"|"augment"|"tactician", entry?:TftStaticEntry){
  const full=entry?.image?.full;
  if(!full) return "";
  return "https://ddragon.leagueoflegends.com/cdn/"+version+"/img/tft-"+kind+"/"+encodeURIComponent(full);
}

export function profileIconUrl(version:string,profileIconId?:number){
  const id=Number(profileIconId)||0;
  if(!id) return "";
  return "https://ddragon.leagueoflegends.com/cdn/"+version+"/img/profileicon/"+id+".png";
}

export function latestTftSetNumber(data:TftStaticData|null){
  if(!data) return null;
  let latest=0;
  for(const [key,entry] of Object.entries(data.champions)){
    const source=key+" "+String(entry.id||"")+" "+String(entry.image?.full||"");
    const matches=[...source.matchAll(/TFT(?:Set)?(\d+)[_\.]/gi)];
    for(const match of matches){
      latest=Math.max(latest,Number(match[1])||0);
    }
  }
  return latest||null;
}


export function queueLabel(data:TftStaticData|null, queueId?:number){
  if(queueId==null) return "Todas";
  const raw=String(queueId);
  const entry=data?.queues?.[raw] || Object.values(data?.queues||{}).find((item)=>
    String(item.queueId??item.id??"")===raw
  );
  const name=String(entry?.name||entry?.queueType||"").trim();
  if(name) return name
    .replace(/Teamfight Tactics/gi,"TFT")
    .replace(/\s+/g," ")
    .trim();

  const fallback:Record<number,string>={
    1090:"Normal",
    1100:"Ranked",
    1110:"Tutorial",
    1130:"Hyper Roll",
    1150:"Double Up",
    1160:"Double Up",
  };
  return fallback[queueId] || "Fila "+queueId;
}
