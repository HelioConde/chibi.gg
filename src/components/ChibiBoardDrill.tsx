import { useMemo, useState } from "react";
import { TftMatch, TftUnit } from "../api/tft";
import { staticEntry, tftAssetUrl, TftStaticData } from "../tftStatic";

type Props={
  matches:TftMatch[];
  staticData:TftStaticData|null;
  onEvidence:(ids:string[],label:string)=>void;
};

type Drill={
  id:string;
  a:TftMatch;
  b:TftMatch;
  similarity:number;
};

function clean(value:string){
  return String(value||"")
    .replace(/^TFT\d+_/i,"")
    .replace(/^Set\d+_/i,"")
    .replace(/_/g," ")
    .replace(/([a-z])([A-Z])/g,"$1 $2")
    .replace(/\bUnique Trait\b/gi,"")
    .replace(/\bTrait\b$/i,"")
    .replace(/\s{2,}/g," ")
    .trim();
}

function activeTraits(match:TftMatch){
  return match.traits
    .filter(trait=>trait.numUnits>0&&(trait.style>0||trait.numUnits>=2))
    .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)
    .slice(0,4)
    .map(trait=>trait.name);
}

function jaccard(left:string[],right:string[]){
  const a=new Set(left);
  const b=new Set(right);
  if(!a.size&&!b.size)return 1;
  const shared=[...a].filter(value=>b.has(value)).length;
  const union=new Set([...a,...b]).size;
  return union?shared/union:0;
}

function similarity(a:TftMatch,b:TftMatch){
  const unit=jaccard(
    a.units.map(unit=>unit.characterId),
    b.units.map(unit=>unit.characterId),
  );
  const trait=jaccard(activeTraits(a),activeTraits(b));
  return unit*.65+trait*.35;
}

function copies(tier:number){
  return tier>=3?9:tier===2?3:1;
}

function boardValue(match:TftMatch){
  return match.units.reduce((sum,unit)=>{
    const cost=Math.max(1,Math.min(5,(Number(unit.rarity)||0)+1));
    return sum+cost*copies(Math.max(1,Number(unit.tier)||1));
  },0);
}

function itemCount(match:TftMatch){
  return match.units.reduce((sum,unit)=>sum+(unit.itemNames?.length||0),0);
}

function threeStars(match:TftMatch){
  return match.units.filter(unit=>unit.tier>=3).length;
}

function buildDrills(matches:TftMatch[]):Drill[]{
  const candidates=matches
    .filter(match=>match.units.length>=5&&match.placement>=1&&match.placement<=8)
    .slice(0,24);

  const pairs:Drill[]=[];
  for(let left=0;left<candidates.length;left++){
    for(let right=left+1;right<candidates.length;right++){
      const a=candidates[left];
      const b=candidates[right];
      if(a.placement===b.placement)continue;
      const score=similarity(a,b);
      if(score<.18)continue;
      pairs.push({
        id:a.id+"::"+b.id,
        a,
        b,
        similarity:Math.round(score*100),
      });
    }
  }

  return pairs
    .sort((x,y)=>y.similarity-x.similarity||Math.abs(y.a.placement-y.b.placement)-Math.abs(x.a.placement-x.b.placement))
    .filter((pair,index,all)=>{
      const usedBefore=all.slice(0,index).some(previous=>
        previous.a.id===pair.a.id||previous.a.id===pair.b.id||
        previous.b.id===pair.a.id||previous.b.id===pair.b.id
      );
      return !usedBefore;
    })
    .slice(0,5);
}

function championName(unit:TftUnit,staticData:TftStaticData|null){
  return staticEntry(staticData?.champions,unit.characterId)?.name||clean(unit.characterId);
}

function DrillUnit({unit,staticData}:{unit:TftUnit;staticData:TftStaticData|null}){
  const entry=staticEntry(staticData?.champions,unit.characterId);
  const image=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
  const name=championName(unit,staticData);

  return <span className="drill-unit" title={name}>
    <span>{name.slice(0,2)}</span>
    {image&&<img src={image} alt={name} onError={event=>{event.currentTarget.style.display="none";}}/>}
    <b>{"★".repeat(Math.max(1,Math.min(3,unit.tier||1)))}</b>
  </span>;
}

