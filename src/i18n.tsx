import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Language = "pt-BR" | "en";

type TranslationVars = Record<string, string | number>;

type I18nContextValue = {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  t: (key: string, vars?: TranslationVars) => string;
};

const STORAGE_KEY = "chibi.language";
const DEFAULT_LANGUAGE: Language = "pt-BR";

const messages: Record<Language, Record<string, string>> = {
  "pt-BR": {
    "language.select": "Idioma",
    "language.portuguese": "Português",
    "language.english": "English",

    "nav.meta": "Meta",
    "nav.comps": "Comps",
    "nav.statistics": "Estatísticas",
    "nav.builder": "Builder",
    "nav.leaderboard": "Ranking",
    "nav.companion": "Companion",
    "nav.howItWorks": "Como funciona",

    "home.loading.title": "Preparando sua revisão...",
    "home.loading.subtitle": "PARTIDA FINALIZADA · Carregando os dados da partida.",
    "home.eyebrow": "TFT DE VERDADE · DADOS QUE AJUDAM VOCÊ A SUBIR",
    "home.title.line1": "Entenda suas partidas.",
    "home.title.line2": "Suba com intenção.",
    "home.intro": "Busque seu Riot ID para ver evolução, partidas, padrões e caminhos práticos para melhorar no TFT.",
    "home.benefit.profile": "Perfil e histórico",
    "home.benefit.meta": "Meta do patch",
    "home.benefit.builder": "Builder + Coach",
    "home.region": "Região",
    "home.analyzing": "Analisando...",
    "home.searchPlayer": "Buscar jogador →",
    "home.prototype": "Protótipo público",
    "home.searchById": "Busca atual por Nome#TAG",
    "home.rso": "RSO planejado após aprovação",
    "home.compliance.title": "Dados Riot + análise pós-partida",
    "home.compliance.subtitle": "sem scouting live ou automação de decisões · como funciona →",
    "home.demo.title": "Ver demonstração para review →",
    "home.demo.subtitle": "12 partidas sintéticas · não consulta a Riot API",
    "home.lastSearch": "ÚLTIMA BUSCA",
    "home.average": "média",
    "home.postGame": "PÓS-JOGO",
    "home.yourProfile": "SEU PERFIL TFT",
    "home.yourRiotId": "Seu Riot ID",
    "home.searchToStart": "Busque um jogador para começar",
    "home.averageUpper": "MÉDIA",
    "home.top4": "TOP 4",
    "home.matchesUpper": "PARTIDAS",
    "home.matchesTab": "Partidas",
    "home.now": "Agora",
    "home.coach": "Coach",
    "home.historyAction": "Seu histórico vira ação.",
    "home.understandImportant": "Entenda o que realmente importa.",
    "home.historyActionDesc": "Compare seus padrões, reveja partidas e saiba o que testar na próxima fila.",
    "home.searchActionDesc": "Busque seu Riot ID e transforme partidas em decisões mais claras.",
    "home.boardQuick": "SEU BOARD · VISÃO RÁPIDA",
    "home.seeWhatChanged": "Veja o que mudou",
    "home.patterns": "PADRÕES",
    "home.understandSignals": "Entenda seus sinais",
    "home.nextAction": "PRÓXIMA AÇÃO",
    "home.knowWhatToTest": "Saiba o que testar",
    "home.playerData": "Dados do jogador",
    "home.currentPatch": "Patch atual",
    "home.compsTraits": "comps e traits",
    "home.pathsAria": "Principais caminhos do Chibi",
    "home.path.meta.title": "Veja o que está funcionando agora.",
    "home.path.meta.desc": "Comps, traits e sinais do patch atual.",
    "home.path.game.label": "SEU JOGO",
    "home.path.game.title": "Entenda seu padrão de partidas.",
    "home.path.game.desc": "Perfil, histórico e análise do Coach.",
    "home.path.builder.title": "Planeje antes de entrar na fila.",
    "home.path.builder.desc": "Boards, itens, Augments e transições.",
    "home.proofAria": "O que o Chibi entrega",
    "home.proof.1.title": "Perfil + histórico",
    "home.proof.1.desc": "Seu jogo em uma leitura clara.",
    "home.proof.2.title": "Meta do patch",
    "home.proof.2.desc": "Dados observados e contexto atual.",
    "home.proof.3.title": "Builder completo",
    "home.proof.3.desc": "Board, itens, Augments e transições.",
    "home.proof.4.title": "Insights acionáveis",
    "home.proof.4.desc": "Menos números soltos, mais próxima ação.",
    "home.builder.kicker": "MONTE · TESTE · EVOLUA",
    "home.builder.title": "Builder mais inteligente.",
    "home.builder.desc": "Monte sua composição, organize itens e Augments, compare versões e planeje como chegar no board final sem transformar a tela em uma planilha.",
    "home.builder.explore": "Explorar o Builder →",
    "home.builder.quickPlanning": "planejamento rápido",
    "home.builder.level": "Nível",
    "home.builder.planned": "Planejado",

    "search.trigger": "Pesquisar",
    "search.placeholder": "Jogador#TAG, champion, item ou trait...",
    "search.metaDesc": "visão geral do dataset",
    "search.compsDesc": "boards observados",
    "search.statsDesc": "champions, traits e items",
    "search.builderDesc": "monte e compare boards",
    "search.overlayDesc": "overlay do Chibi",
    "search.profiles": "PERFIS",
    "search.recent": "recentes neste navegador",
    "search.results": "{{count}} resultados",
    "search.exactRiotId": "Buscar Riot ID exato",
    "search.empty": "Nenhum champion, item, trait, augment ou perfil recente encontrado. Para jogador remoto, use Nome#TAG.",

    "status.unavailable": "status indisponível",
    "status.checking": "verificando serviço...",
    "status.operational": "operacional",
    "status.activeWarnings": "{{count}} aviso(s) ativo(s)",
    "status.operationalTitle": "Nenhum incidente ou manutenção retornado pelo tft-status-v1.",
    "status.warningTitle": "{{count}} aviso(s) ativo(s) retornados pelo tft-status-v1.",

    "metaPreview.kicker": "AMOSTRA OBSERVADA",
    "metaPreview.title": "O que está funcionando agora.",
    "metaPreview.desc": "Uma leitura curta do dataset observado pelo Chibi. Entre no Meta quando quiser aprofundar.",
    "metaPreview.open": "Ver Meta completo →",
    "metaPreview.topComps": "TOP COMPS",
    "metaPreview.observedBoards": "Boards observados",
    "metaPreview.all": "Ver todas →",
    "metaPreview.observedComp": "Comp observada",
    "metaPreview.gamesAverage": "{{games}} jogos · média {{average}}",
    "metaPreview.sample": "amostra",
    "metaPreview.building": "Construindo comps observadas...",
    "metaPreview.strongTraits": "TRAITS FORTES",
    "metaPreview.observedSynergies": "Synergies observadas",
    "metaPreview.loadingTraits": "Carregando traits...",
    "metaPreview.disclaimer": "Dataset observado pelo Chibi. Percentuais só ganham destaque visual quando a amostra começa a ficar mais útil; não representa toda a população de TFT.",
  },
  en: {
    "language.select": "Language",
    "language.portuguese": "Portuguese",
    "language.english": "English",

    "nav.meta": "Meta",
    "nav.comps": "Comps",
    "nav.statistics": "Statistics",
    "nav.builder": "Builder",
    "nav.leaderboard": "Leaderboard",
    "nav.companion": "Companion",
    "nav.howItWorks": "How it works",

    "home.loading.title": "Preparing your review...",
    "home.loading.subtitle": "MATCH FINISHED · Loading match data.",
    "home.eyebrow": "REAL TFT · DATA THAT HELPS YOU CLIMB",
    "home.title.line1": "Understand your matches.",
    "home.title.line2": "Climb with intention.",
    "home.intro": "Search your Riot ID to see your progress, matches, patterns, and practical ways to improve at TFT.",
    "home.benefit.profile": "Profile and history",
    "home.benefit.meta": "Patch meta",
    "home.benefit.builder": "Builder + Coach",
    "home.region": "Region",
    "home.analyzing": "Analyzing...",
    "home.searchPlayer": "Search player →",
    "home.prototype": "Public prototype",
    "home.searchById": "Current search: Name#TAG",
    "home.rso": "RSO planned after approval",
    "home.compliance.title": "Riot data + post-game analysis",
    "home.compliance.subtitle": "no live scouting or decision automation · how it works →",
    "home.demo.title": "View review demo →",
    "home.demo.subtitle": "12 synthetic matches · does not call the Riot API",
    "home.lastSearch": "LAST SEARCH",
    "home.average": "avg.",
    "home.postGame": "POST-GAME",
    "home.yourProfile": "YOUR TFT PROFILE",
    "home.yourRiotId": "Your Riot ID",
    "home.searchToStart": "Search a player to get started",
    "home.averageUpper": "AVERAGE",
    "home.top4": "TOP 4",
    "home.matchesUpper": "MATCHES",
    "home.matchesTab": "Matches",
    "home.now": "Now",
    "home.coach": "Coach",
    "home.historyAction": "Turn your history into action.",
    "home.understandImportant": "Understand what really matters.",
    "home.historyActionDesc": "Compare your patterns, review matches, and know what to test in your next queue.",
    "home.searchActionDesc": "Search your Riot ID and turn matches into clearer decisions.",
    "home.boardQuick": "YOUR BOARD · QUICK VIEW",
    "home.seeWhatChanged": "See what changed",
    "home.patterns": "PATTERNS",
    "home.understandSignals": "Understand your signals",
    "home.nextAction": "NEXT ACTION",
    "home.knowWhatToTest": "Know what to test",
    "home.playerData": "Player data",
    "home.currentPatch": "Current patch",
    "home.compsTraits": "comps and traits",
    "home.pathsAria": "Main Chibi paths",
    "home.path.meta.title": "See what is working right now.",
    "home.path.meta.desc": "Comps, traits, and signals from the current patch.",
    "home.path.game.label": "YOUR GAME",
    "home.path.game.title": "Understand your match patterns.",
    "home.path.game.desc": "Profile, history, and Coach analysis.",
    "home.path.builder.title": "Plan before you queue.",
    "home.path.builder.desc": "Boards, items, Augments, and transitions.",
    "home.proofAria": "What Chibi delivers",
    "home.proof.1.title": "Profile + history",
    "home.proof.1.desc": "Your game in a clear read.",
    "home.proof.2.title": "Patch meta",
    "home.proof.2.desc": "Observed data and current context.",
    "home.proof.3.title": "Complete Builder",
    "home.proof.3.desc": "Board, items, Augments, and transitions.",
    "home.proof.4.title": "Actionable insights",
    "home.proof.4.desc": "Fewer isolated numbers, more next actions.",
    "home.builder.kicker": "BUILD · TEST · IMPROVE",
    "home.builder.title": "A smarter Builder.",
    "home.builder.desc": "Build your comp, organize items and Augments, compare versions, and plan how to reach your final board without turning the screen into a spreadsheet.",
    "home.builder.explore": "Explore Builder →",
    "home.builder.quickPlanning": "quick planning",
    "home.builder.level": "Level",
    "home.builder.planned": "Planned",

    "search.trigger": "Search",
    "search.placeholder": "Player#TAG, champion, item, or trait...",
    "search.metaDesc": "dataset overview",
    "search.compsDesc": "observed boards",
    "search.statsDesc": "champions, traits, and items",
    "search.builderDesc": "build and compare boards",
    "search.overlayDesc": "Chibi overlay",
    "search.profiles": "PROFILES",
    "search.recent": "recent in this browser",
    "search.results": "{{count}} results",
    "search.exactRiotId": "Search exact Riot ID",
    "search.empty": "No champion, item, trait, augment, or recent profile found. For a remote player, use Name#TAG.",

    "status.unavailable": "status unavailable",
    "status.checking": "checking service...",
    "status.operational": "operational",
    "status.activeWarnings": "{{count}} active warning(s)",
    "status.operationalTitle": "No incident or maintenance returned by tft-status-v1.",
    "status.warningTitle": "{{count}} active warning(s) returned by tft-status-v1.",

    "metaPreview.kicker": "OBSERVED SAMPLE",
    "metaPreview.title": "What is working right now.",
    "metaPreview.desc": "A short view of the dataset observed by Chibi. Open Meta whenever you want to go deeper.",
    "metaPreview.open": "View full Meta →",
    "metaPreview.topComps": "TOP COMPS",
    "metaPreview.observedBoards": "Observed boards",
    "metaPreview.all": "View all →",
    "metaPreview.observedComp": "Observed comp",
    "metaPreview.gamesAverage": "{{games}} games · avg. {{average}}",
    "metaPreview.sample": "sample",
    "metaPreview.building": "Building observed comps...",
    "metaPreview.strongTraits": "STRONG TRAITS",
    "metaPreview.observedSynergies": "Observed synergies",
    "metaPreview.loadingTraits": "Loading traits...",
    "metaPreview.disclaimer": "Dataset observed by Chibi. Percentages only receive visual emphasis when the sample starts becoming more useful; it does not represent the entire TFT population.",
  },
};

function interpolate(template: string, vars?: TranslationVars) {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : "{{" + key + "}}",
  );
}

function readInitialLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "pt-BR") return stored;
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
  return DEFAULT_LANGUAGE;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(readInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Keep the selected language for this session even if persistence fails.
    }
  }, [language]);

  const value = useMemo<I18nContextValue>(() => ({
    language,
    locale: language === "en" ? "en-US" : "pt-BR",
    setLanguage,
    t: (key, vars) => {
      const template =
        messages[language][key] ??
        messages[DEFAULT_LANGUAGE][key] ??
        key;
      return interpolate(template, vars);
    },
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
    <label className="language-switcher" title={t("language.select")}>
      <span aria-hidden="true">🌐</span>
      <select
        aria-label={t("language.select")}
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
      >
        <option value="pt-BR">PT</option>
        <option value="en">EN</option>
      </select>
    </label>
  );
}
