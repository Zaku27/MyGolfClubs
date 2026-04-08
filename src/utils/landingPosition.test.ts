import { describe, expect, it } from 'vitest';
import { applyGroundCondition, normalizeGroundSlope, type ClubData, type LandingResult, type SkillLevel } from './landingPosition';
import type { GroundCondition } from '../types/game';

const BASE_LANDING: LandingResult = {
  carry: 100,
  roll: 20,
  totalDistance: 120,
  lateralDeviation: 0,
  finalX: 0,
  finalY: 120,
};

const BASE_CLUB: ClubData = {
  clubType: 'Iron',
  name: 'Test Iron',
  number: '7',
  length: 37,
  weight: 430,
  swingWeight: 2,
  lieAngle: 62,
  loftAngle: 34,
  shaftType: 'Steel',
  torque: 2.0,
  flex: 'S',
  distance: 150,
  notes: '',
};

const BASE_SKILL: SkillLevel = {
  dispersion: 0.5,
  mishitRate: 0.2,
  sideSpinDispersion: 0.5,
  hazardRecoveryFactor: 0.5,
};

describe('normalizeGroundSlope', () => {
  it('converts negative slope angle to positive and flips direction by 180 degrees', () => {
    const normalized = normalizeGroundSlope({
      hardness: 'medium',
      slopeAngle: -12,
      slopeDirection: 90,
    });

    expect(normalized.slopeAngle).toBe(12);
    expect(normalized.slopeDirection).toBe(270);
  });
});

describe('applyGroundCondition side slope behavior with fixed seed', () => {
  const buildGround = (direction: number): GroundCondition => ({
    hardness: 'medium',
    slopeAngle: 20,
    slopeDirection: direction,
  });

  it('produces opposite X shifts for left uphill (270) vs right uphill (90)', () => {
    // Run 5 times with consistent landing to observe average shift direction
    const leftShifts: number[] = [];
    const rightShifts: number[] = [];

    for (let i = 0; i < 5; i++) {
      const baseLanding: LandingResult = {
        carry: 100 + i * 2,
        roll: 20,
        totalDistance: 120 + i * 2,
        lateralDeviation: 0,
        finalX: 0,
        finalY: 120 + i * 2,
      };

      const leftResult = applyGroundCondition(baseLanding, buildGround(270), BASE_CLUB, BASE_SKILL);
      const rightResult = applyGroundCondition(baseLanding, buildGround(90), BASE_CLUB, BASE_SKILL);

      leftShifts.push(leftResult.finalX);
      rightShifts.push(rightResult.finalX);
    }

    const leftMean = leftShifts.reduce((a, b) => a + b, 0) / leftShifts.length;
    const rightMean = rightShifts.reduce((a, b) => a + b, 0) / rightShifts.length;

    // Expect opposite signs
    expect(Math.sign(leftMean)).not.toBe(Math.sign(rightMean));
  });
});