function Board({
  match,
  staticData,
  label,
  chosen,
  onChoose,
}:{
  match:TftMatch;
  staticData:TftStaticData|null;
  label:"A"|"B";
  chosen:boolean;
  onChoose:()=>void;
}){
  return <button className={"drill-board "+(chosen?"chosen":"")} onClick={onChoose}>
    <div className="drill-board-head">
      <span>BOARD {label}</span>
      <strong>Nv. {match.level}</strong>
    </div>
    <div className="drill-units">
      {match.units.slice(0,8).map((unit,index)=><DrillUnit unit={unit} staticData={staticData} key={unit.characterId+index}/>)}
    </div>
    <div className="drill-board-meta">
      <span>{itemCount(match)} itens</span>
      <span>{threeStars(match)} unidade(s) 3★</span>
      <span>{match.goldLeft}g final</span>
    </div>
  </button>;
}

export default function ChibiBoardDrill({matches,staticData,onEvidence}:Props){
  const drills=useMemo(()=>buildDrills(matches),[matches]);
  const [index,setIndex]=useState(0);
  const [choice,setChoice]=useState<"A"|"B"|null>(null);
  const [revealed,setRevealed]=useState(false);
  const [score,setScore]=useState(0);
  const drill=drills[index]||null;

  function choose(value:"A"|"B"){
    if(revealed||!drill)return;
    setChoice(value);
  }

  function reveal(){
    if(!drill||!choice||revealed)return;
    const correct=drill.a.placement<drill.b.placement?"A":"B";
    if(choice===correct)setScore(value=>value+1);
    setRevealed(true);
  }

  function next(){
    if(!drills.length)return;
    setIndex(value=>(value+1)%drills.length);
    setChoice(null);
    setRevealed(false);
  }

  if(!drill)return <section className="board-drill-empty">
    <span>BOARD READING DRILL</span>
    <strong>Precisamos de mais boards comparáveis</strong>
    <p>Carregue mais partidas para o Chibi criar exercícios usando seu próprio histórico.</p>
  </section>;

  const correct=drill.a.placement<drill.b.placement?"A":"B";
  const better=correct==="A"?drill.a:drill.b;
  const worse=correct==="A"?drill.b:drill.a;
  const valueDelta=boardValue(better)-boardValue(worse);
  const itemDelta=itemCount(better)-itemCount(worse);
  const starDelta=threeStars(better)-threeStars(worse);
  const levelDelta=better.level-worse.level;

  const differences=[
    valueDelta!==0?"board "+(valueDelta>0?"+":"")+valueDelta+"g":"",
    itemDelta!==0?"itens "+(itemDelta>0?"+":"")+itemDelta:"",
    levelDelta!==0?"nível "+(levelDelta>0?"+":"")+levelDelta:"",
    starDelta!==0?"3★ "+(starDelta>0?"+":"")+starDelta:"",
  ].filter(Boolean);

  return <section className="chibi-board-drill">
    <div className="drill-head">
      <div>
        <span>BOARD READING DRILL</span>
        <h3>Qual destes boards terminou melhor?</h3>
        <p>Dois boards do seu histórico com {drill.similarity}% de semelhança. A colocação fica escondida até você responder.</p>
      </div>
      <div className="drill-score">
        <small>ACERTOS</small>
        <strong>{score}</strong>
        <span>{index+1}/{drills.length}</span>
      </div>
    </div>

    <div className="drill-versus">
      <Board match={drill.a} staticData={staticData} label="A" chosen={choice==="A"} onChoose={()=>choose("A")}/>
      <b>VS</b>
      <Board match={drill.b} staticData={staticData} label="B" chosen={choice==="B"} onChoose={()=>choose("B")}/>
    </div>

    {!revealed?(
      <div className="drill-actions">
        <span>{choice?"Board "+choice+" selecionado":"Escolha A ou B antes de revelar."}</span>
        <button disabled={!choice} onClick={reveal}>Revelar resultado</button>
      </div>
    ):(
      <div className={"drill-result "+(choice===correct?"correct":"wrong")}>
        <div>
          <span>{choice===correct?"ACERTOU":"REVISE A DIFERENÇA"}</span>
          <h4>Board {correct} terminou melhor: {better.placement}º vs {worse.placement}º</h4>
          <p>{differences.length
            ? "Diferenças finais observáveis: "+differences.join(" · ")+"."
            : "Os números finais ficaram muito próximos; traits, itens específicos e decisões anteriores podem ter pesado mais."}</p>
          <small>Isso não prova que essas diferenças causaram o resultado; o exercício treina leitura de snapshots semelhantes.</small>
        </div>
        <div>
          <button onClick={()=>onEvidence([drill.a.id,drill.b.id],"Board Reading Drill · comparação")}>Abrir as 2 partidas</button>
          <button className="primary" onClick={next}>Próximo drill</button>
        </div>
      </div>
    )}
  </section>;
}
