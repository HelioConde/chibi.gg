import { corsHeaders, json } from "../_shared/http.ts";
import { num } from "../_shared/riot.ts";

function env(name:string){
  return Deno.env.get(name)||"";
}

function serviceHeaders(){
  const key=env("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey:key,
    Authorization:"Bearer "+key,
    "Content-Type":"application/json",
  };
}

function activeTraits(row:any){
  const traits=Array.isArray(row?.traits)?row.traits:[];
  return traits
    .filter((trait:any)=>num(trait?.numUnits)>0&&(num(trait?.style)>0||num(trait?.numUnits)>=2))
    .sort((a:any,b:any)=>num(b?.style)-num(a?.style)||num(b?.numUnits)-num(a?.numUnits))
    .slice(0,3)
    .map((trait:any)=>String(trait?.name||""))
    .filter(Boolean);
}

function traitPairSignature(row:any){
  return activeTraits(row).slice(0,2).sort().join("|");
}

function adaptiveSignature(
  row:any,
  pairCounts:Map<string,number>,
  threshold:number,
){
  const traits=activeTraits(row);
  if(!traits.length)return "";

  const base=traits[0];
  const pair=traits.slice(0,2).sort().join("|");
  if(pair&&pairCounts.get(pair)!==undefined&&(pairCounts.get(pair)||0)>=threshold){
    return pair;
  }

  return base;
}

function avg(values:number[]){
  return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
}

function round(value:number,digits=2){
  const p=Math.pow(10,digits);
  return Math.round(value*p)/p;
}

function stdev(values:number[]){
  if(values.length<2) return 0;
  const mean=avg(values);
  return Math.sqrt(avg(values.map(value=>(value-mean)**2)));
}

