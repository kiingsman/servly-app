require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const http = require('http');
const { Server } = require('socket.io');

const auth = require('./middleware/auth');
// Note: Assuming your models are set up correctly in their files. 
// We are adding a 'role' field to the logic below.
const User = require('./models/User'); 
const Booking = require('./models/Booking');
const Professional = require('./models/Professional');

const messageSchema = new mongoose.Schema({
    bookingId: { type: String, required: true },
    author: { type: String, required: true },
    message: { type: String, required: true },
    time: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.use(cors()); 
app.use(express.json());

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/servly', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
    console.log('✅ MongoDB Connected Successfully!');
    // Optional: We skip the auto-seed if we want to rely on real signups now, 
    // but leaving it here ensures you always have demo data.
    const count = await Professional.countDocuments();
    if (count === 0) {
        const initialPros = [
            { name: "David O.", title: "Master Electrician", category: "electric", rating: 4.9, distance: "2.5 km away", price: 15000, verified: true, avatar: "https://i.pravatar.cc/150?img=11" },
            { name: "Sarah M.", title: "Pro Plumber", category: "plumbing", rating: 4.8, distance: "1.2 km away", price: 12000, verified: true, avatar: "https://i.pravatar.cc/150?img=5" },
        ];
        await Professional.insertMany(initialPros);
        console.log('✅ Injected initial professionals!');
    }
})
.catch(err => console.log('❌ MongoDB Connection Error:', err));

app.get('/', (req, res) => res.send('Servly API is awake with Pro Portal!'));

// ==========================================
// SOCKET.IO LOGIC
// ==========================================
io.on('connection', (socket) => {
    socket.on('join_room', (room) => socket.join(room));
    socket.on('send_message', async (data) => {
        try {
            await new Message({ bookingId: data.room, author: data.author, message: data.message, time: data.time }).save();
        } catch (err) { console.error(err); }
        socket.to(data.room).emit('receive_message', data);
    });
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// Client Signup
app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Add role 'client' to standard signups
        const newUser = new User({ name, email, password: hashedPassword, role: 'client' });
        const savedUser = await newUser.save();

        const token = jwt.sign({ userId: savedUser._id, name: savedUser.name, role: savedUser.role }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
        res.status(201).json({ token, user: { id: savedUser._id, name: savedUser.name, email: savedUser.email, role: savedUser.role } });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// --- NEW: Professional Signup ---
app.post('/api/pro-signup', async (req, res) => {
    try {
        const { name, email, password, title, category, price } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'Email already in use' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // 1. Create the User account with role 'professional'
        const newUser = new User({ name, email, password: hashedPassword, role: 'professional' });
        const savedUser = await newUser.save();

        // 2. Automatically create their Professional profile in the directory
        const newPro = new Professional({
            userId: savedUser._id, // Link profile to user account
            name, title, category, price: Number(price), 
            avatar: `https://ui-avatars.com/api/?name=${name.replace(' ', '+')}&background=0D8ABC&color=fff`,
            rating: 5.0, distance: "1.0 km away", verified: true
        });
        await newPro.save();

        const token = jwt.sign({ userId: savedUser._id, name: savedUser.name, role: savedUser.role, proId: newPro._id }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
        res.status(201).json({ token, user: { id: savedUser._id, name: savedUser.name, email: savedUser.email, role: savedUser.role, proId: newPro._id } });
    } catch (error) { console.log(error); res.status(500).json({ message: 'Server error creating pro account' }); }
});

// Login (handles both clients and pros)
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        // If they are a pro, fetch their pro profile ID to include in the payload
        let proId = null;
        if (user.role === 'professional') {
            const proProfile = await Professional.findOne({ userId: user._id });
            if (proProfile) proId = proProfile._id;
        }

        const token = jwt.sign({ userId: user._id, name: user.name, role: user.role, proId }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role || 'client', proId } });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// ==========================================
// OTHER ROUTES
// ==========================================
app.get('/api/professionals', async (req, res) => {
    try { res.json(await Professional.find().sort({ createdAt: -1 })); } catch (error) { res.status(500).json({ message: 'Error' }); }
});

app.post('/api/bookings', auth, async (req, res) => {
    try {
        const newBooking = new Booking({
            userId: req.user.id, clientName: req.user.name, professionalId: req.body.professionalId,
            professionalName: req.body.professionalName, date: req.body.date, time: req.body.time,
            address: req.body.address, totalPrice: req.body.totalPrice
        });
        res.status(201).json(await newBooking.save());
    } catch (error) { res.status(500).json({ message: 'Error' }); }
});

app.get('/api/bookings', auth, async (req, res) => {
    try { res.json(await Booking.find({ userId: req.user.id }).sort({ createdAt: -1 })); } catch (error) { res.status(500).json({ message: 'Error' }); }
});

// --- NEW: Route for Professionals to fetch bookings assigned to THEM ---
app.get('/api/pro/bookings', auth, async (req, res) => {
    try {
        // Find bookings where the professionalId matches the logged-in pro's profile ID
        const proProfile = await Professional.findOne({ userId: req.user.id });
        if (!proProfile) return res.status(404).json({ message: 'Pro profile not found' });
        
        const jobs = await Booking.find({ professionalId: proProfile._id }).sort({ createdAt: -1 });
        res.json(jobs);
    } catch (error) { res.status(500).json({ message: 'Error fetching pro jobs' }); }
});

app.patch('/api/bookings/:id/cancel', auth, async (req, res) => {
    try {
        const booking = await Booking.findOne({ _id: req.params.id });
        booking.status = 'cancelled';
        res.json(await booking.save());
    } catch (error) { res.status(500).json({ message: 'Error' }); }
});

app.patch('/api/admin/bookings/:id/status', auth, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        booking.status = req.body.status;
        res.json(await booking.save());
    } catch (error) { res.status(500).json({ message: 'Error' }); }
});

app.get('/api/admin/bookings', auth, async (req, res) => {
    try { res.json(await Booking.find().sort({ createdAt: -1 })); } catch (error) { res.status(500).json({ message: 'Error' }); }
});

app.get('/api/chat/:bookingId', auth, async (req, res) => {
    try { res.json(await Message.find({ bookingId: req.params.bookingId }).sort({ createdAt: 1 })); } catch (error) { res.status(500).json({ message: 'Error' }); }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));