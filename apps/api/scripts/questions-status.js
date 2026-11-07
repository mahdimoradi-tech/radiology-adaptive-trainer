import { loadEnv } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/lib/db.js';
import { QuestionBankModel, QuestionGenAttemptModel } from '../src/modules/bank/model.js';
import { LlmUsage, getPacificDay } from '../src/modules/llm/budget.js';

export async function run() {
  const config = loadEnv();
  await connectDb(config.MONGODB_URI);

  try {
    const totalQuestions = await QuestionBankModel.countDocuments();
    const pendingCount = await QuestionBankModel.countDocuments({ status: 'pending_review' });
    const approvedCount = await QuestionBankModel.countDocuments({ status: 'approved' });
    const rejectedCount = await QuestionBankModel.countDocuments({ status: 'rejected' });

    const findingCount = await QuestionBankModel.countDocuments({ type: 'finding' });
    const distCount = await QuestionBankModel.countDocuments({ type: 'distribution' });
    const diffCount = await QuestionBankModel.countDocuments({ type: 'differential' });

    // Counts by pair
    const pairAggregation = await QuestionBankModel.aggregate([
      {
        $group: {
          _id: { $concat: ['$pair.trueClass', ':', '$pair.confusedWith'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Rejection attempts
    const totalAttempts = await QuestionGenAttemptModel.countDocuments();
    const reasonAggregation = await QuestionGenAttemptModel.aggregate([
      { $unwind: '$reasons' },
      { $group: { _id: '$reasons', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Budget
    const today = getPacificDay();
    const usageDoc = await LlmUsage.findOne({ day: today }).lean();
    const used = usageDoc?.count || 0;
    const exhausted = usageDoc?.exhausted || false;
    const budget = config.LLM_DAILY_REQUEST_BUDGET || 16;

    console.log('====================================================');
    console.log('       Radiology Trainer - Question Bank Status     ');
    console.log('====================================================');
    console.log('\n--- Question Bank Summary ---');
    console.log(`Total questions:   ${totalQuestions}`);
    const approvalRateStr =
      totalQuestions > 0 ? `${((approvedCount / totalQuestions) * 100).toFixed(1)}%` : 'N/A';
    const rejectionRateStr =
      totalQuestions > 0 ? `${((rejectedCount / totalQuestions) * 100).toFixed(1)}%` : 'N/A';
    console.log(`  - Pending:       ${pendingCount}`);
    console.log(`  - Approved:      ${approvedCount} (${approvalRateStr})`);
    console.log(`  - Rejected:      ${rejectedCount} (${rejectionRateStr})`);

    console.log('\n--- Types Breakdown ---');
    console.log(`  - Finding:       ${findingCount}`);
    console.log(`  - Distribution:  ${distCount}`);
    console.log(`  - Differential:  ${diffCount}`);

    console.log('\n--- Pairs Breakdown ---');
    if (pairAggregation.length === 0) {
      console.log('  None.');
    } else {
      for (const p of pairAggregation) {
        console.log(`  - ${p._id}: ${p.count}`);
      }
    }

    console.log('\n--- Generation Rejections (T10 Evaluation) ---');
    console.log(`Total rejected attempts: ${totalAttempts}`);
    if (reasonAggregation.length > 0) {
      for (const r of reasonAggregation) {
        console.log(`  - ${r._id}: ${r.count}`);
      }
    }

    console.log('\n--- Gemini Pacific Daily Budget ---');
    console.log(`Day:       ${today} (Pacific)`);
    console.log(`Used:      ${used} / ${budget}`);
    console.log(`Remaining: ${Math.max(0, budget - used)}`);
    console.log(`Exhausted: ${exhausted}`);
    console.log('====================================================\n');
  } finally {
    await disconnectDb();
  }
}

if (process.argv[1]?.endsWith('questions-status.js')) {
  run().catch((err) => {
    console.error('Fatal error in questions:status:', err);
    process.exit(1);
  });
}
