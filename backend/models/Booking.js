const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    clientName: { type: String, required: true },
    professionalId: { 
        type: mongoose.Schema.Types.ObjectId, // <-- Updated to match userId
        ref: 'Professional',                  // <-- References the Professional collection
        required: true 
    },
    professionalName: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    address: { type: String, required: true },
    totalPrice: { type: Number, required: true },
    status: { 
        type: String, 
        default: 'pending',
        enum: ['pending', 'confirmed', 'completed', 'cancelled'] 
    }
}, { timestamps: true }); // <-- Auto-generates both `createdAt` and `updatedAt` for you!

module.exports = mongoose.model('Booking', bookingSchema);