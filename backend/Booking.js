const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  professionalId: { type: String, required: true },
  professionalName: { type: String, required: true },
  clientName: { type: String, default: 'Guest User' }, // Hardcoded until Auth is built
  date: { type: String, required: true },
  time: { type: String, required: true },
  address: { type: String, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending' },
  totalPrice: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);