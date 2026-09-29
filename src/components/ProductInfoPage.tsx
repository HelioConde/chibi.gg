type PageKind="about"|"privacy"|"terms";

type Props={
  page:PageKind;
  onBack:()=>void;
  onOpenPrivacy:()=>void;
  onOpenTerms:()=>void;
  onOpenAbout:()=>void;
};

const RIOT_NOTICE="Chibi.gg isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.";

function RiotNotice(){
  return <section className="legal-riot-notice" aria-label="Riot Games legal notice">
    <span>RIOT GAMES NOTICE</span>
    <p>{RIOT_NOTICE}</p>
    <p>Chibi.gg was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.</p>
  </section>;
}

function About(){
  return <>
    <section className="legal-hero">
      <span>COMO O CHIBI FUNCIONA</span>
      <h1>Dados de TFT explicados.<br/><em>Sem jogar por você.</em></h1>
      <p>O Chibi.gg transforma perfil, rank e histórico pós-partida em uma leitura mais fácil de revisar. O objetivo é ajudar o jogador a entender o próprio histórico sem remover a tomada de decisão do TFT.</p>
    </section>

    <section className="legal-grid">
      <article>
        <b>01</b>
        <span>BUSCA DO JOGADOR</span>
        <h2>Riot ID → perfil TFT</h2>
        <p>O Riot ID é resolvido no backend e usado para consultar perfil, rank e histórico pelos serviços oficiais disponibilizados pela Riot.</p>
      </article>
      <article>
        <b>02</b>
        <span>PÓS-PARTIDA</span>
        <h2>Match API → snapshot final</h2>
        <p>As análises históricas usam o estado final disponível da partida: colocação, nível, ouro final, traits, unidades, itens, augments do próprio histórico e outros campos retornados pela API.</p>
      </article>
      <article>
        <b>03</b>
        <span>CHIBI REVIEW</span>
        <h2>Resposta → evidência</h2>
        <p>Quando o Chibi encontra um sinal, ele mostra a amostra e permite abrir as partidas relacionadas. Amostras pequenas recebem linguagem menos assertiva.</p>
      </article>
      <article>
        <b>04</b>
        <span>CHIBI DATASET</span>
        <h2>Observado, não universal</h2>
        <p>O dataset global é formado por snapshots normalizados de partidas consultadas no produto. Ele não representa toda a população de TFT e não é uma tier list oficial.</p>
      </article>
    </section>

    <section className="legal-section">
      <div className="legal-section-title">
        <span>FONTES DE DADOS</span>
        <h2>O que alimenta o produto</h2>
      </div>
      <div className="legal-source-list">
        <div><strong>account-v1</strong><p>Resolve Riot ID e PUUID no backend.</p></div>
        <div><strong>tft-summoner-v1</strong><p>Informações públicas de perfil TFT quando disponíveis.</p></div>
        <div><strong>tft-league-v1</strong><p>Rank, LP, vitórias e derrotas oficiais.</p></div>
        <div><strong>tft-match-v1</strong><p>IDs e detalhes pós-partida usados no histórico e nas reviews.</p></div>
        <div><strong>tft-status-v1</strong><p>Status do serviço TFT por plataforma.</p></div>
        <div><strong>Data Dragon / TFT static data</strong><p>Nomes, imagens e dados estáticos necessários para representar champions, traits, itens e outros assets permitidos.</p></div>
      </div>
    </section>

    <section className="legal-section">
      <div className="legal-section-title">
        <span>FLUXO DE CONTA</span>
        <h2>Protótipo agora · RSO na produção aprovada</h2>
      </div>
      <p className="legal-boundary-note">O protótipo público atual usa busca por Riot ID para demonstrar o fluxo de perfil e revisão. A documentação atual de TFT classifica estatísticas do próprio jogador e ferramentas que mostram o próprio histórico como casos de produção que usam Riot Sign On (RSO). O RSO só fica disponível depois que a aplicação de produção é aprovada; por isso a integração de login será concluída nessa etapa, se solicitada/confirmada pela Riot no processo de aprovação.</p>
    </section>

    <section className="legal-section legal-boundaries">
      <div className="legal-section-title">
        <span>LIMITES DO PRODUTO</span>
        <h2>O que o Chibi não faz</h2>
      </div>
      <div className="legal-boundary-list">
        <div><i>×</i><p>Não faz scouting de oponentes em tempo real.</p></div>
        <div><i>×</i><p>Não rastreia boards adversários para recomendar sua próxima ação.</p></div>
        <div><i>×</i><p>Não automatiza compra, venda, reroll, level up ou posicionamento.</p></div>
        <div><i>×</i><p>Não cria MMR/ELO alternativo para substituir o rank oficial.</p></div>
        <div><i>×</i><p>Não afirma conhecer shops, timing exato de roll, trajetória de HP, scouting ou posicionamento histórico quando esses dados não existem na fonte utilizada.</p></div>
      </div>
      <p className="legal-boundary-note">O Companion/Overwolf está em desenvolvimento. Recursos live só devem usar dados permitidos/aprovados e continuam sujeitos aos mesmos limites de integridade de gameplay.</p>
    </section>

    <RiotNotice/>
  </>;
}

