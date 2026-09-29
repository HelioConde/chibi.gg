import { useEffect, useState } from "react";
import { fetchTftStatus, TftServiceStatus } from "../api/tft";
import { useI18n } from "../i18n";

type Props={
  platform:string;
};

export default function RiotServiceStatus({platform}:Props){
  const { t } = useI18n();
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
      <small>{t("status.unavailable")}</small>
    </div>;
  }

  if(!status){
    return <div className="riot-service-status loading">
      <span></span>
      <b>Riot TFT</b>
      <small>{t("status.checking")}</small>
    </div>;
  }

  const issueCount=status.incidents.length+status.maintenances.length;

  return <div
    className={"riot-service-status "+(status.operational?"ok":"warning")}
    title={status.operational
      ?t("status.operationalTitle")
      :t("status.warningTitle",{count:issueCount})}
  >
    <span></span>
    <b>Riot TFT · {status.platform}</b>
    <small>{status.operational?t("status.operational"):t("status.activeWarnings",{count:issueCount})}</small>
  </div>;
}
