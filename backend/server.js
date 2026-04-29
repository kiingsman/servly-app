require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');

// Models
const Professional = require('./models/Professional');
const Booking = require('./models/Booking');
const User = require('./models/User'); // Ensure backend/models/User.js exists!

connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Servly API is running!'));

// ================= AUTHENTICATION ROUTES ================= //

app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // 1. Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }

    // 2. Check if user already exists
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "A user with this email already exists" });
    }

    // 3. Create new user
    const user = new User({ name, email, password });
    await user.save();

    // 4. Generate JWT Token
    const token = jwt.sign(
      { userId: user._id, name: user.name }, 
      process.env.JWT_SECRET || 'fallback_secret', 
      { expiresIn: '7d' }
    );
    
    // 5. Send success response
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });

  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: "Server error during signup. Please try again." });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 1. Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Please provide email and password" });
    }

    // 2. Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // 3. Check password
    if (user.password !== password) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // 4. Generate JWT Token
    const token = jwt.sign(
      { userId: user._id, name: user.name }, 
      process.env.JWT_SECRET || 'fallback_secret', 
      { expiresIn: '7d' }
    );
    
    // 5. Send success response
    res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email } });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error during login. Please try again." });
  }
});


// ================= DATA ROUTES ================= //

app.get('/api/professionals', async (req, res) => {
  try {
    const pros = await Professional.find();
    if (!pros || pros.length === 0) {
      return res.json([
        { _id: "1", name: 'Ibrahim Musa', category: 'electric', title: 'Master Electrician', rating: 4.9, reviews: 120, distance: '2.5km', price: 15000, verified: true, avatar: 'https://i.pravatar.cc/150?img=33' },
        { _id: "2", name: 'Amina Yusuf', category: 'cleaning', title: 'Deep Cleaning Pro', rating: 4.7, reviews: 85, distance: '4.1km', price: 10000, verified: true, avatar: 'https://i.pravatar.cc/150?img=47' }
      ]);
    }
    res.json(pros);
  } catch (error) { 
    res.status(500).json({ message: 'Server Error fetching professionals' }); 
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const newBooking = new Booking(req.body);
    const savedBooking = await newBooking.save();
    res.status(201).json(savedBooking);
  } catch (error) { 
    res.status(500).json({ message: 'Failed to create booking' }); 
  }
});

app.get('/api/bookings', async (req, res) => {
  try {
    // Only find bookings for the logged-in user
    const filter = req.query.userId ? { clientName: req.query.userId } : {};
    const bookings = await Booking.find(filter).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) { 
    res.status(500).json({ message: 'Failed to fetch bookings' }); 
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));