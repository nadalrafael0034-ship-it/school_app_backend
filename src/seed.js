/**
 * Database Seeder — creates demo data for all roles
 * Run: npm run seed
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');
const Class = require('./models/Class');
const Subject = require('./models/Subject');

const seed = async () => {
  await connectDB();

  // Clear existing data
  await User.deleteMany({});
  await Class.deleteMany({});
  await Subject.deleteMany({});

  console.log('🗑️  Cleared existing data');

  // Create subjects
  const subjects = await Subject.insertMany([
    { name: 'Mathematics', code: 'MATH101' },
    { name: 'Science', code: 'SCI101' },
    { name: 'English', code: 'ENG101' },
    { name: 'Social Studies', code: 'SS101' },
    { name: 'Computer Science', code: 'CS101' },
  ]);

  console.log('✅ Created subjects');

  // Create admin
  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@school.com',
    password: 'admin123',
    role: 'admin',
  });

  // Create teachers
  const teacher1 = await User.create({
    name: 'Mr. John Smith',
    email: 'john.smith@school.com',
    password: 'teacher123',
    role: 'teacher',
    employeeId: 'EMP001',
    subjects: [subjects[0]._id, subjects[4]._id],
    phone: '9876543210',
  });

  const teacher2 = await User.create({
    name: 'Ms. Sarah Johnson',
    email: 'sarah.j@school.com',
    password: 'teacher123',
    role: 'teacher',
    employeeId: 'EMP002',
    subjects: [subjects[1]._id, subjects[2]._id],
    phone: '9876543211',
  });

  console.log('✅ Created teachers');

  // Create classes
  const class10A = await Class.create({
    name: 'Rose',
    section: 'A',
    grade: '10',
    teachers: [teacher1._id, teacher2._id],
    subjects: subjects.map((s) => s._id),
  });

  const class9B = await Class.create({
    name: 'Lotus',
    section: 'B',
    grade: '9',
    teachers: [teacher1._id],
    subjects: [subjects[0]._id, subjects[1]._id, subjects[4]._id],
  });

  console.log('✅ Created classes');

  // Create students
  const studentData = [
    { name: 'Alice Williams', rollNumber: 'S001', email: 'alice@school.com' },
    { name: 'Bob Martinez', rollNumber: 'S002', email: 'bob@school.com' },
    { name: 'Charlie Brown', rollNumber: 'S003', email: 'charlie@school.com' },
    { name: 'Diana Prince', rollNumber: 'S004', email: 'diana@school.com' },
    { name: 'Ethan Hunt', rollNumber: 'S005', email: 'ethan@school.com' },
  ];

  for (const data of studentData) {
    await User.create({
      ...data,
      password: 'student123',
      role: 'student',
      class: class10A._id,
    });
  }

  const student9Data = [
    { name: 'Frank Castle', rollNumber: 'S006', email: 'frank@school.com' },
    { name: 'Grace Kelly', rollNumber: 'S007', email: 'grace@school.com' },
    { name: 'Harry Potter', rollNumber: 'S008', email: 'harry@school.com' },
  ];

  for (const data of student9Data) {
    await User.create({
      ...data,
      password: 'student123',
      role: 'student',
      class: class9B._id,
    });
  }

  console.log('✅ Created students');

  console.log('\n🎉 Database seeded successfully!\n');
  console.log('─────────────────────────────────');
  console.log('Login credentials:');
  console.log('  Admin    → admin@school.com       / admin123');
  console.log('  Teacher1 → john.smith@school.com  / teacher123');
  console.log('  Teacher2 → sarah.j@school.com     / teacher123');
  console.log('  Student  → alice@school.com        / student123');
  console.log('─────────────────────────────────\n');

  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
