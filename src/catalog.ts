import { DOG_V13_CONFIG } from "@/games/dog-lege-dog/game/v13-config";
import {
  DogLevelGenerationService,
  startDogLegeDogGame,
} from "@/games/dog-lege-dog";
import { getDogPatternAssetUrl } from "@/games/dog-lege-dog/assets/game-assets";
import type {
  GameDefinition,
  GamePreparationContext,
} from "@/game-contracts";

export type {
  GameCatalogItem,
  GameDefinition,
  GameLaunchContext,
  GameLaunchHandle,
  GameLaunchPreparation,
  GameLauncher,
  GamePreparer,
  GamePreparationContext,
  GamePreparationFailureDetails,
  GamePreparationResult,
  GameResult,
  GameResultAction,
  GameResultDisplay,
  GameResultDisplayMetadata,
  GameResultStatus,
} from "@/game-contracts";
export { GamePreparationError } from "@/game-contracts";

const dogLevelGeneration = new DogLevelGenerationService();

export const DOG_GAME_DEFINITION: GameDefinition = Object.freeze({
  id: DOG_V13_CONFIG.game.id,
  name: "狗了个狗",
  category: "DOG · TRIPLE",
  description: "看清层叠关系，找出相同图案，完成一场轻松的三消挑战。",
  cover: getDogPatternAssetUrl("傻狗"),
  playable: true,
  prepareLaunch: (context: GamePreparationContext) => dogLevelGeneration.prepare({
    levelNumber: context.levelNumber,
    runSeed: context.runSeed,
    config: context.config,
    signal: context.signal,
  }),
  launch: startDogLegeDogGame,
  resultDisplay: DOG_V13_CONFIG.ui.copy.result,
});

export const GAME_CATALOG: readonly GameDefinition[] = Object.freeze([
  DOG_GAME_DEFINITION,
]);
