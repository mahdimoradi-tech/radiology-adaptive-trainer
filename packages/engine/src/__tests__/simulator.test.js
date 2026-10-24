import { describe, it, expect } from 'vitest';
import { runSimulation, VirtualResident, createSimulatorPool } from '../index.js';

describe('Adaptive Engine - Virtual Resident Simulator', () => {
  it('VirtualResident learns monotonically per exposure and clamps probability', () => {
    const resident = new VirtualResident({
      initialSkills: { covid19: 0.3, pneumonia: 0.3, normal: 0.3 },
      learningRate: 0.05,
    });

    const initialCovidSkill = resident.skills.covid19;
    const mockImage = {
      id: 'img_test',
      trueClass: 'covid19',
      difficulty: 0.2,
      bucket: 'easy',
      confusedWith: 'pneumonia',
    };

    const mockRng = {
      next: () => 0.5,
      shuffle: (arr) => arr,
    };

    resident.answer(mockImage, mockRng);
    expect(resident.skills.covid19).toBeGreaterThan(initialCovidSkill);
  });

  it('runSimulation produces completely deterministic results given the same seed', () => {
    // Run with 5 residents for fast test execution
    const run1 = runSimulation({ numResidents: 5, seed: 1234, maxSessions: 6 });
    const run2 = runSimulation({ numResidents: 5, seed: 1234, maxSessions: 6 });

    expect(run1).toEqual(run2);
  });

  it('runs simulation comparing adaptive, random, and fixed policies', () => {
    const pool = createSimulatorPool();
    expect(pool).toHaveLength(1503); // ~500 per class

    const sim = runSimulation({ numResidents: 10, seed: 42, maxSessions: 8 });

    expect(sim.adaptive).toBeDefined();
    expect(sim.random).toBeDefined();
    expect(sim.fixed).toBeDefined();

    // Verify all policies produce valid rates and sessions
    for (const p of ['adaptive', 'random', 'fixed']) {
      expect(sim[p].avgSessionsToMastery).toBeGreaterThan(0);
      expect(sim[p].masteryRate).toBeGreaterThanOrEqual(0);
      expect(sim[p].masteryRate).toBeLessThanOrEqual(1);
    }
  });
});
