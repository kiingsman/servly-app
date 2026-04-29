require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');

// Models & Middleware
const Professional = require('./models/Professional');
const Booking = require('./models/Booking');
const User = require('./models/User');
const auth = require('./middleware/auth');

// Initialize Database
connectDB();

const app = express();
const server = http.createServer(app);

// Improved CORS for Vercel/Render Communication
app.use(cors({
    origin: '*', // Allows all origins for development; update to your Vercel URL for production
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Initialize Socket.io
const io = new Server(server, { 
    cors: { origin: '*' } 
});

// ================= ROOT & HEALTH CHECK ================= //
// This prevents the "Cannot GET /" error when visiting the base URL
app.get('/', (req, res) => {
    res.json({ 
        status: "Online", 
        message: "Servly API is running smoothly!",
        endpoints: ["/api/signup", "/api/login", "/api/professionals", "/api/bookings"]
    });
});

// ================= AUTHENTICATION ROUTES ================= //

app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) return res.status(400).json({ message: "Please fill in all fields" });

    let existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "A user with this email already exists" });

    // ENCRYPT PASSWORD
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign(
        { userId: user._id, name: user.name }, 
        process.env.JWT_SECRET || 'fallback_secret', 
        { expiresIn: '7d' }
    );
    
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });

  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: "Server error during signup." });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) return res.status(400).json({ message: "Please provide email and password" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    // VERIFY ENCRYPTED PASSWORD
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    const token = jwt.sign(
        { userId: user._id, name: user.name }, 
        process.env.JWT_SECRET || 'fallback_secret', 
        { expiresIn: '7d' }
    );
    
    res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email } });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error during login." });
  }
});

// ================= DATA ROUTES ================= //

// Public route: Fetch all professionals
app.get('/api/professionals', async (req, res) => {
  try {
    const pros = await Professional.find();
    res.json(pros);
  } catch (error) { 
    console.error("Fetch Professionals Error:", error);
    res.status(500).json({ message: 'Server Error fetching professionals' }); 
  }
});

// PROTECTED ROUTE: Create a booking
app.post('/api/bookings', auth, async (req, res) => {
  try {
    const newBooking = new Booking({
        ...req.body,
        clientName: req.user.name 
    });
    const savedBooking = await newBooking.save();
    res.status(201).json(savedBooking);
  } catch (error) { 
    res.status(500).json({ message: 'Failed to create booking' }); 
  }
});

// PROTECTED ROUTE: Fetch user's bookings
app.get('/api/bookings', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ clientName: req.user.name }).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) { 
    res.status(500).json({ message: 'Failed to fetch bookings' }); 
  }
});

// ================= SERVER INITIALIZATION ================= //

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔗 Root: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/api/professionals`);
});