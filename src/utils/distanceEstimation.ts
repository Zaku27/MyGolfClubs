import type { SimClub } from "../types/game";
import type { GolfClub } from "../types/golf";
import { getEstimatedDistance } from "./analysisUtils";

export type DistanceModelInputClub = {
  clubType: GolfClub["clubType"] | SimClub["type"];
  name?: string;
  number?: string;
  length?: number;
  weight?: number;
  swingWeight?: string;
  lieAngle?: number;
  loftAngle?: number;
  shaftType?: string;
  torque?: number;
  flex?: GolfClub["flex"];
  distance?: number;
  notes?: string;
};

export function toDistanceModelGolfClub(club: DistanceModelInputClub): GolfClub {
  return {
    id: 0,
    clubType: club.clubType as GolfClub["clubType"],
    name: club.name ?? "",
    number: club.number ?? "",
    length: club.length ?? 0,
    weight: club.weight ?? 0,
    swingWeight: club.swingWeight ?? "",
    lieAngle: club.lieAngle ?? 0,
    loftAngle: club.loftAngle ?? 0,
    shaftType: club.shaftType ?? "",
    torque: club.torque ?? 0,
    flex: club.flex ?? "S",
    distance: club.distance ?? 0,
    notes: club.notes ?? "",
  };
}

export function estimateTheoreticalDistance(
  club: DistanceModelInputClub,
  headSpeed: number,
): number {
  const golfClub = toDistanceModelGolfClub(club);
  return getEstimatedDistance(golfClub, headSpeed);
}
