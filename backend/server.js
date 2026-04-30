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

app.get('/', (req, res) => res.send('Servly API is awake, connected to MongoDB, and ready!'));

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

        const token = jwt.sign({ userId: savedUser._id, name: savedUser.name }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
        res.status(201).json({ token, user: { id: savedUser._id, name: savedUser.name, email: savedUser.email } });
    } catch (error) { res.status(500).json({ message: 'Server error during signup' }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ userId: user._id, name: user.name }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
    } catch (error) { res.status(500).json({ message: 'Server error during login' }); }
});

// ==========================================
// 5. PROFESSIONALS ROUTE
// ==========================================
app.get('/api/professionals', async (req, res) => {
    try {
        const pros = await Professional.find().sort({ createdAt: -1 }); // Newest first
        res.json(pros);
    } catch (error) { res.status(500).json({ message: 'Server error fetching professionals' }); }
});

// ==========================================
// 6. USER BOOKINGS ROUTES
// ==========================================
app.post('/api/bookings', auth, async (req, res) => {
    try {
        const newBooking = new Booking({
            userId: req.user.id, clientName: req.user.name, professionalId: req.body.professionalId,
            professionalName: req.body.professionalName, date: req.body.date, time: req.body.time,
            address: req.body.address, totalPrice: req.body.totalPrice
        });
        const savedBooking = await newBooking.save();
        res.status(201).json(savedBooking);
    } catch (error) { res.status(500).json({ message: 'Server error saving booking' }); }
});

app.get('/api/bookings', auth, async (req, res) => {
    try {
        const userBookings = await Booking.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(userBookings);
    } catch (error) { res.status(500).json({ message: 'Server error fetching bookings' }); }
});

app.patch('/api/bookings/:id/cancel', auth, async (req, res) => {
    try {
        const booking = await Booking.findOne({ _id: req.params.id, userId: req.user.id });
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        if (booking.status !== 'pending') return res.status(400).json({ message: 'Only pending bookings can be cancelled' });

        booking.status = 'cancelled';
        await booking.save();
        res.json({ message: 'Booking cancelled successfully', booking });
    } catch (error) { res.status(500).json({ message: 'Server error cancelling booking' }); }
});

// ==========================================
// 7. ADMIN ROUTES
// ==========================================
app.get('/api/admin/bookings', auth, async (req, res) => {
    try {
        const allBookings = await Booking.find().sort({ createdAt: -1 });
        res.json(allBookings);
    } catch (error) { res.status(500).json({ message: 'Server error fetching all bookings' }); }
});

app.patch('/api/admin/bookings/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        booking.status = status;
        await booking.save();
        res.json({ message: 'Booking status updated', booking });
    } catch (error) { res.status(500).json({ message: 'Server error updating booking status' }); }
});

// NEW: Add a professional to the platform
app.post('/api/admin/professionals', auth, async (req, res) => {
    try {
        const { name, title, category, price, avatar } = req.body;
        
        // Ensure an avatar is provided, or give a default one
        const finalAvatar = avatar || `https://i.pravatar.cc/150?u=${Math.random()}`;

        const newPro = new Professional({
            name, title, category, price, avatar: finalAvatar,
            rating: 5.0, distance: "1.0 km away", verified: true // defaults for new pros
        });

        const savedPro = await newPro.save();
        res.status(201).json(savedPro);
    } catch (error) {
        console.error("Error creating professional:", error);
        res.status(500).json({ message: 'Server error creating professional' });
    }
});

// --- 8. Start Server ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));