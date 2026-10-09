import {getOrFetchMatches} from "../../supabase/functions/_shared/matchCache.ts";

function assert(condition:unknown,message:string):asserts condition{
  if(!condition)throw new Error(message);
}

function rawMatch(id:string){
  return {
    metadata:{match_id:id},
    info:{
      game_datetime:Date.now(),
      game_length:1800,
      queue_id:1100,
      tft_set_number:18,
      participants:[],
    },
  };
}

Deno.test("Riot match detail fetching stays below four simultaneous requests",async()=>{
  const original=globalThis.fetch;
  let active=0,maxActive=0,calls=0;
  try{
    globalThis.fetch=(async(input)=>{
      const id=decodeURIComponent(String(input).split("/").at(-1)||"");
      calls++;
      active++;
      maxActive=Math.max(active,maxActive);
      try{
        await new Promise(resolve=>setTimeout(resolve,15));
        return new Response(JSON.stringify(rawMatch(id)),{
          status:200,
          headers:{"Content-Type":"application/json"},
        });
      }finally{
        active--;
      }
    }) as typeof fetch;
    const ids=Array.from({length:16},(_,i)=>"BR1_"+String(i+1000000000));
    const result=await getOrFetchMatches(ids,"https://americas.api.riotgames.com",{},"americas");
    assert(maxActive<=4,"Riot detail concurrency exceeded four: "+maxActive);
    assert(maxActive>=2,"Unexpected serial-only execution");
    assert(calls===16,"Some valid Riot match details were skipped");
    assert(result.matches.length===16,"Not all matches were returned");
    assert(result.matches.map((match:{id:string})=>match.id).join(",")===ids.join(","),"Match order changed");
    assert(result.failed===0,"Successful responses must not be marked missing");
    assert(result.rateLimited===false,"No rate limit occurred");
  }finally{
    globalThis.fetch=original;
  }
});

Deno.test("upstream Riot 429 stops launching new match requests",async()=>{
  const original=globalThis.fetch;
  let calls=0;
  try{
    globalThis.fetch=(async()=>{
      calls++;
      return new Response(JSON.stringify({error:"rate_limited"}),{status:429});
    }) as typeof fetch;
    const ids=Array.from({length:20},(_,i)=>"BR1_"+String(i+2000000000));
    const result=await getOrFetchMatches(ids,"https://americas.api.riotgames.com",{},"americas");
    assert(result.rateLimited===true,"The Riot rate-limit signal must propagate");
    assert(calls<=4,"Continued launching new calls after a Riot 429: "+calls);
    assert(result.failed===20,"Failed match details were not tracked");
    assert(result.matches.length===0,"Unexpected records on a full Riot rate limit");
  }finally{
    globalThis.fetch=original;
  }
});
