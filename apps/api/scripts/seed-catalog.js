import { parseArgs } from 'node:util';
import { loadEnv } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/lib/db.js';
import { seedCatalog } from '../src/modules/catalog/seed.js';

/**
 * CLI script to seed the image catalog into MongoDB
 */
export async function run() {
  const config = loadEnv();

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      file: { type: 'string' },
      images: { type: 'string' },
      prune: { type: 'boolean', default: false },
      'require-files': { type: 'boolean', default: false },
    },
    strict: false,
  });

  const filePath = values.file || config.catalogFilePath;
  const imagesDir = values.images || config.catalogImageDirPath;
  const prune = Boolean(values.prune);
  const requireFiles = Boolean(values['require-files']);

  console.log('=== Radiology Adaptive Trainer - Catalog Seeder ===');
  console.log(`- File path: ${filePath}`);
  console.log(`- Images directory: ${imagesDir}`);
  console.log(`- Prune missing: ${prune}`);
  console.log(`- Require image files: ${requireFiles}\n`);

  try {
    console.log('Connecting to database...');
    await connectDb(config.MONGODB_URI);

    const result = await seedCatalog({
      filePath,
      imagesDir,
      prune,
      requireFiles,
      salt: config.PUBLIC_ID_SALT,
    });

    console.log('\n--- Seeding Summary ---');
    console.log(`Total catalog entries: ${result.total}`);
    console.log(`Upserted new: ${result.upsertedCount}`);
    console.log(`Matched existing: ${result.matchedCount}`);
    console.log(`Modified: ${result.modifiedCount}`);
    console.log(`Pruned / Deleted: ${result.deletedCount}`);
    console.log(`Missing image files on disk: ${result.missingFilesCount}\n`);

    console.log('--- Class x Bucket Distribution ---');
    console.table(result.stats.byClassBucket);

    console.log('\n--- Source Distribution ---');
    console.table(result.stats.bySource);

    if (result.warnings.length > 0) {
      console.log('\n⚠️  Pool Health Warnings:');
      for (const warning of result.warnings) {
        console.warn(`  - ${warning}`);
      }
    } else {
      console.log('\n✅ All pool buckets have sufficient image capacity (>= 6 per bucket).');
    }

    console.log('\nCatalog seeding completed successfully.');
  } catch (err) {
    console.error('\n❌ Seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    await disconnectDb();
  }
}

// Execute if run directly from CLI
if (process.argv[1] === new URL(import.meta.url).pathname) {
  run();
}
