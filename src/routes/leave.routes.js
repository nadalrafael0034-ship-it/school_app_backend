const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleGuard');
const {
  applyLeave,
  getMyLeaves,
  getClassLeaveRequests,
  getAllLeaveRequests,
  reviewLeave,
  cancelLeave,
} = require('../controllers/leave.controller');

// Apply for leave (student or teacher)
router.post('/', protect, authorize('student', 'teacher'), applyLeave);

// Get my own leave requests
router.get('/my', protect, authorize('student', 'teacher'), getMyLeaves);

// Teacher: get student leave requests from their class
router.get('/class-requests', protect, authorize('teacher'), getClassLeaveRequests);

// Admin: get all leave requests
router.get('/all', protect, authorize('admin'), getAllLeaveRequests);

// Approve/reject a leave request (admin or teacher)
router.put('/:id/review', protect, authorize('admin', 'teacher'), reviewLeave);

// Cancel own pending leave
router.delete('/:id', protect, authorize('student', 'teacher'), cancelLeave);

module.exports = router;