function Privacy(){
  return <>
    <section className="legal-hero legal-hero-small">
      <span>PRIVACIDADE</span>
      <h1>O que o Chibi processa<br/><em>e onde fica.</em></h1>
      <p>Última atualização: 29/09/2026. Esta página descreve o comportamento atual do protótipo público do Chibi.gg.</p>
    </section>

    <section className="legal-section legal-copy">
      <h2>1. Dados consultados</h2>
      <p>Quando você pesquisa um Riot ID, o Chibi envia a consulta ao nosso backend. O backend consulta serviços oficiais da Riot para obter informações públicas necessárias ao produto, como perfil TFT, rank e histórico de partidas.</p>

      <h2>2. Chibi Dataset e cache</h2>
      <p>Para reduzir chamadas repetidas e construir estatísticas agregadas, o backend pode armazenar snapshots normalizados de partidas já consultadas. O cache técnico de partidas pode conter PUUIDs retornados pela Riot para localizar o participante correto dentro daquela partida. Esse identificador é usado no fluxo técnico do histórico/cache.</p>
      <p>Separadamente, a tabela de observações usada para estatísticas globais guarda identificador da partida, colocação, data, fila, set, versão, nível, ouro final, dano/eliminações quando disponíveis, augments, traits e unidades. Essa tabela agregada não armazena PUUID, Riot ID ou nome do jogador.</p>

      <h2>3. Dados mantidos no seu navegador</h2>
      <p>Algumas ferramentas pessoais usam <code>localStorage</code> do navegador para continuar funcionando sem conta. Isso inclui buscas recentes, Journal/notas da partida, lições, sessões de estudo, presets do Builder, Study Shelf, snapshots locais de rank e progresso de reviews.</p>
      <p>Esses dados locais permanecem no navegador em que foram criados até serem removidos pela própria interface quando houver controle disponível ou pela limpeza de dados do site no navegador.</p>

      <h2>4. Chaves e credenciais</h2>
      <p>A chave da Riot API e a service role do Supabase não são incluídas no JavaScript público do site. As chamadas que precisam dessas credenciais acontecem em funções de backend.</p>

      <h2>5. Login e Riot Sign On</h2>
      <p>O protótipo público atual demonstra o produto com busca direta por Riot ID. Para a versão de produção, o Chibi está preparado para adicionar Riot Sign On (RSO) ao fluxo de dados pessoais assim que a aplicação de produção for aprovada e a Riot disponibilizar as credenciais/etapas de RSO.</p>
      <p>Quando RSO for ativado, esta política será atualizada antes do lançamento para explicar tokens, sessão, revogação e retenção aplicáveis.</p>

      <h2>6. Limites</h2>
      <p>O Chibi usa dados para histórico, análise pós-partida e ferramentas de estudo. O produto não usa o histórico público para oferecer scouting live de oponentes ou automação de decisões durante a partida.</p>

      <h2>7. Contato</h2>
      <p>Para dúvidas sobre o comportamento técnico ou esta política, use o repositório público do projeto no GitHub. Não publique informações sensíveis em uma issue pública.</p>
      <p><a href="https://github.com/HelioConde/chibi.gg/issues" target="_blank" rel="noreferrer">Abrir issues do chibi.gg ↗</a></p>

      <h2>8. Alterações</h2>
      <p>Esta política pode mudar conforme o produto, APIs e requisitos de plataforma evoluírem. A data no topo indica a revisão publicada.</p>
    </section>

    <RiotNotice/>
  </>;
}

