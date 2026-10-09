import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

// These are intentionally invalid inputs. No request reaches the Riot API,
// so the smoke test can run safely against production without quota consumption.
const source=readFileSync(fileURLToPath(new URL("../src/api/tft.ts",import.meta.url)),"utf8");
const publishable=source.match(/const PUBLIC_API_KEY="([^"]+)"/)?.[1];
assert(publishable?.startsWith("sb_publishable_"),"Public project key not found");
const base=process.env.CHIBI_EDGE_BASE||"https://bieihhaobdztjyoweewa.supabase.co/functions/v1";
const origin="https://helioconde.github.io";
const checks=[
  {endpoint:"public-tft-profile",payload:{gameName:"A".repeat(65),tagLine:"BR1",platform:"br1"},http:400,code:"invalid_riot_id"},
  {endpoint:"public-tft-history",payload:{gameName:"A".repeat(65),tagLine:"BR1",platform:"br1"},http:400,code:"invalid_riot_id"},
  {endpoint:"public-tft-match",payload:{matchId:"invalid/region/test"},http:400,code:"invalid_match_id"},
  {endpoint:"public-tft-profile",payload:{gameName:"",tagLine:"",platform:"br1"},http:400,code:"riot_id_required"},
  {endpoint:"public-tft-history",payload:{gameName:"",tagLine:"",platform:"br1"},http:400,code:"riot_id_required"},
];
let passed=0;
for(const endpoint of [...new Set(checks.map(x=>x.endpoint))]){
  const response=await fetch(base+"/"+endpoint,{
    method:"OPTIONS",
    headers:{origin,"Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"apikey, authorization, content-type"},
    signal:AbortSignal.timeout(12000),
  });
  assert.equal(response.status,200,endpoint+" OPTIONS status");
  assert.equal(response.headers.get("access-control-allow-origin"),"*",endpoint+" CORS");
  console.log("PASS",endpoint,"OPTIONS CORS");
  passed++;
}
for(const check of checks){
  const response=await fetch(base+"/"+check.endpoint,{
    method:"POST",
    headers:{
      Origin:origin,"Content-Type":"application/json",
      apikey:publishable,
      Authorization:"Bearer "+publishable,
    },
    body:JSON.stringify(check.payload),
    signal:AbortSignal.timeout(15000),
  });
  const data=await response.json().catch(()=>null);
  assert.equal(response.status,check.http,check.endpoint+" HTTP "+JSON.stringify(data));
  assert.equal(data?.error,check.code,check.endpoint+" structured failure");
  assert.equal(response.headers.get("access-control-allow-origin"),"*",check.endpoint+" CORS on error");
  console.log("PASS",check.endpoint,check.code,response.status);
  passed++;
}
for(const endpoint of [...new Set(checks.map(x=>x.endpoint))]){
  const response=await fetch(base+"/"+endpoint,{
    method:"POST",
    headers:{
      Origin:origin,"Content-Type":"application/json",
      apikey:publishable,
      Authorization:"Bearer "+publishable,
    },
    body:"{",
    signal:AbortSignal.timeout(15000),
  });
  const data=await response.json().catch(()=>null);
  assert.equal(response.status,400,endpoint+" malformed JSON HTTP status");
  assert.equal(data?.error,"invalid_json",endpoint+" malformed JSON response");
  console.log("PASS",endpoint,"invalid_json",response.status);
  passed++;
}
console.log("CHIBI_EDGE_SMOKE",passed,"production checks passed");
