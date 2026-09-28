import { useMemo, useState } from "react";
import { SITE_IMAGES } from "../siteAssets";

type OverlayStateId="stable"|"weak"|"contested"|"spike";

type OverlayScenario={
  id:OverlayStateId;
  label:string;
  tone:"good"|"warning"|"danger"|"neutral";
  stage:string;
  hp:number;
  gold:number;
  level:number;
  streak:string;
  boardStatus:string;
  boardScore:number;
  nowTitle:string;
  now:string[];
  problemTitle:string;
  problems:string[];
  nextSpike:string;
  nextSpikeDetail:string;
  contest:number;
  missing:string[];
  items:string[];
};

const SCENARIOS:OverlayScenario[]=[
  {
    id:"stable",
    label:"Estável",
    tone:"good",
    stage:"3-2",
    hp:82,
    gold:42,
    level:6,
    streak:"W2",
    boardStatus:"ESTÁVEL PARA O STAGE",
    boardScore:72,
    nowTitle:"Entenda por que este trecho ficou estável",
    now:[
      "O board registrado sustentou vida e economia neste ponto.",
      "Compare este snapshot com um jogo parecido que terminou pior.",
      "Observe quais upgrades e itens estavam presentes antes da estabilidade.",
    ],
    problemTitle:"Nenhum vazamento dominante no snapshot",
    problems:["Frontline suficiente","Economia preservada","Carry ainda tinha espaço de upgrade"],
    nextSpike:"Pergunta para estudar",
    nextSpikeDetail:"O que mudou depois deste snapshot?",
    contest:2,
    missing:["Carry 2★","Trait +1"],
    items:["Tank completo","Carry item 2/3"],
  },
  {
    id:"weak",
    label:"Fraco",
    tone:"danger",
    stage:"3-2",
    hp:61,
    gold:36,
    level:6,
    streak:"L3",
    boardStatus:"FRACO PARA O STAGE",
    boardScore:39,
    nowTitle:"Investigue por que o board não converteu",
    now:[
      "O snapshot terminou com pares ainda sem upgrade.",
      "A frontline aparece atrasada em relação ao carry equipado.",
      "Compare com seus Top 4 de nível semelhante antes de tirar uma conclusão.",
    ],
    problemTitle:"Frontline abaixo do restante do board",
    problems:["2 pares sem upgrade","HP já estava pressionado","Carry equipado, frontline atrasada"],
    nextSpike:"Pergunta para estudar",
    nextSpikeDetail:"Qual mudança teria aumentado a estabilidade?",
    contest:2,
    missing:["Tank 2★","Frontline +1"],
    items:["Tank incompleto","Carry 3/3"],
  },
  {
    id:"contested",
    label:"Transição",
    tone:"warning",
    stage:"4-1",
    hp:54,
    gold:31,
    level:7,
    streak:"L1",
    boardStatus:"TRANSIÇÃO INCOMPLETA",
    boardScore:58,
    nowTitle:"Revise onde a transição perdeu força",
    now:[
      "O board registrado mistura duas identidades sem fechar nenhuma delas.",
      "Itens e unidades finais sugerem uma transição ainda em andamento.",
      "Compare com suas partidas em que a troca de linha terminou em Top 4.",
    ],
    problemTitle:"Board final sem identidade consolidada",
    problems:["Sinergias divididas","Carry ainda sem estrutura completa","Frontline sem fechamento claro"],
    nextSpike:"Pergunta para estudar",
    nextSpikeDetail:"Qual peça marcou o ponto de não retorno?",
    contest:1,
    missing:["Alternativa de carry","Trait flex"],
    items:["Itens flexíveis","1 item preso"],
  },
  {
    id:"spike",
    label:"Spike",
    tone:"good",
    stage:"4-2",
    hp:67,
    gold:18,
    level:8,
    streak:"W3",
    boardStatus:"PICO DE FORÇA ATIVO",
    boardScore:86,
    nowTitle:"Use este board como referência pessoal",
    now:[
      "O snapshot mostra um board final claramente mais completo.",
      "Os upgrades estão concentrados nas peças que sustentam a composição.",
      "Compare esta estrutura com seus jogos parecidos que não chegaram ao Top 4.",
    ],
    problemTitle:"Pouco espaço para concluir causalidade",
    problems:["Board já estabilizado","Economia baixa após o pico","Resultado pode depender de contexto não capturado"],
    nextSpike:"Pergunta para estudar",
    nextSpikeDetail:"Quais partes deste board se repetem nas suas melhores partidas?",
    contest:2,
    missing:["Legendária utilitária","1 upgrade 2★"],
    items:["Core completo","Utility aberta"],
  },
];

