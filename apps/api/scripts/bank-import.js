import { loadEnv } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/lib/db.js';
import { importBankApproved } from '../src/modules/bank/portable.js';

export async function run() {
  const config = loadEnv();
  await connectDb(config.MONGODB_URI);

  try {
    const result = await importBankApproved();
    console.log(
      `[bank:import] Read: ${result.totalRead}, Imported: ${result.imported}, Skipped: ${result.skipped}`,
    );
  } finally {
    await disconnectDb();
  }
}

if (process.argv[1]?.endsWith('bank-import.js')) {
  run().catch((err) => {
    console.error('Fatal error in bank:import:', err);
    process.exit(1);
  });
}
