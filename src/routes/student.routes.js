const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleGuard');
const {
  getMyAttendance, getMyStats, getStudentDashboard,
} = require('../controllers/student.controller');

const studentAccess = [protect, authorize('admin', 'student')];

router.get('/dashboard', ...studentAccess, getStudentDashboard);
router.get('/attendance', ...studentAccess, getMyAttendance);
router.get('/stats', ...studentAccess, getMyStats);

module.exports = router;
