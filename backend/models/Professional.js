const mongoose = require('mongoose');

const professionalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // <-- Link to User account
    name: { type: String, required: true },
    title: { type: String, required: true },
    headline: { type: String, default: "Professional Services" }, // <-- NEW: Short catchy description for profile
    category: { type: String, required: true },
    price: { type: Number, required: true },
    avatar: { type: String },
    rating: { type: Number, default: 5.0 },
    distance: { type: String, default: "1.0 km away" },
    verified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Professional', professionalSchema);