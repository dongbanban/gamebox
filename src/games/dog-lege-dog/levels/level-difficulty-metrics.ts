import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import type {
  DogLevelGeometry,
} from "@/games/dog-lege-dog/levels/level-types";
import type { PathSimulationMetrics } from "@/games/dog-lege-dog/levels/level-solvability";

export function getEffectiveTrayCapacity(
  level: DogLevelGeometry,
  config: DogV13Config,
): number {
  return config.tray.baseCapacity - (level.lockedTraySlotCount ?? 0);
}

export function calculateTrayPeakPressure(
  trayPeakLogicalUnitCount: number,
  effectiveTrayCapacity: number,
  safeChoiceRate: number,
  config: DogV13Config,
  isV13Level: boolean,
): number {
  if (!isV13Level) {
    return trayPeakLogicalUnitCount;
  }
  if (effectiveTrayCapacity <= 0) {
    return 1;
  }
  const occupancyRatio = clamp01(trayPeakLogicalUnitCount / effectiveTrayCapacity);
  const decisionPressure = 1 - clamp01(safeChoiceRate);
  const { occupancyWeight, choicePressureWeight } = config.difficulty.scoring.trayPressure;
  return roundMetric(occupancyRatio * occupancyWeight + decisionPressure * choicePressureWeight);
}

export function calculateOperationCost(
  level: DogLevelGeometry,
  specialMechanismDensity: number,
  logicalBlockCount: number,
  config: DogV13Config,
  simulation?: PathSimulationMetrics,
): number {
  const mechanismEntryCounts = simulation?.mechanismEntryCounts ??
    collectMechanismEntryCounts(level);
  const operationUnits = Object.entries(mechanismEntryCounts).reduce(
    (total, [type, count]) => total +
      count * (config.specialMechanisms.mechanisms.find(
        (definition) => definition.type === type,
      )?.operationCost ?? 0),
    0,
  ) + (simulation?.magneticTargetCount ?? 0) *
    config.difficulty.scoring.operationCost.magneticTargetWeight;
  const normalizedCost = logicalBlockCount === 0
    ? 0
    : operationUnits / logicalBlockCount;
  return roundMetric(clamp01(Math.max(specialMechanismDensity, normalizedCost)));
}

export function calculateMistakeRisk(
  level: DogLevelGeometry,
  safeChoiceRate: number,
  trayPeakPressure: number,
  operationCost: number,
  config: DogV13Config,
  simulation?: PathSimulationMetrics,
): number {
  const lockRisk = (level.lockedTraySlotCount ?? 0) /
    Math.max(1, config.tray.maxLockedSlotCount);
  const choiceRisk = 1 - clamp01(safeChoiceRate);
  const actualOperationRisk = simulation === undefined
    ? operationCost
    : Math.max(
        operationCost,
        simulation.magneticTargetCount / Math.max(1, simulation.selectedBlockCount),
      );
  const scoring = config.difficulty.scoring.mistakeRisk;
  return roundMetric(clamp01(
    scoring.base +
      choiceRisk * scoring.choiceWeight +
      trayPeakPressure * scoring.trayPressureWeight +
      actualOperationRisk * scoring.operationCostWeight +
      lockRisk * scoring.lockWeight,
  ));
}

function collectMechanismEntryCounts(
  level: DogLevelGeometry,
): Readonly<Record<string, number>> {
  const counts = new Map<string, number>();
  for (const block of level.blocks) {
    const type = block.specialMechanism?.type;
    if (type !== undefined) {
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }
  return Object.fromEntries(counts);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}
