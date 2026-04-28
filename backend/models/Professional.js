const mongoose = require('mongoose');

const professionalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  title: { type: String, required: true },
  rating: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  distance: { type: String },
  price: { type: Number, required: true },
  verified: { type: Boolean, default: false },
  avatar: { type: String }
});

module.exports = mongoose.model('Professional', professionalSchema);