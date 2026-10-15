import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Server } from '../models/Server.js';
import { LogEvent } from '../models/LogEvent.js';
import { Checkpoint } from '../models/Checkpoint.js';
import { IntegrityRecord } from '../models/IntegrityRecord.js';
import { Alert } from '../models/Alert.js';
import { connectDB, disconnectDB } from '../config/db.js';

export async function resetDemoEnvironment() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_RESET !== 'true') {
    console.error('❌ [LogSentinel Reset] Refusing to reset in production environment without explicit ALLOW_DEMO_RESET=true.');
    process.exit(1);
  }

  console.log('🧹 [LogSentinel Reset] Initiating safe cleanup of demo fixtures...');

  try {
    await connectDB();

    const demoUsers = await User.find({
      email: { $in: ['admin@logsentinel.local', 'analyst@logsentinel.local'] },
    });

    const userIds = demoUsers.map((u) => u._id);

    // Find servers owned by demo users
    const demoServers = await Server.find({
      $or: [
        { ownerId: { $in: userIds } },
        { serverName: /^DEMO-/ },
        { serverName: /^SIM-/ },
      ],
    });

    const serverIds = demoServers.map((s) => s.serverId);

    console.log(`ℹ️ [Reset] Found ${demoServers.length} demo server(s) to purge.`);

    if (serverIds.length > 0) {
      const logsDel = await LogEvent.deleteMany({ serverId: { $in: serverIds } });
      const recsDel = await IntegrityRecord.deleteMany({ serverId: { $in: serverIds } });
      const cpsDel = await Checkpoint.deleteMany({ serverId: { $in: serverIds } });
      const alertsDel = await Alert.deleteMany({ serverId: { $in: serverIds } });
      const srvsDel = await Server.deleteMany({ serverId: { $in: serverIds } });

      console.log(`✅ [Reset] Purged: ${logsDel.deletedCount} log events, ${recsDel.deletedCount} integrity records, ${cpsDel.deletedCount} checkpoints, ${alertsDel.deletedCount} alerts, ${srvsDel.deletedCount} servers.`);
    }

    // Delete demo users
    const usersDel = await User.deleteMany({ _id: { $in: userIds } });
    console.log(`✅ [Reset] Purged ${usersDel.deletedCount} demo user account(s).`);

    console.log('🎉 [LogSentinel Reset] Demo environment cleaned cleanly.');

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('❌ [Reset Error]:', err.message);
    await disconnectDB();
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('resetDemo.js')) {
  resetDemoEnvironment();
}
