const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleGuard');
const {
  getMyClasses, getClassStudents, markAttendance,
  getClassAttendance, getClassReport, getTeacherDashboard,
} = require('../controllers/teacher.controller');

const teacherAccess = [protect, authorize('admin', 'teacher')];

router.get('/dashboard', ...teacherAccess, getTeacherDashboard);
router.get('/classes', ...teacherAccess, getMyClasses);
router.get('/classes/:classId/students', ...teacherAccess, getClassStudents);
router.post('/attendance', ...teacherAccess, markAttendance);
router.get('/attendance/:classId', ...teacherAccess, getClassAttendance);
router.get('/reports/:classId', ...teacherAccess, getClassReport);

module.exports = router;
