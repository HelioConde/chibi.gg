export type TftStaticEntry = {
  id?: string;
  name?: string;
  tier?: number | string;
  image?: { full?: string; group?: string };
};

export type TftStaticData = {
  version: string;
  champions: Record<string,TftStaticEntry>;
  items: Record<string,TftStaticEntry>;
  traits: Record<string,TftStaticEntry>;
  augments: Record<string,TftStaticEntry>;
  queues: Record<string,TftStaticEntry & { queueType?: string }>;
};

let cached: Promise<TftStaticData> | null = null;

async function fetchJson(url:string){
  const response=await fetch(url);
  if(!response.ok) throw new Error("Falha ao carregar assets TFT");
  return response.json();
}

export function loadTftStaticData():Promise<TftStaticData>{
  if(cached) return cached;

  cached=(async()=>{
    const versions=await fetchJson("https://ddragon.leagueoflegends.com/api/versions.json");
    const version=Array.isArray(versions)&&versions[0]?String(versions[0]):"16.17.1";
    const base="https://ddragon.leagueoflegends.com/cdn/"+version+"/data/pt_BR/";

    const [champion,item,trait,augment,queues]=await Promise.all([
      fetchJson(base+"tft-champion.json"),
      fetchJson(base+"tft-item.json"),
      fetchJson(base+"tft-trait.json"),
      fetchJson(base+"tft-augment.json").catch(()=>({data:{}})),
      fetchJson(base+"tft-queues.json").catch(()=>({data:{}})),
    ]);

    return {
      version,
      champions:champion?.data||{},
      items:item?.data||{},
      traits:trait?.data||{},
      augments:augment?.data||{},
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

export function tftAssetUrl(version:string, kind:"champion"|"item"|"trait"|"augment", entry?:TftStaticEntry){
  const full=entry?.image?.full;
  if(!full) return "";
  return "https://ddragon.leagueoflegends.com/cdn/"+version+"/img/tft-"+kind+"/"+encodeURIComponent(full);
}
