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
