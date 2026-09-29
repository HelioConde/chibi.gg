import { TftMatch, TftMatchDetail, TftProfile, TftTrait, TftUnit } from "./api/tft";

type DemoLine="spellweaver"|"inferno"|"blossom";

const DAY=24*60*60*1000;
const NOW=Date.now();

function trait(name:string,numUnits:number,style:number):TftTrait{
  return {name,numUnits,style,tierCurrent:style>0?Math.max(1,Math.min(4,style)):0,tierTotal:4};
}

const SPELL_TRAITS:TftTrait[]=[
  trait("DA_18_Spellweaver",4,2),
  trait("DA_18_Elderwood",3,1),
  trait("DA_18_Defender",2,1),
  trait("DA_18_Brawler",2,1),
];

const INFERNO_TRAITS:TftTrait[]=[
  trait("DA_18_Inferno",4,2),
  trait("DA_18_Solar",3,4),
  trait("DA_18_Rapidfire",2,1),
  trait("DA_18_Defender",2,1),
];

const BLOSSOM_TRAITS:TftTrait[]=[
  trait("DA_18_Blossom",5,2),
  trait("DA_18_Adaptor",2,1),
  trait("DA_18_Defender",2,1),
  trait("DA_18_Spellweaver",2,1),
];

function unit(characterId:string,tier:number,rarity:number,itemNames:string[]=[]):TftUnit{
  return {characterId,tier,rarity,itemNames};
}

const SPELL_UNITS:TftUnit[]=[
  unit("DA_18_Veigar",3,0,["DA_BlueBuff","DA_JeweledGauntlet","DA_HextechGunblade"]),
  unit("DA_18_LeBlanc",2,1,["DA_SpearOfShojin","DA_Morellonomicon"]),
  unit("DA_18_Ornn",2,0,["DA_GargoyleStoneplate","DA_WarmogsArmor"]),
  unit("DA_18_Alistar",2,1,["DA_Crownguard"]),
  unit("DA_18_RekSai",2,0),
  unit("DA_Fiddlesticks18",2,2),
  unit("DA_18_Cassiopeia",2,2,["DA_LastWhisper"]),
  unit("DA_18_Soraka",1,3),
];

const INFERNO_UNITS:TftUnit[]=[
  unit("DA_18_Kayle",2,1,["DA_GuinsoosRageblade","DA_HextechGunblade","DA_InfinityEdge"]),
  unit("DA_18_Leona",2,0,["DA_SteadfastHeart"]),
  unit("DA_18_Sejuani",2,1,["DA_GargoyleStoneplate","DA_WarmogsArmor"]),
  unit("DA_18_Varus",2,0,["DA_BlueBuff"]),
  unit("DA_18_Shen",2,1),
  unit("DA_18_Akali_AD",2,0,["DA_HandOfJustice"]),
  unit("DA_18_Kennen",1,4,["DA_TitansResolve"]),
  unit("DA_18_Ornn",2,0),
];

const BLOSSOM_UNITS:TftUnit[]=[
  unit("DA_18_Yorick",2,0,["DA_WarmogsArmor","DA_BrambleVest"]),
  unit("DA_Karma18",2,0,["DA_JeweledGauntlet","DA_HextechGunblade"]),
  unit("DA_18_Ahri",2,3,["DA_BlueBuff","DA_JeweledGauntlet"]),
  unit("DA_18_Yunara",2,1,["DA_GiantSlayer"]),
  unit("DA_Amumu18",2,3,["DA_BrambleVest"]),
  unit("DA_18_MasterYi_AD",2,2),
  unit("DA_18_Sett",1,3),
  unit("DA_18_Ashe",1,4,["DA_GiantSlayer"]),
];

function copyTraits(source:TftTrait[]){
  return source.map(row=>({...row}));
}

function copyUnits(source:TftUnit[]){
  return source.map(row=>({...row,itemNames:[...row.itemNames]}));
}

function lineData(line:DemoLine){
  if(line==="inferno")return {traits:copyTraits(INFERNO_TRAITS),units:copyUnits(INFERNO_UNITS)};
  if(line==="blossom")return {traits:copyTraits(BLOSSOM_TRAITS),units:copyUnits(BLOSSOM_UNITS)};
  return {traits:copyTraits(SPELL_TRAITS),units:copyUnits(SPELL_UNITS)};
}

