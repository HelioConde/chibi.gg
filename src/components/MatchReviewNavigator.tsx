type Props={
  placement:number;
};

const stages=[
  {id:"match-review-read",index:"01",label:"Leitura",desc:"o que revisar"},
  {id:"match-review-why",index:"02",label:"Por quê",desc:"maior gap"},
  {id:"match-review-board",index:"03",label:"Board",desc:"unidades finais"},
  {id:"match-review-more",index:"04",label:"Detalhes",desc:"comparar e registrar"},
] as const;

export default function MatchReviewNavigator({placement}:Props){
  function go(id:string){
    document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"});
  }

  return <nav className="match-review-navigator" aria-label="Etapas da revisão">
    <div className="match-review-navigator-result">
      <small>RESULTADO</small>
      <strong>{placement}º</strong>
    </div>
    <div className="match-review-navigator-stages">
      {stages.map(stage=>(
        <button type="button" onClick={()=>go(stage.id)} key={stage.id}>
          <span>{stage.index}</span>
          <b>{stage.label}</b>
          <small>{stage.desc}</small>
        </button>
      ))}
    </div>
  </nav>;
}
