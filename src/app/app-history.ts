export interface ActiveLevel {
  readonly gameId: string;
  readonly levelNumber: number;
}

export type GameboxHistoryState = {
  readonly gameboxRoute: "catalog" | "game";
  readonly gameId?: string;
  readonly levelNumber?: number;
};

export function setGameHistory(gameId: string, levelNumber: number): void {
  const nextState: GameboxHistoryState = {
    gameboxRoute: "game",
    gameId,
    levelNumber,
  };
  if (getHistoryRoute() === "game") {
    window.history.replaceState(nextState, "", getCurrentUrl());
    return;
  }

  window.history.pushState(nextState, "", getCurrentUrl());
}

export function restoreGameHistory(activeLevel: ActiveLevel | null): void {
  if (activeLevel === null) {
    return;
  }

  setGameHistory(activeLevel.gameId, activeLevel.levelNumber);
}

export function replaceHistoryWithCatalog(): void {
  window.history.replaceState(
    { gameboxRoute: "catalog" } satisfies GameboxHistoryState,
    "",
    getCurrentUrl(),
  );
}

export function getHistoryRoute(): GameboxHistoryState["gameboxRoute"] | null {
  const state: unknown = window.history.state;
  if (
    typeof state !== "object" ||
    state === null ||
    !("gameboxRoute" in state) ||
    (state.gameboxRoute !== "catalog" && state.gameboxRoute !== "game")
  ) {
    return null;
  }

  return state.gameboxRoute;
}

function getCurrentUrl(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
