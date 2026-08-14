import { GAME_ID } from "./progress-store";
import { startDogLegeDogGame } from "./games/dog-lege-dog";

export interface GameLaunchHandle {
  destroy(): void;
}

export interface GameResult {
  readonly gameId: string;
  readonly levelNumber: number;
  readonly status: "won" | "lost";
  readonly reward: number;
}

export interface GameLaunchContext {
  readonly onResult?: (result: GameResult) => void;
  readonly levelNumber?: number;
}

export type GameLauncher = (
  root: HTMLElement,
  context?: GameLaunchContext,
) => GameLaunchHandle;

export interface GameCatalogItem {
  id: string;
  name: string;
  description: string;
  cover: string;
  playable: boolean;
  launch: GameLauncher;
}

export const GAME_CATALOG: readonly GameCatalogItem[] = [
  {
    id: GAME_ID,
    name: "狗了个狗",
    description: "看清层叠关系，找出相同图案，完成一场轻松的三消挑战。",
    cover: createDogCover(),
    playable: true,
    launch: startDogLegeDogGame,
  },
];

function createDogCover(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffdba6"/>
          <stop offset="1" stop-color="#f08b72"/>
        </linearGradient>
      </defs>
      <rect width="640" height="420" rx="42" fill="url(#sky)"/>
      <circle cx="520" cy="96" r="62" fill="#ffeab7" opacity=".8"/>
      <path d="M0 328c118-78 186 38 302-24 108-58 176 28 338-42v158H0Z" fill="#193b4b" opacity=".92"/>
      <path d="M160 190 118 82l90 56 112-57-34 112" fill="#8a4b3c"/>
      <path d="M180 204c0-66 54-112 126-112s126 46 126 112v74c0 68-55 104-126 104s-126-36-126-104Z" fill="#d87653"/>
      <path d="M230 208c0-31 24-56 54-56s54 25 54 56v42c0 31-24 56-54 56s-54-25-54-56Zm130 0c0-31 24-56 54-56s54 25 54 56v42c0 31-24 56-54 56s-54-25-54-56Z" fill="#ffe5bb"/>
      <circle cx="282" cy="217" r="13" fill="#193b4b"/><circle cx="410" cy="217" r="13" fill="#193b4b"/>
      <path d="M315 275c18 17 43 17 61 0" fill="none" stroke="#193b4b" stroke-width="10" stroke-linecap="round"/>
      <path d="M306 268h78l-39 34Z" fill="#193b4b"/>
      <text x="42" y="70" font-family="sans-serif" font-size="28" font-weight="700" fill="#193b4b">GAMEBOX · 01</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
