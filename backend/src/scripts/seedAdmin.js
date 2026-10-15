import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';

async function seedAdmin() {
  const args = process.argv.slice(2);
  const email = (args[0] || process.env.ADMIN_EMAIL || 'admin@logsentinel.local').trim().toLowerCase();
  const password = args[1] || process.env.ADMIN_PASSWORD || 'LogSentinel@Admin2026';
  const name = args[2] || process.env.ADMIN_NAME || 'Security Administrator';

  if (!email || !password || password.length < 8) {
    console.error('Usage: node src/scripts/seedAdmin.js <email> <password> [name]');
    console.error('Password must be at least 8 characters long.');
    process.exit(1);
  }

  console.log(`[LogSentinel Provisioning] Preparing to provision Admin account for: ${email}`);

  if (!env.MONGODB_URI) {
    console.error('[LogSentinel Provisioning] MONGODB_URI is not set. Cannot provision Admin without active database.');
    process.exit(1);
  }

  try {
    await connectDB();

    const existing = await User.findOne({ email });
    const passwordHash = await bcrypt.hash(password, 12);
    if (existing) {
      existing.role = 'Admin';
      existing.passwordHash = passwordHash;
      await existing.save();
      console.log(`[LogSentinel Provisioning] Existing account ${email} updated with Admin role and refreshed password.`);
    } else {
      const passwordHash = await bcrypt.hash(password, 12);
      const adminUser = await User.create({
        name,
        email,
        passwordHash,
        role: 'Admin',
      });
      console.log(`[LogSentinel Provisioning] Admin account created successfully! User ID: ${adminUser._id}`);
    }

    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error('[LogSentinel Provisioning] Error provisioning admin:', error.message);
    await disconnectDB();
    process.exit(1);
  }
}

seedAdmin();
