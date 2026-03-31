const Attendance = require('../models/Attendance');

// @desc  Get student's own attendance records
// @route GET /api/student/attendance
const getMyAttendance = async (req, res) => {
  try {
    const { subjectId, startDate, endDate } = req.query;

    const filter = { 'records.student': req.user._id };
    if (subjectId) filter.subject = subjectId;
    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const attendances = await Attendance.find(filter)
      .populate('class', 'name section grade')
      .populate('subject', 'name code')
      .sort({ date: -1 });

    // Extract only this student's record from each session
    const myRecords = attendances.map((a) => {
      const myRecord = a.records.find(
        (r) => r.student.toString() === req.user._id.toString()
      );
      return {
        _id: a._id,
        class: a.class,
        subject: a.subject,
        date: a.date,
        status: myRecord ? myRecord.status : 'absent',
        remark: myRecord ? myRecord.remark : null,
      };
    });

    res.json({ success: true, count: myRecords.length, records: myRecords });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get student's attendance statistics
// @route GET /api/student/stats
const getMyStats = async (req, res) => {
  try {
    const attendances = await Attendance.find({
      'records.student': req.user._id,
    }).populate('subject', 'name code');

    const subjectStats = {};
    let overallPresent = 0;
    let overallTotal = 0;

    attendances.forEach((a) => {
      const record = a.records.find(
        (r) => r.student.toString() === req.user._id.toString()
      );
      if (!record) return;

      const subjectId = a.subject?._id?.toString();
      if (!subjectId) return;

      if (!subjectStats[subjectId]) {
        subjectStats[subjectId] = {
          subject: a.subject,
          present: 0,
          absent: 0,
          late: 0,
          total: 0,
        };
      }

      subjectStats[subjectId].total++;
      subjectStats[subjectId][record.status]++;
      overallTotal++;
      if (record.status === 'present' || record.status === 'late') {
        overallPresent++;
      }
    });

    const subjectBreakdown = Object.values(subjectStats).map((s) => ({
      ...s,
      percentage: s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : 0,
    }));

    const overallPercentage =
      overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 0;

    res.json({
      success: true,
      overall: {
        present: overallPresent,
        total: overallTotal,
        percentage: overallPercentage,
      },
      subjects: subjectBreakdown,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Student dashboard
// @route GET /api/student/dashboard
const getStudentDashboard = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayRecord, recentRecords, totalSessions] = await Promise.all([
      Attendance.find({
        'records.student': req.user._id,
        date: { $gte: today, $lt: tomorrow },
      }).populate('subject', 'name').populate('class', 'name section'),

      Attendance.find({ 'records.student': req.user._id })
        .sort({ date: -1 })
        .limit(5)
        .populate('subject', 'name'),

      Attendance.countDocuments({ 'records.student': req.user._id }),
    ]);

    let presentCount = 0;
    let absentCount = 0;
    const allAttendance = await Attendance.find({ 'records.student': req.user._id });
    allAttendance.forEach((a) => {
      const rec = a.records.find((r) => r.student.toString() === req.user._id.toString());
      if (rec?.status === 'present' || rec?.status === 'late') presentCount++;
      else absentCount++;
    });

    res.json({
      success: true,
      overall: {
        totalSessions,
        present: presentCount,
        absent: absentCount,
        percentage: totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0,
      },
      todayRecord,
      recentRecords,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getMyAttendance, getMyStats, getStudentDashboard };
