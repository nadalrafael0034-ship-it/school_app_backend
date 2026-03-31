const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Class name is required'],
      trim: true,
    },
    section: {
      type: String,
      required: [true, 'Section is required'],
      trim: true,
      uppercase: true,
    },
    grade: {
      type: String,
      required: [true, 'Grade is required'],
    },
    teachers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    subjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
      },
    ],
    academicYear: {
      type: String,
      default: () => {
        const year = new Date().getFullYear();
        return `${year}-${year + 1}`;
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Virtual: full class name
classSchema.virtual('fullName').get(function () {
  return `${this.grade} - ${this.name} (${this.section})`;
});

module.exports = mongoose.model('Class', classSchema);
