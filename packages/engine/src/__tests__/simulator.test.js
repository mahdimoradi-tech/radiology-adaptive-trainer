import { describe, it, expect } from 'vitest';
import {
  runSimulation,
  VirtualResident,
  createSimulatorPool,
  createBalancedProbeTest,
  formatSimulationSummary,
} from '../index.js';

describe('Adaptive Engine - Virtual Resident Simulator', () => {
  it('VirtualResident learns monotonically per exposure and does not update when updateSkill is false', () => {
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

    // Probe answer: skill must NOT change
    resident.answer(mockImage, mockRng, false);
    expect(resident.skills.covid19).toBe(initialCovidSkill);

    // Training answer: skill updates monotonically
    resident.answer(mockImage, mockRng, true);
    expect(resident.skills.covid19).toBeGreaterThan(initialCovidSkill);
  });

  it('createBalancedProbeTest produces 60 balanced items deterministically per seed', () => {
    const pool = createSimulatorPool();
    const probe1 = createBalancedProbeTest(pool, 42);
    const probe2 = createBalancedProbeTest(pool, 42);

    expect(probe1).toHaveLength(60);
    expect(probe1.map((i) => i.id)).toEqual(probe2.map((i) => i.id));

    // Balanced class counts (20 each)
    const covidCount = probe1.filter((i) => i.trueClass === 'covid19').length;
    const pneumoniaCount = probe1.filter((i) => i.trueClass === 'pneumonia').length;
    const normalCount = probe1.filter((i) => i.trueClass === 'normal').length;
    expect(covidCount).toBe(20);
    expect(pneumoniaCount).toBe(20);
    expect(normalCount).toBe(20);
  });

  it('runSimulation produces completely deterministic results given the same seed', () => {
    // Run with 5 residents for fast test execution
    const run1 = runSimulation({ numResidents: 5, seed: 1234, maxSessions: 6 });
    const run2 = runSimulation({ numResidents: 5, seed: 1234, maxSessions: 6 });

    expect(run1).toEqual(run2);
  });

  it('evaluates mastery on probe test for all policies without hardcoding that adaptive wins', () => {
    const sim = runSimulation({ numResidents: 10, seed: 42, maxSessions: 8 });

    expect(sim.adaptive).toBeDefined();
    expect(sim.random).toBeDefined();
    expect(sim.fixed).toBeDefined();

    // Verify all policies produce valid rates, sessions and probe metrics
    for (const p of ['adaptive', 'random', 'fixed']) {
      expect(sim[p].avgSessionsToMastery).toBeGreaterThan(0);
      expect(sim[p].masteryRate).toBeGreaterThanOrEqual(0);
      expect(sim[p].masteryRate).toBeLessThanOrEqual(1);
      expect(sim[p].avgFpr.covid19).toBeGreaterThanOrEqual(0);
      expect(sim[p].avgFnr.covid19).toBeGreaterThanOrEqual(0);
    }
  });

  it('formatSimulationSummary dynamically reflects simulation numbers without bias', () => {
    const mockResults = {
      fixed: {
        policy: 'fixed',
        masteryRate: 1.0,
        avgSessionsToMastery: 4.8,
        avgFpr: { covid19: 0.1, pneumonia: 0.1, normal: 0.1 },
        avgFnr: { covid19: 0.1, pneumonia: 0.1, normal: 0.1 },
      },
      random: {
        policy: 'random',
        masteryRate: 0.9,
        avgSessionsToMastery: 5.2,
        avgFpr: { covid19: 0.1, pneumonia: 0.1, normal: 0.1 },
        avgFnr: { covid19: 0.1, pneumonia: 0.1, normal: 0.1 },
      },
      adaptive: {
        policy: 'adaptive',
        masteryRate: 0.95,
        avgSessionsToMastery: 5.5,
        avgFpr: { covid19: 0.1, pneumonia: 0.1, normal: 0.1 },
        avgFnr: { covid19: 0.1, pneumonia: 0.1, normal: 0.1 },
      },
    };

    const summary = formatSimulationSummary(mockResults);
    expect(summary).toContain('FIXED achieved the lowest mean sessions-to-mastery (4.80 sessions');
    expect(summary).toContain('did not outperform FIXED');

    // Case when adaptive achieves lower sessions
    const mockAdaptiveWins = {
      ...mockResults,
      adaptive: { ...mockResults.adaptive, avgSessionsToMastery: 4.2 },
    };
    const summaryAdaptive = formatSimulationSummary(mockAdaptiveWins);
    expect(summaryAdaptive).toContain(
      'ADAPTIVE achieved the lowest mean sessions-to-mastery (4.20 sessions',
    );
    expect(summaryAdaptive).toContain('Adaptive training converged faster');
  });
});
