import { SITE_IMAGES } from "../siteAssets";
import AdaptiveArtwork from "./AdaptiveArtwork";

type Props={
  onOpenProfile:()=>void;
  onOpenComps:()=>void;
  onOpenStats:()=>void;
  onOpenCoach:()=>void;
};

const cards=[
  {key:"history",label:"Match History",title:"Leia a partida sem caçar informação",image:SITE_IMAGES.v2.showcase.history,action:"profile"},
  {key:"comps",label:"Comps",title:"Composição, itens e plano no mesmo contexto",image:SITE_IMAGES.v2.showcase.comps,action:"comps"},
  {key:"augments",label:"Augments & Items",title:"Escolhas com contexto, taxa e sinergia",image:SITE_IMAGES.v2.showcase.augments,action:"stats"},
  {key:"positioning",label:"Board Review",title:"Posicionamento visual para entender a luta",image:SITE_IMAGES.v2.showcase.positioning,action:"profile"},
  {key:"coach",label:"Chibi Coach",title:"Insights transformados em próxima ação",image:SITE_IMAGES.v2.showcase.coach,action:"coach"},
] as const;

export default function HomeVisualShowcase({onOpenProfile,onOpenComps,onOpenStats,onOpenCoach}:Props){
  const actions={
    profile:onOpenProfile,
    comps:onOpenComps,
    stats:onOpenStats,
    coach:onOpenCoach,
  };

  return <section className="home-visual-showcase home-visual-showcase-v2" aria-label="Chibi.gg product preview">
    <header className="home-visual-showcase-head">
      <div>
        <span>CHIBI EM AÇÃO</span>
        <h2>Entenda a partida sem abrir cinco telas.</h2>
        <p>Histórico, composição, augments, posicionamento e revisão conectados para você entender o que aconteceu e decidir o próximo passo.</p>
      </div>
    </header>

    <div className="home-visual-showcase-grid">
      {cards.map((card)=>(
        <button className={"home-visual-card home-visual-card-v2 home-visual-"+card.key} type="button" onClick={actions[card.action]} key={card.key}>
          <AdaptiveArtwork src={card.image} alt="" loading="lazy" decoding="async"/>
          <span className="home-visual-card-shade"></span>
          <span className="home-visual-card-copy">
            <small>{card.label}</small>
            <strong>{card.title}</strong>
            <em>Explorar →</em>
          </span>
        </button>
      ))}
    </div>
  </section>;
}
