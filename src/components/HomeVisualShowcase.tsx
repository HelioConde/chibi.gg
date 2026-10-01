import { SITE_IMAGES } from "../siteAssets";
import AdaptiveArtwork from "./AdaptiveArtwork";

type Props={
  onOpenProfile:()=>void;
  onOpenComps:()=>void;
  onOpenStats:()=>void;
  onOpenCoach:()=>void;
};

const cards=[
  {key:"history",label:"Match History",title:"Leia a partida sem caçar informação",image:SITE_IMAGES.ui.history,action:"profile"},
  {key:"comps",label:"Comps",title:"Composição, itens e plano no mesmo contexto",image:SITE_IMAGES.ui.comps,action:"comps"},
  {key:"augments",label:"Augments & Items",title:"Escolhas com contexto, taxa e sinergia",image:SITE_IMAGES.ui.augments,action:"stats"},
  {key:"positioning",label:"Board Review",title:"Posicionamento visual para entender a luta",image:SITE_IMAGES.ui.positioning,action:"profile"},
  {key:"coach",label:"Chibi Coach",title:"Insights transformados em próxima ação",image:SITE_IMAGES.ui.coach,action:"coach"},
] as const;

export default function HomeVisualShowcase({onOpenProfile,onOpenComps,onOpenStats,onOpenCoach}:Props){
  const actions={
    profile:onOpenProfile,
    comps:onOpenComps,
    stats:onOpenStats,
    coach:onOpenCoach,
  };

  return <section className="home-visual-showcase" aria-label="Chibi.gg product preview">
    <header className="home-visual-showcase-head">
      <div>
        <span>CHIBI UI</span>
        <h2>Informação de TFT com leitura mais rápida</h2>
        <p>As novas artes viraram direção visual do produto: menos ruído, contexto mais claro e cada tela com um objetivo principal.</p>
      </div>
      <div className="home-visual-showcase-mobile">
        <AdaptiveArtwork src={SITE_IMAGES.ui.mobile} alt="" loading="lazy" decoding="async"/>
        <span>Mobile first</span>
      </div>
    </header>

    <div className="home-visual-showcase-grid">
      {cards.map((card)=>(
        <button className={"home-visual-card home-visual-"+card.key} type="button" onClick={actions[card.action]} key={card.key}>
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
