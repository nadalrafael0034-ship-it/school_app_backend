const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const User = require('../models/User');

// @desc  Get teacher's assigned classes (populates classTeacher for role check)
// @route GET /api/teacher/classes
const getMyClasses = async (req, res) => {
  try {
    const classes = await Class.find({
      $or: [{ teachers: req.user._id }, { classTeacher: req.user._id }],
      isActive: true,
    })
      .populate('subjects', 'name code')
      .populate('classTeacher', '_id name')
      .sort({ grade: 1, name: 1 });

    res.json({ success: true, classes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get students of a class
// @route GET /api/teacher/classes/:classId/students
const getClassStudents = async (req, res) => {
  try {
    const students = await User.find({
      class: req.params.classId,
      role: 'student',
      isActive: true,
    }).sort({ rollNumber: 1, name: 1 });

    res.json({ success: true, students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Check if today's morning attendance is already submitted for a class
// @route GET /api/teacher/attendance/:classId/today
const checkTodayAttendance = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existing = await Attendance.findOne({
      class: req.params.classId,
      period: 'morning',
      date: { $gte: today, $lt: tomorrow },
    })
      .populate('records.student', 'name rollNumber')
      .lean();

    res.json({
      success: true,
      submitted: !!existing,
      attendance: existing || null,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Mark/submit morning first-period attendance (class teacher only, once per day)
// @route POST /api/teacher/attendance
const markAttendance = async (req, res) => {
  try {
    const { classId, date, records } = req.body;

    // Verify the requesting teacher is the class teacher
    const cls = await Class.findById(classId);
    if (!cls) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    const isClassTeacher =
      cls.classTeacher && cls.classTeacher.toString() === req.user._id.toString();

    if (!isClassTeacher) {
      return res.status(403).json({
        success: false,
        message: 'Only the class teacher can take morning attendance.',
      });
    }

    // Parse date and build day range
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(attendanceDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Check if already submitted for today
    const existing = await Attendance.findOne({
      class: classId,
      period: 'morning',
      date: { $gte: attendanceDate, $lt: nextDay },
    });

    if (existing && existing.isFinalized) {
      return res.status(400).json({
        success: false,
        message: 'Morning attendance for today has already been submitted.',
      });
    }

    let attendance;
    if (existing) {
      existing.records = records;
      existing.teacher = req.user._id;
      existing.isFinalized = true;
      attendance = await existing.save();
    } else {
      attendance = await Attendance.create({
        class: classId,
        subject: null,
        teacher: req.user._id,
        date: attendanceDate,
        period: 'morning',
        records,
        isFinalized: true,
      });
    }

    await attendance.populate('class', 'name section grade');

    res.status(201).json({
      success: true,
      message: 'Morning attendance submitted successfully.',
      attendance,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Morning attendance for today has already been submitted.',
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get attendance history for a class
// @route GET /api/teacher/attendance/:classId
const getClassAttendance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { class: req.params.classId, period: 'morning' };

    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const attendance = await Attendance.find(filter)
      .populate('teacher', 'name')
      .populate('records.student', 'name rollNumber')
      .sort({ date: -1 });

    res.json({ success: true, attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get attendance report/stats for a class
// @route GET /api/teacher/reports/:classId
const getClassReport = async (req, res) => {
  try {
    const attendance = await Attendance.find({
      class: req.params.classId,
      period: 'morning',
    }).populate('records.student', 'name rollNumber');

    const studentMap = {};

    attendance.forEach((session) => {
      session.records.forEach((record) => {
        if (!record.student) return;
        const id = record.student._id.toString();
        if (!studentMap[id]) {
          studentMap[id] = {
            student: record.student,
            present: 0,
            absent: 0,
            total: 0,
          };
        }
        studentMap[id].total++;
        studentMap[id][record.status]++;
      });
    });

    const report = Object.values(studentMap).map((s) => ({
      ...s,
      percentage: s.total > 0 ? (s.present / s.total) * 100 : 0,
    }));

    res.json({
      success: true,
      totalSessions: attendance.length,
      report,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Teacher's dashboard summary
// @route GET /api/teacher/dashboard
const getTeacherDashboard = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [myClasses, todayAttendance] = await Promise.all([
      Class.find({
        $or: [{ teachers: req.user._id }, { classTeacher: req.user._id }],
        isActive: true,
      })
        .populate('subjects', 'name')
        .populate('classTeacher', '_id name'),
      Attendance.find({
        teacher: req.user._id,
        period: 'morning',
        date: { $gte: today, $lt: tomorrow },
      }).populate('class', 'name section grade'),
    ]);

    const classIds = myClasses.map((c) => c._id);
    const totalStudents = await User.countDocuments({
      class: { $in: classIds },
      role: 'student',
      isActive: true,
    });

    // Build a set of classIds where attendance is already taken today
    const classesWithAttendance = todayAttendance.map((a) =>
      a.class?._id?.toString()
    );

    res.json({
      success: true,
      totalClasses: myClasses.length,
      totalStudents,
      todayAttendanceCount: todayAttendance.length,
      classes: myClasses,
      todayAttendance,
      classesWithAttendanceTaken: classesWithAttendance,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getMyClasses,
  getClassStudents,
  markAttendance,
  checkTodayAttendance,
  getClassAttendance,
  getClassReport,
  getTeacherDashboard,
};
