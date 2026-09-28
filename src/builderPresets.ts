import { HexBoardUnit } from "./components/HexBoard";

export type BuilderPreset={
  id:string;
  name:string;
  targetLevel:number;
  units:HexBoardUnit[];
  augments?:string[];
  createdAt:number;
};

const KEY="chibi.builder.presets.v1";
const MAX=8;

export function getBuilderPresets():BuilderPreset[]{
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw)return [];
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed))return [];
    return parsed
      .filter(row=>row&&typeof row.id==="string"&&Array.isArray(row.units))
      .map(row=>({
        ...row,
        augments:Array.isArray(row.augments)?row.augments.slice(0,3).map(String):[],
        units:row.units.map((unit:HexBoardUnit)=>({
          ...unit,
          items:Array.isArray(unit.items)?unit.items.slice(0,3).map(String):[],
        })),
      }))
      .slice(0,MAX);
  }catch{
    return [];
  }
}

export function saveBuilderPreset(input:Omit<BuilderPreset,"id"|"createdAt">){
  const preset:BuilderPreset={
    ...input,
    id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),
    createdAt:Date.now(),
    augments:[...(input.augments||[])].slice(0,3),
    units:input.units.map(unit=>({...unit,items:[...(unit.items||[])].slice(0,3)})),
  };

  const next=[preset,...getBuilderPresets()].slice(0,MAX);
  try{localStorage.setItem(KEY,JSON.stringify(next));}catch{}
  return next;
}

export function deleteBuilderPreset(id:string){
  const next=getBuilderPresets().filter(row=>row.id!==id);
  try{localStorage.setItem(KEY,JSON.stringify(next));}catch{}
  return next;
}
