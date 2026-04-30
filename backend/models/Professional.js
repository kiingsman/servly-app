const mongoose = require('mongoose');

const professionalSchema = new mongoose.Schema({
    name: { type: String, required: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    rating: { type: Number, default: 0 },
    distance: { type: String, default: '1.0 km away' },
    price: { type: Number, required: true },
    verified: { type: Boolean, default: false },
    avatar: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Professional', professionalSchema);