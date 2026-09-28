import { TftMatch } from "../api/tft";
import { staticEntry, tftAssetUrl, TftStaticData } from "../tftStatic";
import HexBoard from "./HexBoard";

type Props={
  match:TftMatch;
  staticData:TftStaticData|null;
};

export default function MatchBoardMap({match,staticData}:Props){
  return <section className="match-board-map">
    <div className="match-board-map-head">
      <div>
        <span>BOARD MAP</span>
        <h3>Posicionamento real ainda não está no histórico da Riot</h3>
        <p>O Chibi já prepara o tabuleiro para receber as posições capturadas pelo Companion. Até isso existir, não vamos inventar hexes.</p>
      </div>
      <b>COMPANION READY</b>
    </div>

    <div className="match-board-map-grid">
      <HexBoard
        units={[]}
        staticData={staticData}
        compact
        emptyLabel="Posições exatas não disponíveis nesta partida histórica."
      />

      <aside>
        <span>UNIDADES FINAIS CONFIRMADAS</span>
        <div className="match-board-bench">
          {match.units.slice(0,10).map((unit,index)=>{
            const entry=staticEntry(staticData?.champions,unit.characterId);
            const image=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
            return <div key={unit.characterId+index}>
              <span>{image&&<img src={image} alt=""/>}</span>
              <small>{"★".repeat(Math.max(1,Math.min(3,unit.tier||1)))}</small>
            </div>;
          })}
        </div>

        <div className="match-board-map-note">
          <strong>Por que não estimar?</strong>
          <p>Porque posição altera o significado da análise. Mostrar um hex incorreto seria pior do que mostrar que o dado não existe.</p>
        </div>
      </aside>
    </div>
  </section>;
}