function Terms(){
  return <>
    <section className="legal-hero legal-hero-small">
      <span>TERMOS DO CHIBI.GG</span>
      <h1>Use como ferramenta de estudo.<br/><em>Não como garantia.</em></h1>
      <p>Última atualização: 29/09/2026. Estes termos descrevem as regras básicas de uso da versão pública atual.</p>
    </section>

    <section className="legal-section legal-copy">
      <h2>1. Finalidade</h2>
      <p>Chibi.gg é um companion de Teamfight Tactics para consulta de perfil, histórico, estatísticas observadas, planejamento e análise pós-partida. As leituras são informativas e educacionais.</p>

      <h2>2. Precisão e disponibilidade</h2>
      <p>Os dados podem ficar indisponíveis, atrasados, incompletos ou mudar conforme Riot, Data Dragon, Supabase e outras dependências atualizem seus serviços. O Chibi não garante resultado competitivo, colocação ou disponibilidade contínua.</p>

      <h2>3. Análises e recomendações</h2>
      <p>As análises descrevem associações e diferenças observáveis nos dados disponíveis. Elas não devem ser tratadas como prova de causalidade. Quando a API não fornece uma informação, o Chibi deve evitar inventá-la.</p>

      <h2>4. Integridade de gameplay</h2>
      <p>Você não deve usar o Chibi para automatizar gameplay, obter vantagem injusta, contornar regras do jogo ou transformar o produto em scouting/opponent tracking proibido. Recursos futuros do Companion permanecem condicionados às políticas e aprovações aplicáveis.</p>

      <h2>5. Propriedade intelectual</h2>
      <p>Teamfight Tactics, Riot Games e propriedades associadas pertencem aos respectivos titulares. Assets de Riot usados no produto devem seguir as permissões e políticas publicadas pela Riot.</p>

      <h2>6. Mudanças</h2>
      <p>Recursos, fontes de dados e estes termos podem ser atualizados durante o desenvolvimento. O uso continuado da versão pública após uma atualização fica sujeito à versão mais recente publicada aqui.</p>
    </section>

    <RiotNotice/>
  </>;
}

export default function ProductInfoPage({
  page,
  onBack,
  onOpenPrivacy,
  onOpenTerms,
  onOpenAbout,
}:Props){
  return <main className="legal-page">
    <div className="legal-page-nav">
      <button onClick={onBack}>← Voltar</button>
      <nav aria-label="Informações do produto">
        <button className={page==="about"?"active":""} onClick={onOpenAbout}>Como funciona</button>
        <button className={page==="privacy"?"active":""} onClick={onOpenPrivacy}>Privacidade</button>
        <button className={page==="terms"?"active":""} onClick={onOpenTerms}>Termos</button>
      </nav>
    </div>

    {page==="about"?<About/>:page==="privacy"?<Privacy/>:<Terms/>}

    <div className="legal-official-links">
      <span>Referências de política</span>
      <a href="https://developer.riotgames.com/policies/general" target="_blank" rel="noreferrer">Riot Developer General Policies ↗</a>
      <a href="https://www.riotgames.com/en/legal" target="_blank" rel="noreferrer">Riot Legal Jibber Jabber ↗</a>
    </div>
  </main>;
}
