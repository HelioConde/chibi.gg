import { useMemo } from "react";
import {
  latestTftSetNumber,
  staticEntry,
  tftAssetUrl,
  TftStaticData,
} from "../tftStatic";

type Props={
  staticData:TftStaticData|null;
  setNumber?:number|null;
  championIds?:string[];
  variant?:"hero"|"ribbon"|"compact";
  label?:string;
};

function dedupe<T>(list:T[]){
  return [...new Set(list)];
}

export default function DDragonArt({
  staticData,
  setNumber,
  championIds=[],
  variant="ribbon",
  label="Data Dragon",
}:Props){
  const rows=useMemo(()=>{
    if(!staticData)return [];

    const explicit=dedupe(championIds)
      .map(id=>({id,entry:staticEntry(staticData.champions,id)}))
      .filter(row=>row.entry?.image?.full);

    if(explicit.length>=4)return explicit.slice(0,7);

    const targetSet=setNumber||latestTftSetNumber(staticData);
    const source=Object.entries(staticData.champions)
      .filter(([id,entry])=>{
        if(!entry?.image?.full)return false;
        if(!targetSet)return true;
        const haystack=(id+" "+String(entry.id||"")+" "+String(entry.image?.full||"")).toUpperCase();
        return haystack.includes("TFT"+targetSet+"_")
          || haystack.includes("TFT_SET"+targetSet)
          || haystack.includes("SET"+targetSet+".");
      })
      .map(([id,entry])=>({id,entry}));

    const fallback=source.length>=5
      ?source
      :Object.entries(staticData.champions)
        .filter(([,entry])=>entry?.image?.full)
        .map(([id,entry])=>({id,entry}));

    const picked=[];
    const desired=Math.min(7,fallback.length);
    for(let i=0;i<desired;i++){
      const index=Math.floor(i*Math.max(1,fallback.length-1)/Math.max(1,desired-1));
      picked.push(fallback[index]);
    }

    const merged=[...explicit,...picked]
      .filter((row,index,array)=>array.findIndex(other=>other.id===row.id)===index);

    return merged.slice(0,7);
  },[staticData,setNumber,championIds]);

  if(!staticData||!rows.length)return null;

  return <div className={"ddragon-art "+variant} aria-hidden="true">
    <div className="ddragon-art-images">
      {rows.map(({id,entry},index)=>{
        const src=tftAssetUrl(staticData.version,"champion",entry);
        return <span className={"ddragon-art-card art-"+index} key={id}>
          <img src={src} alt="" loading="lazy"/>
        </span>;
      })}
    </div>
    <small>{label} · {staticData.version}</small>
  </div>;
}
