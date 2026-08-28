import type {
  DogLevelGenerationWorkerRequest,
  DogLevelGenerationWorkerResponse,
} from "@/games/dog-lege-dog/levels/level-generation-protocol";
import {
  formatDogGenerationError,
  generateVerifiedDogLevel,
} from "@/games/dog-lege-dog/levels/level-generation-verification";

interface DogGenerationWorkerScope {
  onmessage: ((event: MessageEvent<DogLevelGenerationWorkerRequest>) => void) | null;
  postMessage(response: DogLevelGenerationWorkerResponse): void;
}

const workerScope = self as unknown as DogGenerationWorkerScope;

workerScope.onmessage = (event): void => {
  const message = event.data;
  if (message.type !== "generate") return;
  try {
    const level = generateVerifiedDogLevel(message.request, message.config);
    workerScope.postMessage({
      type: "generated",
      requestId: message.requestId,
      level,
      replayVerified: true,
    });
  } catch (error) {
    workerScope.postMessage({
      type: "failed",
      requestId: message.requestId,
      diagnostic: formatDogGenerationError(error),
    });
  }
};
