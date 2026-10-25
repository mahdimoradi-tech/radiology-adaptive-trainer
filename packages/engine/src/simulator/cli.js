#!/usr/bin/env node

import { runSimulation } from './runner.js';
import { formatSimulationSummary } from './summary.js';

console.log('Running Virtual Resident Simulation (50 seeded residents per policy)...\n');
const results = runSimulation({ numResidents: 50, seed: 42 });

console.log('='.repeat(80));
console.log(' VIRTUAL RESIDENT SIMULATION RESULTS (T02 — Fair Probe Comparison)');
console.log('='.repeat(80));

const tableData = Object.values(results).map((r) => ({
  Policy: r.policy.toUpperCase(),
  'Mastery Rate': `${(r.masteryRate * 100).toFixed(1)}%`,
  'Avg Sessions': r.avgSessionsToMastery.toFixed(2),
  'FPR (Covid)': r.avgFpr.covid19.toFixed(3),
  'FNR (Covid)': r.avgFnr.covid19.toFixed(3),
  'FPR (Pneu)': r.avgFpr.pneumonia.toFixed(3),
  'FNR (Pneu)': r.avgFnr.pneumonia.toFixed(3),
}));

console.table(tableData);
console.log('='.repeat(80));
console.log(formatSimulationSummary(results));
console.log('='.repeat(80) + '\n');
