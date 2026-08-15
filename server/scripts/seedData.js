import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Specialization from '../src/models/Specialization.js';
import Doctor from '../src/models/Doctor.js';
import Slot from '../src/models/Slot.js';
import config from '../src/config/env.js';
import { getTodayDate, addDays } from '../src/utils/dateTime.js';

dotenv.config();

/**
 * Seed script for initial database setup
 * Creates specializations, doctors, and available slots for testing
 */

const specializations = [
  {
    name: 'Dermatology',
    slug: 'dermatology',
    aliases: ['skin doctor', 'skin specialist', 'dermatologist'],
    description: 'Diagnosis and treatment of skin, hair, and nail conditions',
  },
  {
    name: 'Cardiology',
    slug: 'cardiology',
    aliases: ['heart doctor', 'cardiologist', 'heart specialist'],
    description: 'Heart and cardiovascular system care',
  },
  {
    name: 'Neurology',
    slug: 'neurology',
    aliases: ['neurologist', 'brain doctor', 'nerve specialist'],
    description: 'Brain, spinal cord, and nervous system treatment',
  },
  {
    name: 'Orthopedics',
    slug: 'orthopedics',
    aliases: ['orthopedic', 'bone doctor', 'orthopedist', 'ortho'],
    description: 'Bone, joint, and musculoskeletal care',
  },
  {
    name: 'Pediatrics',
    slug: 'pediatrics',
    aliases: ['pediatrician', 'child doctor', 'kids doctor'],
    description: 'Medical care for infants, children, and adolescents',
  },
];

const doctors = [
  { name: 'Dr. Meera Shah', specialization: 'dermatology', experience: 12, qualification: ['MBBS', 'MD Dermatology'], location: 'Central Clinic' },
  { name: 'Dr. Arjun Rao', specialization: 'dermatology', experience: 8, qualification: ['MBBS', 'MD'], location: 'North Clinic' },
  { name: 'Dr. Vikram Sen', specialization: 'cardiology', experience: 15, qualification: ['MBBS', 'DM Cardiology'], location: 'Central Clinic' },
  { name: 'Dr. Nisha Kapoor', specialization: 'cardiology', experience: 10, qualification: ['MBBS', 'MD', 'DM'], location: 'South Clinic' },
  { name: 'Dr. Asha Menon', specialization: 'neurology', experience: 14, qualification: ['MBBS', 'DM Neurology'], location: 'East Clinic' },
  { name: 'Dr. Rohan Das', specialization: 'neurology', experience: 9, qualification: ['MBBS', 'MD Neurology'], location: 'Central Clinic' },
  { name: 'Dr. Priya Kumar', specialization: 'orthopedics', experience: 11, qualification: ['MBBS', 'MS Orthopedics'], location: 'North Clinic' },
  { name: 'Dr. Anil Verma', specialization: 'pediatrics', experience: 13, qualification: ['MBBS', 'MD Pediatrics'], location: 'South Clinic' },
];

/**
 * Generate slots for a doctor across multiple days
 */
const generateSlotsForDoctor = (doctorId, startDate, numDays) => {
  const slots = [];
  const timeSlots = [
    { start: '09:00', end: '09:30' },
    { start: '09:30', end: '10:00' },
    { start: '10:00', end: '10:30' },
    { start: '10:30', end: '11:00' },
    { start: '11:00', end: '11:30' },
    { start: '11:30', end: '12:00' },
    { start: '14:00', end: '14:30' },
    { start: '14:30', end: '15:00' },
    { start: '15:00', end: '15:30' },
    { start: '15:30', end: '16:00' },
    { start: '16:00', end: '16:30' },
    { start: '16:30', end: '17:00' },
    { start: '17:00', end: '17:30' },
    { start: '17:30', end: '18:00' },
    { start: '18:00', end: '18:30' },
  ];

  for (let day = 0; day < numDays; day++) {
    const date = addDays(startDate, day);

    // Skip Sundays (day 0)
    const dayOfWeek = new Date(date).getDay();
    if (dayOfWeek === 0) continue;

    for (const slot of timeSlots) {
      slots.push({
        doctor: doctorId,
        date,
        startTime: slot.start,
        endTime: slot.end,
        status: 'AVAILABLE',
      });
    }
  }

  return slots;
};

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.db.uri);
    console.log('Connected to MongoDB\n');

    // Clear existing data (only in dev)
    if (config.nodeEnv === 'development') {
      console.log('Clearing existing data...');
      await Slot.deleteMany({});
      await Doctor.deleteMany({});
      await Specialization.deleteMany({});
      console.log('✓ Cleared existing data\n');
    }

    // Step 1: Create Specializations
    console.log('Creating specializations...');
    const createdSpecializations = await Specialization.insertMany(specializations);
    console.log(`✓ Created ${createdSpecializations.length} specializations\n`);

    // Map slug → ObjectId for doctor references
    const specializationMap = {};
    createdSpecializations.forEach((spec) => {
      specializationMap[spec.slug] = spec._id;
    });

    // Step 2: Create Doctors
    console.log('Creating doctors...');
    const doctorsWithIds = doctors.map((doc) => ({
      ...doc,
      specialization: specializationMap[doc.specialization],
    }));
    const createdDoctors = await Doctor.insertMany(doctorsWithIds);
    console.log(`✓ Created ${createdDoctors.length} doctors\n`);

    // Step 3: Generate Slots (next 14 days)
    console.log('Generating slots for the next 14 days...');
    const today = getTodayDate();
    const allSlots = [];

    for (const doctor of createdDoctors) {
      const slots = generateSlotsForDoctor(doctor._id, today, 14);
      allSlots.push(...slots);
    }

    const createdSlots = await Slot.insertMany(allSlots);
    console.log(`✓ Created ${createdSlots.length} slots\n`);

    // Summary
    console.log('═══════════════════════════════════════════════');
    console.log('SEED DATA SUMMARY');
    console.log('═══════════════════════════════════════════════');
    console.log(`Specializations: ${createdSpecializations.length}`);
    createdSpecializations.forEach((s) => {
      console.log(`  • ${s.name} (${s.aliases.length} aliases)`);
    });
    console.log(`\nDoctors: ${createdDoctors.length}`);
    createdDoctors.forEach((d) => {
      const spec = createdSpecializations.find((s) => s._id.equals(d.specialization));
      console.log(`  • ${d.name} - ${spec.name} (${d.location})`);
    });
    console.log(`\nSlots: ${createdSlots.length} (across 14 days, excluding Sundays)`);
    console.log(`  Date range: ${today} to ${addDays(today, 13)}`);
    console.log('  Time slots: 09:00-12:00, 14:00-18:30 (30-min intervals)');
    console.log('═══════════════════════════════════════════════\n');

    console.log('✅ Database seeded successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
