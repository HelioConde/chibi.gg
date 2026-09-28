declare namespace overwolf.games.events {
  interface SetFeaturesResult { success: boolean; supportedFeatures: string[]; error?: string; }
  function setRequiredFeatures(features: string[], callback: (result: SetFeaturesResult) => void): void;
  const onInfoUpdates2: { addListener(listener: (update: unknown) => void): void };
  const onNewEvents: { addListener(listener: (event: unknown) => void): void };
  const onError: { addListener(listener: (error: unknown) => void): void };
}
