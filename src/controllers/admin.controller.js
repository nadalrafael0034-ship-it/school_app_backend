const User = require('../models/User');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');

// ─── Users CRUD ────────────────────────────────────────────────────────────────

// @desc  Get all users (with optional role filter)
// @route GET /api/admin/users?role=teacher
const getAllUsers = async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;

    const users = await User.find(filter)
      .populate('class', 'name section grade')
      .populate('subjects', 'name code')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: users.length, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Create a new user
// @route POST /api/admin/users
const createUser = async (req, res) => {
  try {
    const { classTeacherId, ...userData } = req.body;
    const user = await User.create(userData);

    // If student, add to class
    if (user.role === 'student' && user.class) {
      await Class.findByIdAndUpdate(user.class, {
        $addToSet: { students: user._id },
      });
    }

    // If teacher, add to class teachers list
    if (user.role === 'teacher' && req.body.classIds) {
      await Class.updateMany(
        { _id: { $in: req.body.classIds } },
        { $addToSet: { teachers: user._id } }
      );
    }

    // If teacher is being set as class teacher for a specific class
    if (user.role === 'teacher' && classTeacherId) {
      // Remove from any current class teacher assignment
      await Class.updateMany(
        { classTeacher: user._id },
        { $set: { classTeacher: null } }
      );
      // Set as class teacher
      await Class.findByIdAndUpdate(classTeacherId, {
        $set: { classTeacher: user._id },
        $addToSet: { teachers: user._id },
      });
      // Sync it back to the Teacher user document so it shows in the DB
      await User.findByIdAndUpdate(user._id, { class: classTeacherId });
      user.class = classTeacherId;
    }

    res.status(201).json({ success: true, message: 'User created successfully.', user });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email already exists.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get single user
// @route GET /api/admin/users/:id
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('class', 'name section grade')
      .populate('subjects', 'name code');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Update user
// @route PUT /api/admin/users/:id
const updateUser = async (req, res) => {
  try {
    const { password, classTeacherId, removeClassTeacher, ...updateData } = req.body;

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Handle class teacher assignment for teachers
    if (user.role === 'teacher') {
      if (removeClassTeacher) {
        // Remove from any class teacher assignment
        await Class.updateMany(
          { classTeacher: user._id },
          { $set: { classTeacher: null } }
        );
        await User.findByIdAndUpdate(user._id, { class: null });
        user.class = null;
      } else if (classTeacherId) {
        // Clear previous assignment
        await Class.updateMany(
          { classTeacher: user._id },
          { $set: { classTeacher: null } }
        );
        // Set new class teacher
        await Class.findByIdAndUpdate(classTeacherId, {
          $set: { classTeacher: user._id },
          $addToSet: { teachers: user._id },
        });
        await User.findByIdAndUpdate(user._id, { class: classTeacherId });
        user.class = classTeacherId;
      }
    }

    res.json({ success: true, message: 'User updated successfully.', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Delete (deactivate) user
// @route DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    res.json({ success: true, message: 'User deactivated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Classes CRUD ──────────────────────────────────────────────────────────────

const getAllClasses = async (req, res) => {
  try {
    const classes = await Class.find({ isActive: true })
      .populate('teachers', 'name email employeeId')
      .populate('classTeacher', '_id name email')
      .populate('subjects', 'name code')
      .sort({ grade: 1, name: 1 });

    res.json({ success: true, count: classes.length, classes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createClass = async (req, res) => {
  try {
    const cls = await Class.create(req.body);
    res.status(201).json({ success: true, message: 'Class created successfully.', class: cls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateClass = async (req, res) => {
  try {
    const cls = await Class.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!cls) return res.status(404).json({ success: false, message: 'Class not found.' });

    res.json({ success: true, message: 'Class updated.', class: cls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteClass = async (req, res) => {
  try {
    await Class.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Class deactivated.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Assign teacher to class
const assignTeacherToClass = async (req, res) => {
  try {
    const { teacherId, subjectId } = req.body;
    const cls = await Class.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { teachers: teacherId, subjects: subjectId } },
      { new: true }
    ).populate('teachers', 'name email');

    // Also update teacher's subjects
    if (subjectId) {
      await User.findByIdAndUpdate(teacherId, {
        $addToSet: { subjects: subjectId },
      });
    }

    res.json({ success: true, message: 'Teacher assigned.', class: cls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Subjects CRUD ─────────────────────────────────────────────────────────────

const getAllSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({ isActive: true }).sort({ name: 1 });
    res.json({ success: true, subjects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createSubject = async (req, res) => {
  try {
    const subject = await Subject.create(req.body);
    res.status(201).json({ success: true, subject });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Reports ───────────────────────────────────────────────────────────────────

// @desc  Overall attendance report
// @route GET /api/admin/reports
const getOverallReport = async (req, res) => {
  try {
    const { classId, startDate, endDate } = req.query;
    const filter = {};
    if (classId) filter.class = classId;
    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const attendances = await Attendance.find(filter)
      .populate('class', 'name section grade')
      .populate('subject', 'name code')
      .populate('teacher', 'name')
      .sort({ date: -1 });

    // Aggregate stats
    const stats = {
      totalSessions: attendances.length,
      totalPresent: 0,
      totalAbsent: 0,
      totalLate: 0,
    };

    attendances.forEach((a) => {
      a.records.forEach((r) => {
        if (r.status === 'present') stats.totalPresent++;
        else if (r.status === 'absent') stats.totalAbsent++;
        else if (r.status === 'late') stats.totalLate++;
      });
    });

    res.json({ success: true, stats, attendances });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Dashboard stats
const getDashboardStats = async (req, res) => {
  try {
    const [totalStudents, totalTeachers, totalClasses, totalSubjects, recentAttendance] =
      await Promise.all([
        User.countDocuments({ role: 'student', isActive: true }),
        User.countDocuments({ role: 'teacher', isActive: true }),
        Class.countDocuments({ isActive: true }),
        Subject.countDocuments({ isActive: true }),
        Attendance.find().sort({ date: -1 }).limit(5)
          .populate('class', 'name section')
          .populate('subject', 'name'),
      ]);

    res.json({
      success: true,
      stats: { totalStudents, totalTeachers, totalClasses, totalSubjects },
      recentAttendance,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllUsers, createUser, getUserById, updateUser, deleteUser,
  getAllClasses, createClass, updateClass, deleteClass, assignTeacherToClass,
  getAllSubjects, createSubject,
  getOverallReport, getDashboardStats,
};
