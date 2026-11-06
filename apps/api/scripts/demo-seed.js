import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import mongoose from 'mongoose';
import { loadEnv } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/lib/db.js';
import { UserModel } from '../src/modules/auth/model.js';
import { registerUser } from '../src/modules/auth/service.js';
import { SessionModel, ResponseModel } from '../src/modules/sessions/model.js';
import { sessionService } from '../src/modules/sessions/service.js';
import { VirtualResident, createRng } from '@radiology/engine';

export const DEMO_RESIDENT_EMAIL = 'demo.resident@example.com';
export const DEMO_RESIDENT_DISPLAY_NAME = 'Demo Resident (synthetic)';
export const DEMO_DEFAULT_PASSWORD = 'DemoResident123!';

/**
 * Run synthetic demo seed
 *
 * @param {Object} [options]
 * @param {boolean} [options.reset] - If true, remove only demo resident and its sessions
 * @param {string} [options.env] - Environment override (e.g. for testing refusal in production)
 * @param {string} [options.password] - Password override
 * @param {boolean} [options.silent=false] - Suppress console output
 * @param {string} [options.seed='demo-synthetic-resident-2026'] - PRNG seed
 * @returns {Promise<{ user: any, sessions: any[], resetOnly?: boolean }>}
 */
export async function runDemoSeed(options = {}) {
  const env = options.env || process.env.NODE_ENV || 'development';
  const reset = options.reset ?? process.argv.includes('--reset');
  const silent = options.silent ?? false;
  const password = options.password || process.env.DEMO_PASSWORD || DEMO_DEFAULT_PASSWORD;
  const seed = options.seed || 'demo-synthetic-resident-2026';

  // 1. Refuse to run in production environment
  if (env === 'production') {
    const errorMsg = 'Error: demo:seed script refuses to run in production environment.';
    if (!silent) console.error(errorMsg);
    const err = new Error(errorMsg);
    err.code = 'PRODUCTION_REFUSED';
    throw err;
  }

  const config = options.config || loadEnv();
  const shouldDisconnect = mongoose.connection.readyState === 0;
  if (shouldDisconnect) {
    await connectDb(config.MONGODB_URI);
  }

  try {
    // 2. Handle --reset flag: deletes ONLY the demo resident and its sessions
    if (reset) {
      const demoUser = await UserModel.findOne({ email: DEMO_RESIDENT_EMAIL });
      if (demoUser) {
        await ResponseModel.deleteMany({ userId: demoUser._id });
        await SessionModel.deleteMany({ userId: demoUser._id });
        await UserModel.deleteOne({ _id: demoUser._id });
        if (!silent) {
          console.log(
            `[demo:seed] Successfully reset: removed demo resident ${DEMO_RESIDENT_EMAIL} and all associated sessions.`,
          );
        }
      } else if (!silent) {
        console.log(
          `[demo:seed] Demo resident ${DEMO_RESIDENT_EMAIL} not found. Nothing to reset.`,
        );
      }
      return { user: null, sessions: [], resetOnly: true };
    }

    // 3. Create or reuse demo resident user
    let user = await UserModel.findOne({ email: DEMO_RESIDENT_EMAIL });
    if (!user) {
      const registered = await registerUser(
        {
          email: DEMO_RESIDENT_EMAIL,
          displayName: DEMO_RESIDENT_DISPLAY_NAME,
          password,
        },
        config,
      );
      user = await UserModel.findById(registered.user.id);
      if (!silent) {
        console.log(`[demo:seed] Created demo resident user: ${user.email} (${user.displayName})`);
      }
    } else if (!silent) {
      console.log(
        `[demo:seed] Found existing demo resident user: ${user.email} (${user.displayName})`,
      );
    }

    // 4. Ensure clean active session state (cancel dangling in_progress session if any)
    const dangling = await SessionModel.findOne({ userId: user._id, status: 'in_progress' });
    if (dangling) {
      await ResponseModel.deleteMany({ sessionId: dangling._id });
      await SessionModel.deleteOne({ _id: dangling._id });
    }

    // 5. Query existing finished sessions
    let finishedSessions = await SessionModel.find({
      userId: user._id,
      status: 'finished',
    }).sort({ index: 1 });

    // 6. If less than 4 finished sessions, run existing session service functions
    if (finishedSessions.length < 4) {
      const vr = new VirtualResident({
        initialSkills: { covid19: 0.52, pneumonia: 0.58, normal: 0.68 },
        learningRate: 0.006,
        difficultyPenalty: 0.15,
        noiseStd: 0.015,
      });
      const rng = createRng(seed);

      const sessionsToCreate = 4 - finishedSessions.length;
      for (let i = 0; i < sessionsToCreate; i++) {
        // Create session via existing service
        const session = await sessionService.createSession({
          userId: user._id,
          size: 45,
          allowRepeats: true,
        });

        // Load internal session document to get trueClass and difficulty for VirtualResident
        const sessionDoc = await SessionModel.findById(session.id);

        // Submit answers via VirtualResident
        for (const q of sessionDoc.questions) {
          const answer = vr.answer(q, rng, true);
          await sessionService.answerQuestion({
            userId: user._id,
            sessionId: session.id,
            questionNo: q.no,
            answer,
          });
        }

        // Finish session via existing service
        await sessionService.finishSession({
          userId: user._id,
          sessionId: session.id,
        });
      }

      // Re-fetch all finished sessions
      finishedSessions = await SessionModel.find({
        userId: user._id,
        status: 'finished',
      }).sort({ index: 1 });
    }

    // 7. Format and print summary table
    if (!silent) {
      console.log('\n=== Demo Resident Sessions Summary ===');
      console.table(
        finishedSessions.map((s) => ({
          'Session #': s.index,
          'Overall Accuracy': `${((s.metrics?.overall?.accuracy ?? 0) * 100).toFixed(1)}%`,
          'COVID-19': `${((s.metrics?.perClass?.covid19?.accuracy ?? 0) * 100).toFixed(1)}%`,
          Pneumonia: `${((s.metrics?.perClass?.pneumonia?.accuracy ?? 0) * 100).toFixed(1)}%`,
          Normal: `${((s.metrics?.perClass?.normal?.accuracy ?? 0) * 100).toFixed(1)}%`,
          Mastered: s.metrics?.mastered ? 'Yes' : 'No',
        })),
      );
      console.log(
        `\nDemo Credentials:\n- Email:    ${DEMO_RESIDENT_EMAIL}\n- Password: ${password}\n`,
      );
    }

    return { user, sessions: finishedSessions };
  } finally {
    if (shouldDisconnect) {
      await disconnectDb();
    }
  }
}

// Standalone CLI runner
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runDemoSeed().catch((err) => {
    if (err.code !== 'PRODUCTION_REFUSED') {
      console.error('[demo:seed] Unhandled error:', err);
    }
    process.exit(1);
  });
}
