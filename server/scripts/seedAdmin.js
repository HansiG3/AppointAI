import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import { USER_ROLES } from '../src/config/constants.js';
import config from '../src/config/env.js';

dotenv.config();

/**
 * Seed first admin user
 * Usage: node scripts/seedAdmin.js <name> <email> <phone> <password>
 */
async function seedAdmin() {
  try {
    // Parse command line arguments
    const [name, email, phone, password] = process.argv.slice(2);

    if (!name || !email || !phone || !password) {
      console.error('Usage: node scripts/seedAdmin.js <name> <email> <phone> <password>');
      console.error('Example: node scripts/seedAdmin.js "Admin User" admin@appointai.com "+919876543210" "Admin@123"');
      process.exit(1);
    }

    // Connect to database
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.db.uri);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      console.error(`Error: User with email ${email} already exists`);
      process.exit(1);
    }

    // Create admin user
    const admin = await User.create({
      name,
      email,
      phone,
      passwordHash: password, // Will be hashed by pre-save hook
      role: USER_ROLES.ADMIN,
    });

    console.log('\n✓ Admin user created successfully:');
    console.log(`  Name: ${admin.name}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role: ${admin.role}`);
    console.log(`  ID: ${admin._id}`);
    console.log('\nYou can now log in with these credentials.\n');

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error.message);
    process.exit(1);
  }
}

seedAdmin();
