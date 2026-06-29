const Announcement = require('../models/Announcement');
const User = require('../models/User');
const { sendPushNotificationToTopic } = require('../config/firebase');

exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, targetRoles, targetClasses, priority } = req.body;
    
    // Only admin or teachers can create announcements
    if (req.user.role === 'student') {
      return res.status(403).json({ success: false, message: 'Not authorized to create announcements' });
    }

    const announcement = await Announcement.create({
      title,
      content,
      author: req.user._id,
      targetRoles: targetRoles || ['all'],
      targetClasses: targetClasses || [],
      priority: priority || 'normal'
    });

    await announcement.populate('author', 'name role');

    // Send push notifications to targeted topics
    try {
      const roles = targetRoles || ['all'];
      const priorityEmoji = priority === 'urgent' ? '🚨' : priority === 'high' ? '⚠️' : '📢';
      
      const payload = { type: 'announcement', announcementId: announcement._id.toString() };
      
      for (const role of roles) {
        await sendPushNotificationToTopic(
          `role_${role}`,
          `${priorityEmoji} ${title}`,
          content.substring(0, 100),
          payload
        );
      }
    } catch (pushError) {
      console.error('Push notification error:', pushError.message);
      // Don't fail the request if push fails
    }

    res.status(201).json({
      success: true,
      announcement
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAnnouncements = async (req, res) => {
  try {
    const { role } = req.user;
    
    let query = {};
    
    if (role !== 'admin') {
      query = {
        $or: [
          { targetRoles: 'all' },
          { targetRoles: role }
        ]
      };
    }

    const announcements = await Announcement.find(query)
      .populate('author', 'name role')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      announcements
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    if (req.user.role !== 'admin' && announcement.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this announcement' });
    }

    await announcement.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