const DEMO_UNITS=["V","A","M","S","K","T","N","R"];

export default function OverlayPage({
  hasProfile=false,
  playerName="",
  onBack,
}:{
  hasProfile?:boolean;
  playerName?:string;
  onBack:()=>void;
}){
  const [scenarioId,setScenarioId]=useState<OverlayStateId>("weak");
  const [compact,setCompact]=useState(false);

  const scenario=useMemo(
    ()=>SCENARIOS.find(item=>item.id===scenarioId)||SCENARIOS[0],
    [scenarioId],
  );

  return <main className="overlay-page">
    <section className="overlay-page-hero overlay-page-hero-art">
      <img className="overlay-page-art" src={SITE_IMAGES.art} alt="" aria-hidden="true"/>
      <div>
        {hasProfile&&<button className="back-search" onClick={onBack}>← Voltar ao perfil</button>}
        <span className="eyebrow">CHIBI COMPANION · REVIEW FIRST</span>
        <h1>Capture o momento.<br/><em>Entenda depois.</em></h1>
        <p>O companion registra snapshots úteis durante sua sessão e transforma esses momentos em revisão pós-jogo. Nada de prescrever jogadas em tempo real: o valor está em aprender com o que aconteceu.</p>
      </div>

      <div className="overlay-beta-card">
        <span>FASE ATUAL</span>
        <strong>Review Companion v1</strong>
        <small>captura + análise pós-jogo</small>
        <b>GM1.2 EM ANDAMENTO</b>
      </div>
    </section>

    <section className="overlay-demo-shell">
      <div className="overlay-demo-toolbar">
        <div>
          <span>REVER SNAPSHOT</span>
          {SCENARIOS.map(item=>(
            <button
              key={item.id}
              className={scenarioId===item.id?"active":""}
              onClick={()=>setScenarioId(item.id)}
            >{item.label}</button>
          ))}
        </div>
        <button className={compact?"active":""} onClick={()=>setCompact(value=>!value)}>
          {compact?"Modo expandido":"Modo compacto"}
        </button>
      </div>

      <div className={"overlay-live-demo "+(compact?"compact":"")+" tone-"+scenario.tone}>
        <img className="overlay-hud-art" src={SITE_IMAGES.hud} alt="" aria-hidden="true"/>
        <header className="overlay-live-head">
          <div className="overlay-live-brand">
            <span className="overlay-brand-image"><img src={SITE_IMAGES.icon} alt=""/></span>
            <div>
              <strong>Chibi Review HUD</strong>
              <small>{hasProfile&&playerName?playerName:"demo local"} · revisão pós-jogo</small>
            </div>
          </div>
          <div className="overlay-live-status">
            <i/>
            <span>REVIEW DEMO</span>
          </div>
        </header>

        <div className="overlay-live-body">
          <aside className="overlay-state-rail">
            <div><span>STAGE</span><strong>{scenario.stage}</strong></div>
            <div><span>HP</span><strong>{scenario.hp}</strong></div>
            <div><span>GOLD</span><strong>{scenario.gold}</strong></div>
            <div><span>LVL</span><strong>{scenario.level}</strong></div>
            <div><span>STREAK</span><strong>{scenario.streak}</strong></div>
          </aside>

          <section className="overlay-primary">
            <div className="overlay-board-status">
              <div>
                <span>LEITURA DO SNAPSHOT</span>
                <strong>{scenario.boardStatus}</strong>
              </div>
              <b>{scenario.boardScore}/100</b>
            </div>

            <article className="overlay-now-card">
              <span>O QUE REVISAR</span>
              <h2>{scenario.nowTitle}</h2>
              <ol>
                {scenario.now.map((item,index)=>(
                  <li key={item}><b>{index+1}</b><p>{item}</p></li>
                ))}
              </ol>
            </article>

            {!compact&&<div className="overlay-board-preview">
              <div className="overlay-board-copy">
                <span>BOARD ATUAL</span>
                <small>visual preparado para receber posições reais do companion</small>
              </div>
              <div className="overlay-hex-board" aria-label="Demonstração de tabuleiro">
                {Array.from({length:28}).map((_,index)=>{
                  const unitIndex=[15,16,18,21,23,24,25,27].indexOf(index);
                  return <div className={"overlay-hex "+(unitIndex>=0?"occupied":"")} key={index}>
                    {unitIndex>=0&&<span>{DEMO_UNITS[unitIndex]}</span>}
                  </div>;
                })}
              </div>
              <div className="overlay-board-foot">
                <span>Faltando: <b>{scenario.missing.join(" · ")}</b></span>
                <span>Itens: <b>{scenario.items.join(" · ")}</b></span>
              </div>
            </div>}
          </section>

          <aside className="overlay-signals">
            <article className="overlay-problem">
              <span>PADRÃO A INVESTIGAR</span>
              <h3>{scenario.problemTitle}</h3>
              <ul>{scenario.problems.map(item=><li key={item}>{item}</li>)}</ul>
            </article>

            <article className="overlay-spike">
              <span>O QUE ESTUDAR</span>
              <h3>{scenario.nextSpike}</h3>
              <p>{scenario.nextSpikeDetail}</p>
            </article>

            <article className="overlay-contest">
              <span>CONFIANÇA DO SINAL</span>
              <strong>{scenario.contest>=2?"Alta":scenario.contest===1?"Média":"Baixa"}</strong>
              <small>baseada apenas no snapshot demonstrado</small>
            </article>
          </aside>
        </div>
      </div>

      <p className="overlay-demo-note">Esta tela é uma simulação de revisão pós-jogo. O companion não deve usar o estado atual da partida para prescrever ações, rastrear adversários ou substituir decisões do jogador; snapshots servem para reflexão depois da partida.</p>
    </section>

    <section className="panel overlay-companion-status">
      <div className="overlay-companion-title">
        <div>
          <span>CHIBI COMPANION · GM1.2</span>
          <h2>O companion está sendo redesenhado para revisão segura</h2>
          <p>A primeira versão roda separada do site e usa snapshots locais de demonstração. O objetivo é facilitar marcação e revisão pós-jogo sem transformar o companion em um assistente de decisões ao vivo.</p>
        </div>
        <b>DESKTOP FOUNDATION</b>
      </div>

      <div className="overlay-companion-grid">
        <article>
          <span>HOTKEY</span>
          <strong>Ctrl + Shift + Space</strong>
          <small>mostrar / ocultar overlay</small>
        </article>
        <article>
          <span>CLICK-THROUGH</span>
          <strong>Ctrl + Shift + L</strong>
          <small>liberar / recuperar o mouse</small>
        </article>
        <article>
          <span>PRESETS</span>
          <strong>Compacto · Coach · Completo</strong>
          <small>tamanho e densidade persistentes</small>
        </article>
        <article>
          <span>MONITOR</span>
          <strong>Esquerda ou direita</strong>
          <small>posição salva por monitor</small>
        </article>
      </div>
    </section>

    <section className="overlay-principles">
      <article>
        <span>01</span>
        <h3>Snapshot da sessão</h3>
        <p>Stage, HP, ouro, nível e board podem ser registrados como contexto para uma revisão posterior.</p>
      </article>
      <article>
        <span>02</span>
        <h3>Revisão guiada</h3>
        <p>O Chibi destaca até três perguntas de revisão depois da partida, sempre ligadas às evidências registradas.</p>
      </article>
      <article>
        <span>03</span>
        <h3>Padrão principal</h3>
        <p>O review destaca o que merece investigação sem afirmar causalidade que os dados não sustentam.</p>
      </article>
      <article>
        <span>04</span>
        <h3>Aprendizado para a próxima</h3>
        <p>O resultado da análise vira uma pergunta ou experimento para a próxima sessão, não uma ordem durante o jogo.</p>
      </article>
    </section>

    <section className="panel overlay-roadmap">
      <div className="overlay-roadmap-head">
        <div>
          <span>CHIBI COMPANION</span>
          <h2>Da demo web para o companion de revisão</h2>
        </div>
        <small>Grande mudança 1</small>
      </div>

      <div className="overlay-roadmap-grid">
        <article className="done">
          <b>1</b>
          <div><strong>UX do Overlay</strong><span>Estados, hierarquia e modo compacto</span></div>
          <em>AGORA</em>
        </article>
        <article className="active">
          <b>2</b>
          <div><strong>Companion desktop</strong><span>Janela transparente, hotkeys, presets e monitor</span></div>
          <em>EM ANDAMENTO</em>
        </article>
        <article>
          <b>3</b>
          <div><strong>Captura permitida</strong><span>Snapshots locais para revisão posterior, sem recomendação dinâmica</span></div>
          <em>PLANEJADO</em>
        </article>
        <article>
          <b>4</b>
          <div><strong>Personalização pós-jogo</strong><span>Seu histórico ajuda a priorizar quais momentos revisar depois da sessão</span></div>
          <em>PLANEJADO</em>
        </article>
      </div>
    </section>
  </main>;
}
