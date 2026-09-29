declare namespace overwolf.games.events {
  interface SetFeaturesResult { success: boolean; supportedFeatures: string[]; error?: string; }
  function setRequiredFeatures(features: string[], callback: (result: SetFeaturesResult) => void): void;
  const onInfoUpdates2: { addListener(listener: (update: unknown) => void): void };
  const onNewEvents: { addListener(listener: (event: unknown) => void): void };
  const onError: { addListener(listener: (error: unknown) => void): void };
}

declare namespace overwolf.games {
  interface RunningGameInfo { id?: number; classId?: number; title?: string; isRunning?: boolean; }
  interface GameInfoUpdatedEvent { gameInfo?: RunningGameInfo; runningChanged?: boolean; gameChanged?: boolean; }
  function getRunningGameInfo2(callback: (result: { success: boolean; gameInfo: RunningGameInfo | null; error?: string }) => void): void;
  const onGameInfoUpdated: { addListener(listener: (event: GameInfoUpdatedEvent) => void): void };
}

declare namespace overwolf.windows {
  interface WindowInfo {
    id: string;
    name?: string;
  }

  interface WindowResult {
    status: "success" | "error";
    window?: WindowInfo;
    error?: string;
  }

  interface WindowIdResult {
    status?: "success" | "error";
    success?: boolean;
    error?: string;
  }

  function obtainDeclaredWindow(windowName: string, callback: (result: WindowResult) => void): void;
  function restore(windowIdOrName: string, callback?: (result: WindowIdResult) => void): void;
  function getCurrentWindow(callback: (result: WindowResult) => void): void;
  function minimize(windowIdOrName: string, callback?: (result: WindowIdResult) => void): void;
  function close(windowIdOrName: string, callback?: (result: WindowIdResult) => void): void;
}
