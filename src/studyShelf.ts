export type StudyShelfItem=
  | {
      id:string;
      type:"comp";
      label:string;
      subtitle:string;
      unitIds:string[];
      createdAt:number;
    }
  | {
      id:string;
      type:"stat";
      label:string;
      subtitle:string;
      category:"champions"|"traits"|"items"|"augments";
      entityId:string;
      createdAt:number;
    };

const KEY="chibi.gg:study-shelf:v1";

function readAll():StudyShelfItem[]{
  try{
    const raw=localStorage.getItem(KEY);
    const parsed=raw?JSON.parse(raw):[];
    return Array.isArray(parsed)?parsed:[];
  }catch{
    return [];
  }
}

function writeAll(items:StudyShelfItem[]){
  localStorage.setItem(KEY,JSON.stringify(items.slice(-30)));
  window.dispatchEvent(new CustomEvent("chibi:study-shelf-change"));
}

export function getStudyShelf(){
  return readAll().slice().reverse();
}

export function saveStudyShelfItem(item:Omit<StudyShelfItem,"id"|"createdAt">){
  const rows=readAll();
  const duplicate=rows.find(row=>{
    if(row.type!==item.type)return false;
    if(row.type==="comp"&&item.type==="comp"){
      return row.label===item.label&&row.unitIds.join("|")===item.unitIds.join("|");
    }
    if(row.type==="stat"&&item.type==="stat"){
      return row.category===item.category&&row.entityId===item.entityId;
    }
    return false;
  });
  if(duplicate)return duplicate;

  const next:StudyShelfItem={
    ...item,
    id:item.type+":"+Date.now()+":"+Math.random().toString(36).slice(2,7),
    createdAt:Date.now(),
  } as StudyShelfItem;

  writeAll([...rows,next]);
  return next;
}

export function removeStudyShelfItem(id:string){
  writeAll(readAll().filter(item=>item.id!==id));
}
