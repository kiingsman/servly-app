const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { type: String, required: true }, // The user receiving the notification
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: 'general' }, // 'booking', 'message', 'status'
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);