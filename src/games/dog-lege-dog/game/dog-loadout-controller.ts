import {
  areDogLoadoutsEqual,
  isDogItemId,
  isValidDogLoadout,
} from "@/games/dog-lege-dog/game/dog-loadout";
import type { DogItemId } from "@/games/dog-lege-dog/game/dog-loadout";
import type { DogGameRuntime } from "@/games/dog-lege-dog/game/dog-game-runtime-types";
import { isDogGameInputLocked } from "@/games/dog-lege-dog/game/dog-game-state";

export interface DogLoadoutControllerOptions {
  readonly runtime: Pick<
    DogGameRuntime,
    | "activeFlights"
    | "config"
    | "hasInteracted"
    | "inputLocked"
    | "itemRuntime"
    | "loadout"
    | "loadoutEditor"
    | "matchAnimation"
    | "meltAnimation"
    | "session"
  >;
  readonly render: () => void;
  readonly commitLoadout: (draft: readonly DogItemId[], mode: "initial" | "change") => void;
}

export class DogLoadoutController {
  private readonly options: DogLoadoutControllerOptions;

  constructor(options: DogLoadoutControllerOptions) {
    this.options = options;
  }

  toggle(itemId: string | undefined): void {
    const { runtime } = this.options;
    if (runtime.loadoutEditor === null || itemId === undefined || !isDogItemId(itemId)) {
      return;
    }

    const draft = runtime.loadoutEditor.draft;
    const nextDraft = draft.includes(itemId)
      ? draft.filter((selectedItemId) => selectedItemId !== itemId)
      : draft.length < runtime.config.items.loadoutSize
        ? [...draft, itemId]
        : draft;
    runtime.loadoutEditor = {
      ...runtime.loadoutEditor,
      draft: nextDraft,
      confirming: false,
    };
    this.options.render();
  }

  open(): void {
    const { runtime } = this.options;
    if (
      runtime.loadout === null ||
      isDogGameInputLocked(runtime) ||
      runtime.activeFlights.size > 0 ||
      runtime.matchAnimation !== null ||
      runtime.hasInteracted ||
      runtime.session.getState().status !== "playing"
    ) {
      return;
    }

    runtime.inputLocked = true;
    runtime.loadoutEditor = {
      mode: "change",
      draft: [...runtime.loadout],
      confirming: false,
    };
    this.options.render();
  }

  cancel(): void {
    const { runtime } = this.options;
    if (runtime.loadoutEditor === null) {
      return;
    }
    if (runtime.loadoutEditor.mode === "initial") {
      runtime.loadoutEditor = {
        ...runtime.loadoutEditor,
        draft: [],
        confirming: false,
      };
      this.options.render();
      return;
    }

    runtime.loadoutEditor = null;
    runtime.inputLocked = false;
    this.options.render();
  }

  requestConfirmation(): void {
    const { runtime } = this.options;
    const editor = runtime.loadoutEditor;
    if (
      editor === null ||
      !isValidDogLoadout(editor.draft, runtime.config.items.loadoutSize)
    ) {
      return;
    }
    if (editor.mode === "change") {
      if (areDogLoadoutsEqual(runtime.loadout, editor.draft, runtime.config.items.loadoutSize)) {
        this.cancel();
        return;
      }
      runtime.loadoutEditor = { ...editor, confirming: true };
      this.options.render();
      return;
    }

    this.options.commitLoadout(editor.draft, editor.mode);
  }

  cancelConfirmation(): void {
    const { runtime } = this.options;
    if (runtime.loadoutEditor === null || !runtime.loadoutEditor.confirming) {
      return;
    }
    runtime.loadoutEditor = {
      ...runtime.loadoutEditor,
      confirming: false,
    };
    this.options.render();
  }

  applyChange(): void {
    const editor = this.options.runtime.loadoutEditor;
    if (editor === null || editor.mode !== "change" || !editor.confirming) {
      return;
    }
    this.options.commitLoadout(editor.draft, editor.mode);
  }
}
