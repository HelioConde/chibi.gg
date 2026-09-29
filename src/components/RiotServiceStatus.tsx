import { useEffect, useState } from "react";
import { fetchTftStatus, TftServiceStatus } from "../api/tft";

type Props={
  platform:string;
};

export default function RiotServiceStatus({platform}:Props){
  const [status,setStatus]=useState<TftServiceStatus|null>(null);
  const [failed,setFailed]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    setFailed(false);

    fetchTftStatus(platform)
      .then(data=>{
        if(!cancelled)setStatus(data);
      })
      .catch(()=>{
        if(!cancelled){
          setStatus(null);
          setFailed(true);
        }
      });

    return ()=>{cancelled=true;};
  },[platform]);

  if(failed){
    return <div className="riot-service-status unknown">
      <span></span>
      <b>Riot TFT</b>
      <small>status indisponível</small>
    </div>;
  }

  if(!status){
    return <div className="riot-service-status loading">
      <span></span>
      <b>Riot TFT</b>
      <small>verificando serviço...</small>
    </div>;
  }

  const issueCount=status.incidents.length+status.maintenances.length;

  return <div
    className={"riot-service-status "+(status.operational?"ok":"warning")}
    title={status.operational
      ?"Nenhum incidente ou manutenção retornado pelo tft-status-v1."
      :issueCount+" aviso(s) ativo(s) retornados pelo tft-status-v1."}
  >
    <span></span>
    <b>Riot TFT · {status.platform}</b>
    <small>{status.operational?"operacional":issueCount+" aviso(s) ativo(s)"}</small>
  </div>;
}
