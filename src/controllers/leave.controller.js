const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const Class = require('../models/Class');

// ─── CREATE LEAVE REQUEST ────────────────────────────────────────
// @desc  Student or Teacher applies for leave
// @route POST /api/leave
// @access Private (student, teacher)
const applyLeave = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide leaveType, startDate, endDate, and reason.',
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return res.status(400).json({
        success: false,
        message: 'End date cannot be before start date.',
      });
    }

    const leaveData = {
      applicant: req.user._id,
      applicantRole: req.user.role,
      leaveType,
      startDate: start,
      endDate: end,
      reason,
    };

    // If student, attach their class
    if (req.user.role === 'student' && req.user.class) {
      leaveData.class = req.user.class;
    }

    const leave = await LeaveRequest.create(leaveData);

    const populated = await LeaveRequest.findById(leave._id)
      .populate('applicant', 'name email role rollNumber employeeId')
      .populate('class', 'name section grade');

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully.',
      leave: populated,
    });
  } catch (error) {
    console.error('Apply leave error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET MY LEAVE REQUESTS ───────────────────────────────────────
// @desc  Get all leave requests of the logged-in user
// @route GET /api/leave/my
// @access Private (student, teacher)
const getMyLeaves = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { applicant: req.user._id };
    if (status) filter.status = status;

    const leaves = await LeaveRequest.find(filter)
      .populate('applicant', 'name email role rollNumber employeeId')
      .populate('class', 'name section grade')
      .populate('reviewedBy', 'name role')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, leaves });
  } catch (error) {
    console.error('Get my leaves error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET PENDING REQUESTS (FOR TEACHER — student leaves) ─────────
// @desc  Teacher sees pending leave requests from students of their class
// @route GET /api/leave/class-requests
// @access Private (teacher)
const getClassLeaveRequests = async (req, res) => {
  try {
    const { status } = req.query;

    // Find classes where this teacher is the class teacher
    const classes = await Class.find({ classTeacher: req.user._id });
    const classIds = classes.map((c) => c._id);

    if (classIds.length === 0) {
      return res.status(200).json({ success: true, leaves: [] });
    }

    const filter = {
      class: { $in: classIds },
      applicantRole: 'student',
    };
    if (status) filter.status = status;

    const leaves = await LeaveRequest.find(filter)
      .populate('applicant', 'name email role rollNumber')
      .populate('class', 'name section grade')
      .populate('reviewedBy', 'name role')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, leaves });
  } catch (error) {
    console.error('Get class leave requests error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET ALL LEAVE REQUESTS (ADMIN) ──────────────────────────────
// @desc  Admin sees all leave requests (or filter by role/status)
// @route GET /api/leave/all
// @access Private (admin)
const getAllLeaveRequests = async (req, res) => {
  try {
    const { status, role } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (role) filter.applicantRole = role;

    const leaves = await LeaveRequest.find(filter)
      .populate('applicant', 'name email role rollNumber employeeId')
      .populate('class', 'name section grade')
      .populate('reviewedBy', 'name role')
      .sort({ createdAt: -1 });

    // Stats
    const totalPending = await LeaveRequest.countDocuments({ status: 'pending' });
    const totalApproved = await LeaveRequest.countDocuments({ status: 'approved' });
    const totalRejected = await LeaveRequest.countDocuments({ status: 'rejected' });

    res.status(200).json({
      success: true,
      leaves,
      stats: {
        total: leaves.length,
        pending: totalPending,
        approved: totalApproved,
        rejected: totalRejected,
      },
    });
  } catch (error) {
    console.error('Get all leaves error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── REVIEW LEAVE REQUEST ────────────────────────────────────────
// @desc  Approve or reject a leave request
// @route PUT /api/leave/:id/review
// @access Private (admin, teacher)
const reviewLeave = async (req, res) => {
  try {
    const { status, remark } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be "approved" or "rejected".',
      });
    }

    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found.',
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Leave request is already ${leave.status}.`,
      });
    }

    // Teachers can only review student leaves from their own class
    if (req.user.role === 'teacher') {
      if (leave.applicantRole !== 'student') {
        return res.status(403).json({
          success: false,
          message: 'Teachers can only review student leave requests.',
        });
      }
      // Verify teacher is class teacher of this class
      const cls = await Class.findOne({
        _id: leave.class,
        classTeacher: req.user._id,
      });
      if (!cls) {
        return res.status(403).json({
          success: false,
          message: 'You can only review leaves from your own class students.',
        });
      }
    }

    leave.status = status;
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    leave.reviewRemark = remark || '';
    await leave.save();

    const updated = await LeaveRequest.findById(leave._id)
      .populate('applicant', 'name email role rollNumber employeeId')
      .populate('class', 'name section grade')
      .populate('reviewedBy', 'name role');

    res.status(200).json({
      success: true,
      message: `Leave request ${status} successfully.`,
      leave: updated,
    });
  } catch (error) {
    console.error('Review leave error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── DELETE / CANCEL LEAVE REQUEST ───────────────────────────────
// @desc  Cancel own pending leave request
// @route DELETE /api/leave/:id
// @access Private (student, teacher)
const cancelLeave = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found.',
      });
    }

    // Only the applicant can cancel, and only if still pending
    if (leave.applicant.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own leave requests.',
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a leave that is already ${leave.status}.`,
      });
    }

    await LeaveRequest.findByIdAndDelete(leave._id);

    res.status(200).json({
      success: true,
      message: 'Leave request cancelled successfully.',
    });
  } catch (error) {
    console.error('Cancel leave error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  applyLeave,
  getMyLeaves,
  getClassLeaveRequests,
  getAllLeaveRequests,
  reviewLeave,
  cancelLeave,
};
