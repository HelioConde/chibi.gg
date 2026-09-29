import { TftProfile } from "../api/tft";
import RiotServiceStatus from "./RiotServiceStatus";

type Props={
  profile:TftProfile;
  matchCount:number;
  refreshing:boolean;
  onRefresh:()=>void;
  compact?:boolean;
  contextCount?:number;
};

function relativeTime(timestamp?:number){
  if(!timestamp)return "agora";
  const diff=Math.max(0,Date.now()-timestamp);
  const minutes=Math.floor(diff/60000);
  if(minutes<1)return "agora";
  if(minutes<60)return minutes+" min";
  const hours=Math.floor(minutes/60);
  if(hours<24)return hours+" h";
  return Math.floor(hours/24)+" d";
}

export default function RiotDataBar({
  profile,
  matchCount,
  refreshing,
  onRefresh,
  compact=false,
  contextCount,
}:Props){
  const partial=profile.partial;
  const partialLabels=[
    partial?.summoner?"perfil":null,
    partial?.ranked?"rank":null,
    partial?.history?"histórico":null,
  ].filter(Boolean) as string[];
  const source=profile.source;

  if(compact){
    return <section className={"riot-data-bar compact "+(partialLabels.length?"partial":"complete")}>
      <div className="riot-data-primary">
        <div className="riot-data-title">
          <span className="riot-data-dot"></span>
          <div>
            <strong>Dados Riot</strong>
            <small>
              {matchCount} carregadas
              {typeof contextCount==="number"?" · "+contextCount+" neste filtro":""}
              {" · atualizado "+relativeTime(source?.retrievedAt)}
            </small>
          </div>
        </div>
      </div>

      <div className="riot-data-side">
        <RiotServiceStatus platform={profile.player.platform}/>
        {partialLabels.length>0&&<span className="riot-partial-warning">
          parcial · {partialLabels.join(" + ")}
        </span>}
      </div>
    </section>;
  }

  return <section className={"riot-data-bar "+(partialLabels.length?"partial":"complete")}>
    <div className="riot-data-primary">
      <div className="riot-data-title">
        <span className="riot-data-dot"></span>
        <div>
          <strong>Dados oficiais Riot</strong>
          <small>{matchCount} partidas carregadas · sincronizado {relativeTime(source?.retrievedAt)}</small>
        </div>
      </div>

      <div className="riot-api-chips" aria-label="Fontes oficiais Riot usadas neste perfil">
        <span title={source?.account||"account-v1"}>Riot ID</span>
        <span title={source?.summoner||"tft-summoner-v1"}>Perfil TFT</span>
        <span title={source?.ranked||"tft-league-v1"}>Rank</span>
        <span title={source?.matches||"tft-match-v1"}>Histórico</span>
      </div>
    </div>

    <div className="riot-data-side">
      <RiotServiceStatus platform={profile.player.platform}/>
      {partialLabels.length>0&&<span className="riot-partial-warning" title={"Dados parciais: "+partialLabels.join(", ")}>
        parcial · {partialLabels.join(" + ")}
      </span>}
      <button onClick={onRefresh} disabled={refreshing}>
        {refreshing?"Sincronizando...":"Sincronizar"}
      </button>
    </div>
  </section>;
}
