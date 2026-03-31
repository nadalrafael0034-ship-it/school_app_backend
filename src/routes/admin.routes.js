const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleGuard');
const {
  getAllUsers, createUser, getUserById, updateUser, deleteUser,
  getAllClasses, createClass, updateClass, deleteClass, assignTeacherToClass,
  getAllSubjects, createSubject,
  getOverallReport, getDashboardStats,
} = require('../controllers/admin.controller');

const adminOnly = [protect, authorize('admin')];

// Dashboard
router.get('/dashboard', ...adminOnly, getDashboardStats);

// Users
router.get('/users', ...adminOnly, getAllUsers);
router.post('/users', ...adminOnly, createUser);
router.get('/users/:id', ...adminOnly, getUserById);
router.put('/users/:id', ...adminOnly, updateUser);
router.delete('/users/:id', ...adminOnly, deleteUser);

// Classes
router.get('/classes', ...adminOnly, getAllClasses);
router.post('/classes', ...adminOnly, createClass);
router.put('/classes/:id', ...adminOnly, updateClass);
router.delete('/classes/:id', ...adminOnly, deleteClass);
router.post('/classes/:id/assign-teacher', ...adminOnly, assignTeacherToClass);

// Subjects
router.get('/subjects', ...adminOnly, getAllSubjects);
router.post('/subjects', ...adminOnly, createSubject);

// Reports
router.get('/reports', ...adminOnly, getOverallReport);

module.exports = router;
