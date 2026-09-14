import { describe, expect, it, vi } from "vitest";
import { createRunSeed } from "@/games/dog-lege-dog/levels/level-random";

describe("createRunSeed", () => {
  it("uses the browser UUID for each new attempt", () => {
    const randomUUID = vi.fn()
      .mockReturnValueOnce("test-run-uuid-1")
      .mockReturnValueOnce("test-run-uuid-2");
    vi.stubGlobal("crypto", { randomUUID });

    try {
      expect([createRunSeed(), createRunSeed()]).toEqual([
        "test-run-uuid-1",
        "test-run-uuid-2",
      ]);
      expect(randomUUID).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
