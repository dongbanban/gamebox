import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import type { LevelGeneratorRequest } from "@/games/dog-lege-dog/levels/level-generator-contracts";
import type { DogLegeDogLevel } from "@/games/dog-lege-dog/levels/level-types";

export interface DogLevelGenerationWorkerRequest {
  readonly type: "generate";
  readonly requestId: string;
  readonly request: LevelGeneratorRequest;
  readonly config: DogV13Config;
}

export type DogLevelGenerationWorkerResponse =
  | {
      readonly type: "generated";
      readonly requestId: string;
      readonly level: DogLegeDogLevel;
      readonly replayVerified: true;
    }
  | {
      readonly type: "failed";
      readonly requestId: string;
      readonly diagnostic: string;
    };

export interface DogLevelGenerationWorker {
  onmessage: ((event: MessageEvent<DogLevelGenerationWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(request: DogLevelGenerationWorkerRequest): void;
  terminate(): void;
}
