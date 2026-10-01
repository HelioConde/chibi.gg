import { TftMatch } from "../api/tft";
import { staticEntry, tftAssetUrl, TftStaticData } from "../tftStatic";
import HexBoard from "./HexBoard";
import { SITE_IMAGES } from "../siteAssets";
import AdaptiveArtwork from "./AdaptiveArtwork";

type Props={
  match:TftMatch;
  staticData:TftStaticData|null;
};

export default function MatchBoardMap({match,staticData}:Props){
  return <section className="match-board-map match-stage-with-art">
    <AdaptiveArtwork className="match-stage-art match-stage-art-board" src={SITE_IMAGES.ui.positioning} alt="" aria-hidden="true" loading="lazy" decoding="async"/>
    <div className="match-board-map-head">
      <div>
        <span>BOARD MAP</span>
        <h3>Posição exata ainda não vem no histórico da Riot</h3>
        <p>O Chibi confirma as unidades finais sem inventar hexes. Quando o Companion puder registrar posição aprovada, este bloco recebe os dados reais.</p>
      </div>
      <b>COMPANION READY</b>
    </div>

    <div className="match-board-confirmed">
      <span>UNIDADES FINAIS CONFIRMADAS</span>
      <div className="match-board-bench">
        {match.units.map((unit,index)=>{
          const entry=staticEntry(staticData?.champions,unit.characterId);
          const image=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
          return <div key={unit.characterId+index}>
            <span>{image&&<img src={image} alt=""/>}</span>
            <small>{"★".repeat(Math.max(1,Math.min(3,unit.tier||1)))}</small>
          </div>;
        })}
      </div>

      <details className="match-board-map-note">
        <summary>Por que não estimar a posição?</summary>
        <p>Porque posição altera o significado da análise. Um hex inventado seria pior do que admitir que o dado não existe.</p>
      </details>
    </div>

    <details className="match-board-placeholder">
      <summary>
        <span><b>Ver estrutura do tabuleiro</b><small>Reservada para posições capturadas pelo Companion</small></span>
        <em>28 hexes</em>
      </summary>
      <div className="match-board-placeholder-body">
        <HexBoard
          units={[]}
          staticData={staticData}
          compact
          emptyLabel="Posições exatas não disponíveis nesta partida histórica."
        />
      </div>
    </details>
  </section>;
}
