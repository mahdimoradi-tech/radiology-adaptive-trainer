import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { loadEnv } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/lib/db.js';
import { createOrPromoteInstructor } from '../src/modules/auth/service.js';
import { EmailSchema, PasswordSchema } from '@radiology/contracts';

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null;
}

/**
 * CLI script to create or promote an instructor account
 */
export async function run() {
  const config = loadEnv();
  let rl = null;
  const getRl = () => {
    if (!rl) rl = readline.createInterface({ input, output });
    return rl;
  };

  try {
    console.log('=== Radiology Adaptive Trainer - Create / Promote Instructor ===\n');

    const useDefaults = process.argv.includes('--defaults');

    let email = getArg('--email') || (useDefaults ? 'instructor@hospital.test' : '');
    while (!email) {
      const rawEmail = await getRl().question('Enter instructor email: ');
      const parsed = EmailSchema.safeParse(rawEmail);
      if (parsed.success) {
        email = parsed.data;
      } else {
        console.error('Invalid email format. Please try again.');
      }
    }

    let displayName = getArg('--displayName') || (useDefaults ? 'Dr. Instructor' : '');
    while (!displayName) {
      const rawName = (await getRl().question('Enter instructor display name: ')).trim();
      if (rawName.length >= 2 && rawName.length <= 60) {
        displayName = rawName;
      } else {
        console.error('Display name must be between 2 and 60 characters.');
      }
    }

    let password = getArg('--password') || (useDefaults ? 'InstructorPassword123!' : '');
    while (!password) {
      const rawPassword = await getRl().question('Enter instructor password (8-72 bytes): ');
      const parsed = PasswordSchema.safeParse(rawPassword);
      if (parsed.success) {
        password = rawPassword;
      } else {
        console.error('Password must be between 8 and 72 bytes. Please try again.');
      }
    }

    console.log('\nConnecting to database...');
    await connectDb(config.MONGODB_URI);

    const instructor = await createOrPromoteInstructor({ email, displayName, password }, config);

    console.log('\nInstructor account successfully configured:');
    console.log(`- Email: ${instructor.email}`);
    console.log(`- Role: ${instructor.role}`);
    console.log(`- Display Name: ${instructor.displayName}`);
  } catch (err) {
    console.error('\nError configuring instructor:', err.message);
    process.exitCode = 1;
  } finally {
    if (rl) rl.close();
    await disconnectDb();
  }
}

// Execute if run directly from CLI
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
