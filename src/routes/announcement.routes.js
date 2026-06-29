const express = require('express');
const { 
  createAnnouncement, 
  getAnnouncements, 
  deleteAnnouncement 
} = require('../controllers/announcement.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleGuard');

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get('/', getAnnouncements);
router.post('/', authorize('admin', 'teacher'), createAnnouncement);
router.delete('/:id', authorize('admin', 'teacher'), deleteAnnouncement);

module.exports = router;
