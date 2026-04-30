require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Import middleware and models
const auth = require('./middleware/auth');
const User = require('./models/User');
const Booking = require('./models/Booking');
const Professional = require('./models/Professional');

const app = express();

// --- 1. Middleware ---
app.use(cors()); 
app.use(express.json());

// --- 2. Database Connection & Auto-Seeding ---
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/servly', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
    console.log('✅ MongoDB Connected Successfully!');
    
    // Auto-seed professionals if the database is empty
    const count = await Professional.countDocuments();
    if (count === 0) {
        const initialPros = [
            { name: "David O.", title: "Master Electrician", category: "electric", rating: 4.9, distance: "2.5 km away", price: 15000, verified: true, avatar: "https://i.pravatar.cc/150?img=11" },
            { name: "Sarah M.", title: "Pro Plumber", category: "plumbing", rating: 4.8, distance: "1.2 km away", price: 12000, verified: true, avatar: "https://i.pravatar.cc/150?img=5" },
            { name: "John K.", title: "AC Specialist", category: "ac", rating: 4.7, distance: "3.0 km away", price: 18000, verified: true, avatar: "https://i.pravatar.cc/150?img=8" },
            { name: "Grace T.", title: "Deep Cleaning Expert", category: "cleaning", rating: 5.0, distance: "0.8 km away", price: 10000, verified: true, avatar: "https://i.pravatar.cc/150?img=9" }
        ];
        await Professional.insertMany(initialPros);
        console.log('✅ Injected initial professionals into the database!');
    }
})
.catch(err => console.log('❌ MongoDB Connection Error:', err));


// --- 3. Simple Test Route ---
app.get('/', (req, res) => {
    res.send('Servly API is awake and running securely with MongoDB!');
});


// ==========================================
// 4. AUTHENTICATION ROUTES
// ==========================================

app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists with this email' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ name, email, password: hashedPassword });
        const savedUser = await newUser.save();

        const token = jwt.sign(
            { userId: savedUser._id, name: savedUser.name },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '7d' }
        );

        res.status(201).json({ token, user: { id: savedUser._id, name: savedUser.name, email: savedUser.email } });
    } catch (error) {
        console.error("Signup Error:", error);
        res.status(500).json({ message: 'Server error during signup' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign(
            { userId: user._id, name: user.name },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '7d' }
        );

        res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: 'Server error during login' });
    }
});


// ==========================================
// 5. PROFESSIONALS ROUTE (From MongoDB)
// ==========================================
app.get('/api/professionals', async (req, res) => {
    try {
        const pros = await Professional.find();
        res.json(pros);
    } catch (error) {
        console.error("Error fetching professionals:", error);
        res.status(500).json({ message: 'Server error fetching professionals' });
    }
});


// ==========================================
// 6. BOOKINGS ROUTES (Protected & Saved to MongoDB)
// ==========================================

// POST a new booking
app.post('/api/bookings', auth, async (req, res) => {
    try {
        const newBooking = new Booking({
            userId: req.user.id,
            clientName: req.user.name, 
            professionalId: req.body.professionalId,
            professionalName: req.body.professionalName,
            date: req.body.date,
            time: req.body.time,
            address: req.body.address,
            totalPrice: req.body.totalPrice
        });
        
        const savedBooking = await newBooking.save();
        res.status(201).json(savedBooking);
    } catch (error) {
        console.error("Booking Error:", error);
        res.status(500).json({ message: 'Server error saving booking' });
    }
});

// GET user's bookings
app.get('/api/bookings', auth, async (req, res) => {
    try {
        const userBookings = await Booking.find({ userId: req.user.id }).sort({ createdAt: -1 });
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