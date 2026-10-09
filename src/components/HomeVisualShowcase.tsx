import { SITE_IMAGES } from "../siteAssets";
import { useI18n } from "../i18n";
import AdaptiveArtwork from "./AdaptiveArtwork";

type Props={
  onOpenProfile:()=>void;
  onOpenComps:()=>void;
  onOpenStats:()=>void;
  onOpenCoach:()=>void;
};

export default function HomeVisualShowcase({onOpenProfile,onOpenComps,onOpenStats,onOpenCoach}:Props){
  const { language } = useI18n();
  const en = language==="en";
  const cards=[
    {key:"history",label:en?"Match History":"Histórico de partidas",title:en?"Understand a match without hunting for clues":"Entenda a partida sem procurar informações",image:SITE_IMAGES.v2.showcase.history,action:onOpenProfile},
    {key:"comps",label:"Comps",title:en?"Compositions, items and a plan together":"Composições, itens e um plano no mesmo lugar",image:SITE_IMAGES.v2.showcase.comps,action:onOpenComps},
    {key:"items",label:en?"Items & Traits":"Itens e sinergias",title:en?"Explore observed item and trait statistics":"Explore estatísticas observadas de itens e sinergias",image:SITE_IMAGES.v2.showcase.augments,action:onOpenStats},
    {key:"positioning",label:en?"Board Review":"Revisão do tabuleiro",title:en?"Review the final board after each game":"Revise o tabuleiro final depois de cada partida",image:SITE_IMAGES.v2.showcase.positioning,action:onOpenProfile},
    {key:"coach",label:"Chibi Coach",title:en?"Turn evidence into the next thing to practice":"Transforme evidências no próximo ponto a treinar",image:SITE_IMAGES.v2.showcase.coach,action:onOpenCoach},
  ];

  return <section className="home-visual-showcase home-visual-showcase-v2" aria-label={en?"Explore Chibi features":"Conheça os recursos do Chibi"}>
    <header className="home-visual-showcase-head">
      <div>
        <span>{en?"CHIBI IN ACTION":"CHIBI EM AÇÃO"}</span>
        <h2>{en?"Understand your game without five different tabs.":"Entenda suas partidas sem abrir cinco telas."}</h2>
        <p>{en
          ?"Match history, comps, observed item stats, final boards and reviews connected in one post-match experience."
          :"Histórico, composições, estatísticas de itens, tabuleiro final e revisão conectados em uma experiência pós-partida."}</p>
      </div>
    </header>

    <div className="home-visual-showcase-grid">
      {cards.map(card=>(
        <button className={"home-visual-card home-visual-card-v2 home-visual-"+card.key} type="button" onClick={card.action} key={card.key}>
          <AdaptiveArtwork src={card.image} alt="" loading="lazy" decoding="async"/>
          <span className="home-visual-card-shade"></span>
          <span className="home-visual-card-copy">
            <small>{card.label}</small>
            <strong>{card.title}</strong>
            <em>{en?"Explore →":"Explorar →"}</em>
          </span>
        </button>
      ))}
    </div>
  </section>;
}
