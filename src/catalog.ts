import {
  DOG_GAME_ID,
  DOG_GAME_RESULT_DISPLAY,
} from "@/games/dog-lege-dog/game/game-config";
import { startDogLegeDogGame } from "@/games/dog-lege-dog";
import { getDogPatternAssetUrl } from "@/games/dog-lege-dog/assets/game-assets";
import type { GameDefinition } from "@/game-contracts";

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
} from "@/game-contracts";

export const DOG_GAME_DEFINITION: GameDefinition = Object.freeze({
  id: DOG_GAME_ID,
  name: "狗了个狗",
  category: "DOG · TRIPLE",
  description: "看清层叠关系，找出相同图案，完成一场轻松的三消挑战。",
  cover: getDogPatternAssetUrl("傻狗"),
  playable: true,
  launch: startDogLegeDogGame,
  resultDisplay: DOG_GAME_RESULT_DISPLAY,
});

export const GAME_CATALOG: readonly GameDefinition[] = Object.freeze([
  DOG_GAME_DEFINITION,
]);
