import { useMemo, useState } from "react";

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
    nowTitle:"Preserve economia e observe a lobby",
    now:[
      "Não há necessidade clara de rolar agora.",
      "Complete seu próximo item de frontline se aparecer.",
      "Scout antes do 3-5 para confirmar se sua linha está livre.",
    ],
    problemTitle:"Nenhum problema dominante",
    problems:["Frontline suficiente","Economia saudável","Carry ainda precisa de 1 upgrade"],
    nextSpike:"Level 7",
    nextSpikeDetail:"Janela provável: 4-1 / 4-2",
    contest:1,
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
    nowTitle:"Estabilize antes de continuar greedando",
    now:[
      "Prioridade: transforme pares em upgrades.",
      "Se a próxima luta também for derrota grande, gaste parte do ouro.",
      "Não faça transição completa sem melhorar a frontline primeiro.",
    ],
    problemTitle:"Frontline abaixo do necessário",
    problems:["2 pares sem upgrade","HP caindo rápido","Carry equipado, frontline atrasada"],
    nextSpike:"Estabilização",
    nextSpikeDetail:"Gastar 10–20g se necessário",
    contest:1,
    missing:["Tank 2★","Frontline +1"],
    items:["Tank incompleto","Carry 3/3"],
  },
  {
    id:"contested",
    label:"Contestado",
    tone:"warning",
    stage:"4-1",
    hp:54,
    gold:31,
    level:7,
    streak:"L1",
    boardStatus:"LINHA MUITO CONTESTADA",
    boardScore:58,
    nowTitle:"Pare antes de comprometer todo o ouro",
    now:[
      "Há 2 jogadores usando várias peças da sua linha.",
      "Compare sua reserva com a rota alternativa antes de rolar fundo.",
      "Mantenha duas saídas possíveis para o mesmo conjunto de itens.",
    ],
    problemTitle:"Peças centrais divididas na lobby",
    problems:["2 rivais na mesma linha","Carry principal disputado","Frontline compartilhada"],
    nextSpike:"Decisão de pivot",
    nextSpikeDetail:"Antes do próximo rolldown",
    contest:2,
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
    nowTitle:"Consolide o board — não desmonte o que já funciona",
    now:[
      "Seu board está acima da pressão atual da lobby.",
      "Priorize upgrades de alta qualidade em vez de trocar toda a estrutura.",
      "Use o próximo scout para ajustar posicionamento e proteger o carry.",
    ],
    problemTitle:"Risco principal: over-roll",
    problems:["Board já estabilizado","Economia baixa após spike","Próximo ganho vem de upgrades específicos"],
    nextSpike:"Cap de board",
    nextSpikeDetail:"Upgrades + posicionamento",
    contest:0,
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
    <section className="overlay-page-hero">
      <div>
        {hasProfile&&<button className="back-search" onClick={onBack}>← Voltar ao perfil</button>}
        <span className="eyebrow">GRANDE MUDANÇA 1 · CHIBI OVERLAY</span>
        <h1>Decisão em tempo real.<br/><em>Sem jogar por você.</em></h1>
        <p>O overlay do Chibi será uma camada de decisão: entender o estado da partida, destacar o problema principal e mostrar caminhos possíveis sem remover a escolha do jogador.</p>
      </div>

      <div className="overlay-beta-card">
        <span>FASE ATUAL</span>
        <strong>Overlay v1</strong>
        <small>web + companion desktop</small>
        <b>GM1.2 EM ANDAMENTO</b>
      </div>
    </section>

    <section className="overlay-demo-shell">
      <div className="overlay-demo-toolbar">
        <div>
          <span>SIMULAR ESTADO</span>
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
        <header className="overlay-live-head">
          <div className="overlay-live-brand">
            <span>c</span>
            <div>
              <strong>Chibi Overlay</strong>
              <small>{hasProfile&&playerName?playerName:"demo local"} · leitura assistiva</small>
            </div>
          </div>
          <div className="overlay-live-status">
            <i/>
            <span>SIMULAÇÃO</span>
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
                <span>ESTADO DO BOARD</span>
                <strong>{scenario.boardStatus}</strong>
              </div>
              <b>{scenario.boardScore}/100</b>
            </div>

            <article className="overlay-now-card">
              <span>FAÇA AGORA</span>
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
              <span>O QUE ESTÁ DANDO ERRADO</span>
              <h3>{scenario.problemTitle}</h3>
              <ul>{scenario.problems.map(item=><li key={item}>{item}</li>)}</ul>
            </article>

            <article className="overlay-spike">
              <span>PRÓXIMO SPIKE</span>
              <h3>{scenario.nextSpike}</h3>
              <p>{scenario.nextSpikeDetail}</p>
            </article>

            <article className="overlay-contest">
              <span>CONTESTAÇÃO</span>
              <strong>{scenario.contest}</strong>
              <small>{scenario.contest===0?"nenhum rival direto":scenario.contest===1?"rival direto":"rivais diretos"}</small>
            </article>
          </aside>
        </div>
      </div>

      <p className="overlay-demo-note">Esta tela é uma simulação de UX. O companion real só poderá mostrar sinais suportados por dados permitidos/coletados localmente e sempre manterá múltiplas escolhas em vez de automatizar decisões.</p>
    </section>

    <section className="panel overlay-companion-status">
      <div className="overlay-companion-title">
        <div>
          <span>CHIBI COMPANION · GM1.2</span>
          <h2>A janela real do overlay já está sendo preparada</h2>
          <p>A primeira versão roda separada do site e ainda usa dados simulados. Isso permite validar tamanho, posição e interação sobre o jogo antes de conectar qualquer leitura do TFT.</p>
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
        <h3>Estado atual</h3>
        <p>Stage, HP, ouro, nível, streak e força relativa em um bloco pequeno.</p>
      </article>
      <article>
        <span>02</span>
        <h3>Faça agora</h3>
        <p>No máximo três decisões prioritárias. Nada de vinte indicadores disputando atenção.</p>
      </article>
      <article>
        <span>03</span>
        <h3>Problema principal</h3>
        <p>O overlay destaca o que merece revisão sem afirmar causalidade que os dados não sustentam.</p>
      </article>
      <article>
        <span>04</span>
        <h3>Próximo spike</h3>
        <p>Mostra a próxima janela de força ou decisão para o jogador saber o que está esperando.</p>
      </article>
    </section>

    <section className="panel overlay-roadmap">
      <div className="overlay-roadmap-head">
        <div>
          <span>CHIBI COMPANION</span>
          <h2>Da demo web para o overlay real</h2>
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
          <div><strong>Leitura permitida</strong><span>Stage, HUD e snapshots locais com validação</span></div>
          <em>PLANEJADO</em>
        </article>
        <article>
          <b>4</b>
          <div><strong>Personalização Chibi</strong><span>Seu histórico influencia quais sinais recebem prioridade</span></div>
          <em>PLANEJADO</em>
        </article>
      </div>
    </section>
  </main>;
}
