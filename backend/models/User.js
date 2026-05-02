const mongoose = require('mongoose');

// Sub-schema for user addresses
const addressSchema = new mongoose.Schema({
  label: { 
    type: String, 
    required: true // e.g., 'Home', 'Office'
  },
  address: { 
    type: String, 
    required: true 
  }
});

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['client', 'professional', 'admin'], 
    default: 'client' 
  },
  phone: { 
    type: String, 
    default: '' 
  },
  avatar: { 
    type: String, 
    default: '' 
  },
  addresses: [addressSchema],
  // Array of Professional IDs that the user has favorited
  favorites: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Professional' 
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);