const DEMO_ROWS:Array<{
  placement:number;
  line:DemoLine;
  level:number;
  gold:number;
  damage:number;
  eliminated:number;
  lastRound:number;
}>=[
  {placement:4,line:"spellweaver",level:8,gold:6,damage:66,eliminated:1,lastRound:34},
  {placement:7,line:"spellweaver",level:7,gold:18,damage:31,eliminated:0,lastRound:28},
  {placement:3,line:"inferno",level:8,gold:2,damage:78,eliminated:2,lastRound:35},
  {placement:8,line:"spellweaver",level:7,gold:14,damage:22,eliminated:0,lastRound:26},
  {placement:2,line:"inferno",level:9,gold:1,damage:93,eliminated:3,lastRound:37},
  {placement:5,line:"blossom",level:8,gold:9,damage:51,eliminated:1,lastRound:32},
  {placement:1,line:"inferno",level:9,gold:4,damage:111,eliminated:4,lastRound:39},
  {placement:6,line:"spellweaver",level:7,gold:3,damage:44,eliminated:0,lastRound:30},
  {placement:3,line:"blossom",level:8,gold:5,damage:81,eliminated:2,lastRound:36},
  {placement:4,line:"inferno",level:8,gold:7,damage:69,eliminated:1,lastRound:34},
  {placement:2,line:"spellweaver",level:8,gold:0,damage:96,eliminated:3,lastRound:38},
  {placement:7,line:"blossom",level:7,gold:21,damage:29,eliminated:0,lastRound:29},
];

export const DEMO_MATCHES:TftMatch[]=DEMO_ROWS.map((row,index)=>{
  const line=lineData(row.line);
  return {
    id:"CHIBI_DEMO_"+String(index+1).padStart(2,"0"),
    playedAt:NOW-index*(index<4?2.2*60*60*1000:DAY*.78),
    duration:2100+index*17,
    gameVersion:"16.19.1",
    queueId:1100,
    setNumber:18,
    setName:"TFTSet18",
    placement:row.placement,
    level:row.level,
    goldLeft:row.gold,
    lastRound:row.lastRound,
    damageToPlayers:row.damage,
    playersEliminated:row.eliminated,
    augments:[],
    traits:line.traits,
    units:line.units,
  };
});

const average=DEMO_MATCHES.reduce((sum,row)=>sum+row.placement,0)/DEMO_MATCHES.length;
const top4=DEMO_MATCHES.filter(row=>row.placement<=4).length;
const firsts=DEMO_MATCHES.filter(row=>row.placement===1).length;
const eighths=DEMO_MATCHES.filter(row=>row.placement===8).length;

export const DEMO_PROFILE:TftProfile={
  player:{
    gameName:"Chibi Review Demo",
    tagLine:"DEMO",
    platform:"br1",
    level:188,
    profileIconId:0,
  },
  ranked:[{
    queueType:"RANKED_TFT",
    tier:"PLATINUM",
    rank:"II",
    leaguePoints:72,
    wins:21,
    losses:18,
  }],
  summary:{
    matches:DEMO_MATCHES.length,
    averagePlacement:+average.toFixed(2),
    top4Rate:Math.round(top4/DEMO_MATCHES.length*100),
    winRate:Math.round(firsts/DEMO_MATCHES.length*100),
    firsts,
    eighths,
  },
  matches:DEMO_MATCHES,
};

function asParticipant(match:TftMatch,placement:number):TftMatchDetail["match"]["participants"][number]{
  return {
    placement,
    level:match.level,
    goldLeft:match.goldLeft,
    lastRound:match.lastRound,
    timeEliminated:placement===1?undefined:Math.max(900,1850-placement*65),
    damageToPlayers:match.damageToPlayers,
    playersEliminated:match.playersEliminated||0,
    companion:null,
    augments:[...match.augments],
    traits:copyTraits(match.traits),
    units:copyUnits(match.units),
  };
}

export function isDemoMatchId(matchId:string){
  return matchId.startsWith("CHIBI_DEMO_");
}

export function demoMatchDetail(matchId:string):TftMatchDetail|null{
  const targetIndex=DEMO_MATCHES.findIndex(row=>row.id===matchId);
  if(targetIndex<0)return null;

  const target=DEMO_MATCHES[targetIndex];
  const participants:TftMatchDetail["match"]["participants"]=[];

  for(let placement=1;placement<=8;placement++){
    if(placement===target.placement){
      participants.push(asParticipant(target,placement));
      continue;
    }

    const source=DEMO_MATCHES[(targetIndex+placement+2)%DEMO_MATCHES.length];
    participants.push(asParticipant(source,placement));
  }

  return {
    match:{
      id:target.id,
      playedAt:target.playedAt||NOW,
      duration:target.duration||2100,
      gameVersion:target.gameVersion||"16.19.1",
      queueId:target.queueId||1100,
      setNumber:target.setNumber||18,
      setName:target.setName||"TFTSet18",
      participants,
    },
  };
}
