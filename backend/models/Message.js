const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  bookingId: { type: String, required: true },
  senderId: { type: String, required: true }, // NEW: Uniquely identifies who sent it
  author: { type: String, required: true },   // Kept for UI display (User's Name)
  message: { type: String, required: true },
  time: { type: String, required: true },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);