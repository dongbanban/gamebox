import {
  DOG_GAME_ID,
  DOG_GAME_RESULT_DISPLAY,
} from "./games/dog-lege-dog/game/game-config";
import { startDogLegeDogGame } from "./games/dog-lege-dog";
import type { GameDefinition } from "./game-contracts";

export type {
  GameCatalogItem,
  GameDefinition,
  GameLaunchContext,
  GameLaunchHandle,
  GameLauncher,
  GameResult,
  GameResultAction,
  GameResultDisplay,
  GameResultDisplayMetadata,
  GameResultStatus,
} from "./game-contracts";

export const DOG_GAME_DEFINITION: GameDefinition = Object.freeze({
  id: DOG_GAME_ID,
  name: "狗了个狗",
  category: "DOG · TRIPLE",
  description: "看清层叠关系，找出相同图案，完成一场轻松的三消挑战。",
  cover: createDogCover(),
  playable: true,
  launch: startDogLegeDogGame,
  resultDisplay: DOG_GAME_RESULT_DISPLAY,
});

export const GAME_CATALOG: readonly GameDefinition[] = Object.freeze([
  DOG_GAME_DEFINITION,
]);

function createDogCover(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420">
      <rect width="640" height="420" rx="42" fill="#d9f0fc"/>
      <path d="M0 326c100-46 170-18 248 14 92 38 188-2 392-40v120H0Z" fill="#b5e1f4"/>
      <circle cx="530" cy="84" r="42" fill="#ffd166"/>
      <path d="M79 88c29-30 58-25 78 5 19-29 51-24 64 7" fill="none" stroke="#7bc7f5" stroke-width="12" stroke-linecap="round"/>
      <path d="m94 266 20 13m-31-1 22-2m443 18 17 13m-26-1 20-2" fill="none" stroke="#3f94c3" stroke-width="8" stroke-linecap="round"/>
      <g stroke="#16445d" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
        <path d="M223 170 144 103l21 124 79-28Z" fill="#ff8c7a"/>
        <path d="M417 170 496 103l-21 124-79-28Z" fill="#ff8c7a"/>
        <path d="M190 202c0-67 55-113 130-113s130 46 130 113v71c0 70-58 105-130 105s-130-35-130-105Z" fill="#f5b96d"/>
        <path d="M237 213c0-31 24-55 53-55s53 24 53 55v35c0 31-24 55-53 55s-53-24-53-55Zm113 0c0-31 24-55 53-55s53 24 53 55v35c0 31-24 55-53 55s-53-24-53-55Z" fill="#fbfeff"/>
        <circle cx="285" cy="218" r="10" fill="#16445d" stroke="none"/>
        <circle cx="409" cy="218" r="10" fill="#16445d" stroke="none"/>
        <path d="M304 280h72l-36 29Z" fill="#16445d"/>
        <path d="M316 314c14 14 34 14 48 0" fill="none"/>
        <path d="M191 295c-22 16-33 36-30 60m289-60c22 16 33 36 30 60" fill="none"/>
      </g>
      <path d="M245 67c16-12 33-12 49 0m70 0c16-12 33-12 49 0" fill="none" stroke="#3f94c3" stroke-width="7" stroke-linecap="round"/>
      <path d="M98 337c20-19 38-19 58 0m426 0c-20-19-38-19-58 0" fill="none" stroke="#7bc7f5" stroke-width="9" stroke-linecap="round"/>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
