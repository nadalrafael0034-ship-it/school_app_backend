const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const User = require('../models/User');

// @desc  Get teacher's assigned classes
// @route GET /api/teacher/classes
const getMyClasses = async (req, res) => {
  try {
    const classes = await Class.find({
      teachers: req.user._id,
      isActive: true,
    })
      .populate('subjects', 'name code')
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
    }).sort({ name: 1 });

    res.json({ success: true, students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Mark/submit attendance
// @route POST /api/teacher/attendance
const markAttendance = async (req, res) => {
  try {
    const { classId, subjectId, date, records } = req.body;

    // Check if already submitted for this date/class/subject
    const existing = await Attendance.findOne({
      class: classId,
      subject: subjectId,
      date: new Date(date),
    });

    if (existing && existing.isFinalized) {
      return res.status(400).json({
        success: false,
        message: 'Attendance for this session is already finalized.',
      });
    }

    let attendance;
    if (existing) {
      // Update existing draft
      existing.records = records;
      existing.teacher = req.user._id;
      attendance = await existing.save();
    } else {
      attendance = await Attendance.create({
        class: classId,
        subject: subjectId,
        teacher: req.user._id,
        date: new Date(date),
        records,
        isFinalized: true,
      });
    }

    await attendance
      .populate('class', 'name section grade')
      .then((a) => a.populate('subject', 'name code'));

    res.status(201).json({
      success: true,
      message: 'Attendance saved successfully.',
      attendance,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Attendance for this session already exists.',
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get attendance history for a class
// @route GET /api/teacher/attendance/:classId
const getClassAttendance = async (req, res) => {
  try {
    const { subjectId, startDate, endDate } = req.query;
    const filter = { class: req.params.classId };

    if (subjectId) filter.subject = subjectId;
    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const attendance = await Attendance.find(filter)
      .populate('subject', 'name code')
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
    const attendance = await Attendance.find({ class: req.params.classId })
      .populate('records.student', 'name rollNumber');

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
            late: 0,
            total: 0,
          };
        }
        studentMap[id].total++;
        studentMap[id][record.status]++;
      });
    });

    const report = Object.values(studentMap).map((s) => ({
      ...s,
      percentage: s.total > 0 ? ((s.present + s.late) / s.total) * 100 : 0,
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
      Class.find({ teachers: req.user._id, isActive: true }).populate('subjects', 'name'),
      Attendance.find({
        teacher: req.user._id,
        date: { $gte: today, $lt: tomorrow },
      }).populate('class', 'name section').populate('subject', 'name'),
    ]);

    // Student count across all classes
    const classIds = myClasses.map((c) => c._id);
    const totalStudents = await User.countDocuments({
      class: { $in: classIds },
      role: 'student',
      isActive: true,
    });

    res.json({
      success: true,
      totalClasses: myClasses.length,
      totalStudents,
      todayAttendanceCount: todayAttendance.length,
      classes: myClasses,
      todayAttendance,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getMyClasses, getClassStudents, markAttendance,
  getClassAttendance, getClassReport, getTeacherDashboard,
};
