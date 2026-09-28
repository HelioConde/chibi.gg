import { TftStaticData, staticEntry, tftAssetUrl } from "../tftStatic";

export type HexBoardUnit={
  id:string;
  hex:number;
  tier?:number;
};

type Props={
  units:HexBoardUnit[];
  staticData:TftStaticData|null;
  onHexClick?:(hex:number)=>void;
  onUnitClick?:(unit:HexBoardUnit)=>void;
  compact?:boolean;
  interactive?:boolean;
  emptyLabel?:string;
};

function clean(value:string){
  return String(value||"")
    .replace(/^TFT\d+_/i,"")
    .replace(/^Set\d+_/i,"")
    .replace(/_/g," ")
    .replace(/([a-z])([A-Z])/g,"$1 $2");
}

export default function HexBoard({
  units,
  staticData,
  onHexClick,
  onUnitClick,
  compact=false,
  interactive=false,
  emptyLabel="Clique em um champion e depois em um hex",
}:Props){
  const byHex=new Map(units.map(unit=>[unit.hex,unit]));

  return <div className={"hex-board-shell "+(compact?"compact":"")}>
    <div className="hex-board-grid">
      {Array.from({length:28}).map((_,hex)=>{
        const unit=byHex.get(hex);
        const entry=unit?staticEntry(staticData?.champions,unit.id):undefined;
        const name=unit?(entry?.name||clean(unit.id)):"";
        const image=unit&&staticData?tftAssetUrl(staticData.version,"champion",entry):"";

        return <button
          className={"hex-board-cell "+(unit?"occupied":"")}
          onClick={()=>{
            if(unit&&onUnitClick)onUnitClick(unit);
            else if(onHexClick)onHexClick(hex);
          }}
          disabled={!interactive&&!unit}
          title={unit?name:"Hex "+(hex+1)}
          key={hex}
        >
          {unit&&<span className="hex-board-unit">
            {image&&<img src={image} alt={name}/>}
            {!image&&<b>{name.slice(0,2)}</b>}
            {unit.tier&&<em>{"★".repeat(Math.max(1,Math.min(3,unit.tier)))}</em>}
          </span>}
        </button>;
      })}
    </div>
    {!units.length&&<div className="hex-board-empty">{emptyLabel}</div>}
  </div>;
}
