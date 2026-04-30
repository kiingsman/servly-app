require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Import your custom middleware and models
const auth = require('./middleware/auth');
const User = require('./models/User');

const app = express();

// --- 1. Middleware ---
app.use(cors()); // Allows your Vercel frontend to connect
app.use(express.json()); // Allows Express to read JSON body data

// --- 2. Database Connection ---
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/servly', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected Successfully!'))
.catch(err => console.log('❌ MongoDB Connection Error:', err));

// --- 3. Simple Test Route ---
app.get('/', (req, res) => {
    res.send('Servly API is awake and running securely!');
});


// ==========================================
// 4. AUTHENTICATION ROUTES
// ==========================================

// SIGN UP ROUTE
app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const newUser = new User({
            name,
            email,
            password: hashedPassword
        });

        const savedUser = await newUser.save();

        // Create JWT Token
        const token = jwt.sign(
            { userId: savedUser._id, name: savedUser.name },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            token,
            user: { id: savedUser._id, name: savedUser.name, email: savedUser.email }
        });
    } catch (error) {
        console.error("Signup Error:", error);
        res.status(500).json({ message: 'Server error during signup' });
    }
});

// LOG IN ROUTE
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Create JWT Token
        const token = jwt.sign(
            { userId: user._id, name: user.name },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: 'Server error during login' });
    }
});


// ==========================================
// 5. PROFESSIONALS ROUTE
// ==========================================
app.get('/api/professionals', (req, res) => {
    // Hardcoded list of professionals for the MVP
    const pros = [
        { id: 1, name: "David O.", title: "Master Electrician", category: "electric", rating: 4.9, distance: "2.5 km away", price: 15000, verified: true, avatar: "https://i.pravatar.cc/150?img=11" },
        { id: 2, name: "Sarah M.", title: "Pro Plumber", category: "plumbing", rating: 4.8, distance: "1.2 km away", price: 12000, verified: true, avatar: "https://i.pravatar.cc/150?img=5" },
        { id: 3, name: "John K.", title: "AC Specialist", category: "ac", rating: 4.7, distance: "3.0 km away", price: 18000, verified: true, avatar: "https://i.pravatar.cc/150?img=8" },
        { id: 4, name: "Grace T.", title: "Deep Cleaning Expert", category: "cleaning", rating: 5.0, distance: "0.8 km away", price: 10000, verified: true, avatar: "https://i.pravatar.cc/150?img=9" }
    ];
    res.json(pros);
});


// ==========================================
// 6. BOOKINGS ROUTES (Protected)
// ==========================================

// Create a quick, temporary in-memory array to store bookings 
// (since you don't have a Booking.js Mongoose model yet)
const tempBookingsDB = [];

// POST a new booking
app.post('/api/bookings', auth, (req, res) => {
    try {
        const newBooking = {
            _id: Math.random().toString(36).substr(2, 9), // generate random ID
            userId: req.user.id, // Comes from auth.js middleware!
            clientName: req.user.name, 
            ...req.body, // professionalId, date, time, address, totalPrice
            status: 'pending',
            createdAt: new Date()
        };
        
        tempBookingsDB.push(newBooking);
        res.status(201).json(newBooking);
    } catch (error) {
        console.error("Booking Error:", error);
        res.status(500).json({ message: 'Server error saving booking' });
    }
});

// GET user's bookings
app.get('/api/bookings', auth, (req, res) => {
    try {
        // Only return bookings that belong to the logged-in user
        const userBookings = tempBookingsDB.filter(b => b.userId === req.user.id);
        res.json(userBookings);
    } catch (error) {
        console.error("Fetch Bookings Error:", error);
        res.status(500).json({ message: 'Server error fetching bookings' });
    }
});

// --- 7. Start Server ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});