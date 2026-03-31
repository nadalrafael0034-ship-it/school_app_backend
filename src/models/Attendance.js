const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late'],
    required: true,
    default: 'absent',
  },
  remark: {
    type: String,
    trim: true,
  },
});

const attendanceSchema = new mongoose.Schema(
  {
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class is required'],
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher is required'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    records: [attendanceRecordSchema],
    isFinalized: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound index: one attendance per class/subject/date
attendanceSchema.index(
  { class: 1, subject: 1, date: 1 },
  { unique: true }
);

// Virtual: attendance summary
attendanceSchema.virtual('summary').get(function () {
  const total = this.records.length;
  const present = this.records.filter((r) => r.status === 'present').length;
  const absent = this.records.filter((r) => r.status === 'absent').length;
  const late = this.records.filter((r) => r.status === 'late').length;
  return { total, present, absent, late };
});

module.exports = mongoose.model('Attendance', attendanceSchema);