function confidence(games:number){
  if(games>=50) return "alta";
  if(games>=20) return "média";
  return "inicial";
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"method_not_allowed"},405);

  const supabaseUrl=env("SUPABASE_URL");
  const serviceRole=env("SUPABASE_SERVICE_ROLE_KEY");
  if(!supabaseUrl||!serviceRole){
    return json({error:"comps_backend_not_configured"},503);
  }

  let body:any={};
  try{body=await req.json();}catch{}

  let setNumber=Math.max(0,num(body?.setNumber));
  const queueId=Math.max(0,num(body?.queueId));
  const minGames=Math.max(2,Math.min(100,num(body?.minGames)||3));
  const limit=Math.max(1,Math.min(30,num(body?.limit)||16));

  if(!setNumber){
    const latestRes=await fetch(
      supabaseUrl+"/rest/v1/tft_participant_observations?select=set_number,played_at&set_number=gt.0&order=played_at.desc&limit=1",
      {headers:serviceHeaders()},
    );
    if(latestRes.ok){
      const latestRows=await latestRes.json();
      setNumber=Math.max(0,num(latestRows?.[0]?.set_number));
    }
  }

  const signatureThreshold=Math.max(3,minGames);

  if(!setNumber){
    return json({
      context:{
        setNumber:0,
        queueId:queueId||null,
        minGames,
        signatureMode:"adaptive-traits-v2",
        signatureThreshold,
      },
      sampleParticipants:0,
      comps:[],
    });
  }

  const filters=[
    "set_number=eq."+encodeURIComponent(setNumber),
    queueId?"queue_id=eq."+encodeURIComponent(queueId):"",
  ].filter(Boolean);

  const url=
    supabaseUrl+
    "/rest/v1/tft_participant_observations?select=placement,level,gold_left,traits,units&"+
    filters.join("&")+
    "&limit=5000";

  const response=await fetch(url,{headers:serviceHeaders()});
  if(!response.ok){
    return json({error:"comps_query_failed",status:response.status},502);
  }

  const rows=await response.json();
  const safeRows=Array.isArray(rows)?rows:[];
  const pairCounts=new Map<string,number>();

  for(const row of safeRows){
    const pair=traitPairSignature(row);
    if(!pair)continue;
    pairCounts.set(pair,(pairCounts.get(pair)||0)+1);
  }

  const groups=new Map<string,any[]>();
  for(const row of safeRows){
    const signature=adaptiveSignature(row,pairCounts,signatureThreshold);
    if(!signature) continue;
    const list=groups.get(signature)||[];
    list.push(row);
    groups.set(signature,list);
  }

  const comps=[...groups.entries()]
    .map(([signature,games])=>{
      const placements=games.map(row=>num(row?.placement)).filter(Boolean);
      const traitCounts=new Map<string,number>();
      const unitCounts=new Map<string,number>();
      const itemCounts=new Map<string,number>();
      const unitItemCounts=new Map<string,Map<string,number>>();

      for(const row of games){
        for(const trait of activeTraits(row)){
          traitCounts.set(trait,(traitCounts.get(trait)||0)+1);
        }

        const seen=new Set<string>();
        const seenItems=new Set<string>();
        for(const unit of Array.isArray(row?.units)?row.units:[]){
          const id=String(unit?.characterId||"");
          if(!id) continue;

          if(!seen.has(id)){
            seen.add(id);
            unitCounts.set(id,(unitCounts.get(id)||0)+1);
          }

          let perUnit=unitItemCounts.get(id);
          if(!perUnit){
            perUnit=new Map<string,number>();
            unitItemCounts.set(id,perUnit);
          }

          for(const itemRaw of Array.isArray(unit?.itemNames)?unit.itemNames:[]){
            const item=String(itemRaw||"");
            if(!item) continue;
            perUnit.set(item,(perUnit.get(item)||0)+1);
            if(!seenItems.has(item)){
              seenItems.add(item);
              itemCounts.set(item,(itemCounts.get(item)||0)+1);
            }
          }
        }
      }

      const traits=[...traitCounts.entries()]
        .sort((a,b)=>b[1]-a[1])
        .slice(0,4)
        .map(([id,count])=>({id,rate:round(count/games.length*100,1)}));

      const units=[...unitCounts.entries()]
        .sort((a,b)=>b[1]-a[1])
        .slice(0,8)
        .map(([id,count])=>({id,rate:round(count/games.length*100,1)}));


      const items=[...itemCounts.entries()]
        .sort((a,b)=>b[1]-a[1])
        .slice(0,8)
        .map(([id,count])=>({id,rate:round(count/games.length*100,1)}));

      const unitItems=units.map(unit=>{
        const appearances=Math.max(1,unitCounts.get(unit.id)||1);
        const perUnit=unitItemCounts.get(unit.id)||new Map<string,number>();
        return {
          unitId:unit.id,
          items:[...perUnit.entries()]
            .sort((a,b)=>b[1]-a[1])
            .slice(0,3)
            .map(([id,count])=>({id,rate:round(count/appearances*100,1)})),
        };
      });

      return {
        id:signature,
        games:games.length,
        averagePlacement:round(avg(placements),2),
        top4Rate:round(placements.filter(value=>value<=4).length/games.length*100,1),
        winRate:round(placements.filter(value=>value===1).length/games.length*100,1),
        volatility:round(stdev(placements),2),
        averageLevel:round(avg(games.map(row=>num(row?.level)).filter(Boolean)),2),
        averageGold:round(avg(games.map(row=>num(row?.gold_left))),1),
        confidence:confidence(games.length),
        traits,
        units,
        items,
        unitItems,
      };
    })
    .filter(comp=>comp.games>=minGames)
    .sort((a,b)=>{
      const scoreA=(8.5-a.averagePlacement)*.45+a.top4Rate*.025+Math.min(20,a.games)*.06;
      const scoreB=(8.5-b.averagePlacement)*.45+b.top4Rate*.025+Math.min(20,b.games)*.06;
      return scoreB-scoreA||b.games-a.games;
    })
    .slice(0,limit);

  return json({
    context:{
      setNumber,
      queueId:queueId||null,
      minGames,
      signatureMode:"adaptive-traits-v2",
      signatureThreshold,
    },
    sampleParticipants:safeRows.length,
    comps,
  });
});
