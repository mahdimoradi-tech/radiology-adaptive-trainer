import { loadEnv } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/lib/db.js';
import { exportBankApproved } from '../src/modules/bank/portable.js';

export async function run() {
  const config = loadEnv();
  await connectDb(config.MONGODB_URI);

  try {
    const result = await exportBankApproved();
    console.log(`[bank:export] Exported ${result.count} approved questions to ${result.path}`);
  } finally {
    await disconnectDb();
  }
}

if (process.argv[1]?.endsWith('bank-export.js')) {
  run().catch((err) => {
    console.error('Fatal error in bank:export:', err);
    process.exit(1);
  });
}
