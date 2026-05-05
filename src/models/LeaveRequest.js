const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
  {
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Applicant is required'],
    },
    applicantRole: {
      type: String,
      enum: ['teacher', 'student'],
      required: [true, 'Applicant role is required'],
    },
    // For student leaves: the class they belong to
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      default: null,
    },
    leaveType: {
      type: String,
      enum: ['sick', 'personal', 'family', 'medical', 'other'],
      required: [true, 'Leave type is required'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      trim: true,
      minlength: [10, 'Reason must be at least 10 characters'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    // Who approved/rejected the request
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewRemark: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

// Virtual: number of days
leaveRequestSchema.virtual('totalDays').get(function () {
  const diff = this.endDate - this.startDate;
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
});

// Ensure virtuals are included in JSON
leaveRequestSchema.set('toJSON', { virtuals: true });
leaveRequestSchema.set('toObject', { virtuals: true });

// Index for efficient queries
leaveRequestSchema.index({ applicant: 1, status: 1 });
leaveRequestSchema.index({ status: 1, applicantRole: 1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
