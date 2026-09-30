export default function ChibiRecordedBadge({status}:{status?:"waiting_riot_match"|"reconciled"}){
  const ready=status==="reconciled";
  return <span className={"match-review-label "+(ready?"good":"neutral")} title={ready?"Análise avançada disponível":"Processando análise avançada"}>◈ Chibi Recorded</span>;
}
