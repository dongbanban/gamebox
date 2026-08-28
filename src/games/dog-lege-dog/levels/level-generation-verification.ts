import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import { LevelGenerator } from "@/games/dog-lege-dog/levels/level-generation-engine";
import type { LevelGeneratorRequest } from "@/games/dog-lege-dog/levels/level-generator-contracts";
import type { DogLegeDogLevel } from "@/games/dog-lege-dog/levels/level-types";

export function generateVerifiedDogLevel(
  request: LevelGeneratorRequest,
  config: DogV13Config,
): DogLegeDogLevel {
  const generator = new LevelGenerator({ config });
  const level = generator.generate(request);
  if (config.generation.verifyReplayBeforePublish) {
    const replayed = generator.replay(level.generation.replay);
    if (JSON.stringify(replayed) !== JSON.stringify(level)) {
      throw new Error("LevelGenerator replay verification did not reproduce the generated level");
    }
  }
  return level;
}

export function formatDogGenerationError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
