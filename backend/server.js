require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const auth = require('./middleware/auth');
const checkRole = require('./middleware/checkRole');

const User = require('./models/User');
const Professional = require('./models/Professional');
const Booking = require('./models/Booking');
const Notification = require('./models/Notification');
const Message = require('./models/Message');

// ==========================================
// 1. LOCAL FILE UPLOAD SETUP (Multer)
// ==========================================
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + '-' + file.originalname.split(' ').join('-'))
});
const upload = multer({ storage });

// ==========================================
// 2. APP & DB SETUP
// ==========================================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/servly', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('✅ MongoDB Connected!'))
  .catch((err) => console.log('❌ MongoDB Error:', err));

// ==========================================
// 3. SOCKET.IO AUTH (JWT) + EVENTS
// ==========================================
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log('⚡ Socket connected:', socket.user.id);

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.user.id} joined room ${roomId}`);
  });

  socket.on('send_message', async (data) => {
    try {
      const newMessage = new Message({
        bookingId: data.room,
        senderId: data.senderId,
        author: data.author,
        message: data.message,
        time: data.time,
        isRead: false
      });
      await newMessage.save();

      socket.to(data.room).emit('receive_message', {
        ...data,
        isRead: false 
      });

      // ---> NEW: Create a notification for the message recipient
      const booking = await Booking.findById(data.room);
      if (booking) {
        let recipientId;
        if (data.senderId === booking.userId.toString()) {
           const pro = await Professional.findById(booking.professionalId);
           if (pro) recipientId = pro.userId;
        } else {
           recipientId = booking.userId;
        }

        if (recipientId) {
            const notif = await createNotification(
              recipientId, 
              `New message from ${data.author}`, 
              data.message, 
              data.room, 
              'message'
            );
            io.emit('new_notification', notif); 
        }
      }
    } catch (err) {
      console.error('Message save error:', err);
    }
  });

  socket.on('live_location_update', (data) => {
    socket.to(data.room).emit('receive_live_location', data);
  });

  socket.on('mark_messages_read', async ({ bookingId, userId }) => {
    try {
      await Message.updateMany(
        { bookingId, senderId: { $ne: userId }, isRead: false },
        { $set: { isRead: true } }
      );
      socket.to(bookingId).emit('messages_read_update');
    } catch (err) {
      console.error('Read receipt error:', err);
    }
  });

    socket.on('call_user', (data) => {
    socket.to(data.room).emit('incoming_call', {
      offer: data.offer,
      callerName: data.callerName,
      room: data.room,
      callType: data.callType // <--- ADD THIS ONE LINE
    });
  });

  socket.on('accept_call', (data) => {
    socket.to(data.room).emit('call_accepted', { answer: data.answer });
  });

  socket.on('ice_candidate', (data) => {
    socket.to(data.room).emit('ice_candidate', { candidate: data.candidate });
  });

  socket.on('end_call', (data) => {
    socket.to(data.room).emit('call_ended');
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.user.id);
  });
});

// ---> NEW: Added bookingId and type parameters
const createNotification = async (userId, title, message, bookingId = null, type = 'status') => {
  try {
    const notif = new Notification({ userId, title, message, bookingId, type });
    await notif.save();
    return notif;
  } catch (err) {
    console.error('Notification creation failed:', err.message);
  }
};

const getUserId = (req) => {
  if (!req.user) return null;
  return req.user._id || req.user.id || req.user.userId || req.userId;
};

// ==========================================
// 4. AUTH ROUTES
// ==========================================
app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role: 'client' });
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'supersecretkey', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, favorites: [] } });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

app.post('/api/pro-signup', async (req, res) => {
  const { name, email, password, title, category, price } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role: 'professional' });
    await user.save();

    const pro = new Professional({
      userId: user._id,
      name,
      title,
      headline: title,
      category,
      price,
      distance: '0 km',
      rating: 5.0
    });
    await pro.save();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'supersecretkey', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'supersecretkey', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, favorites: user.favorites || [] } });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ==========================================
// 5. USER ROUTES
// ==========================================
app.post('/api/user/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image provided' });
    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    const user = await User.findByIdAndUpdate(getUserId(req), { avatar: avatarUrl }, { new: true });
    
    if (user && user.role === 'professional') {
      await Professional.findOneAndUpdate({ userId: user._id }, { avatar: avatarUrl });
    }
    
    res.json({ avatar: avatarUrl });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

app.post('/api/user/favorites/:proId', auth, async (req, res) => {
  try {
    const user = await User.findById(getUserId(req));
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.favorites.includes(req.params.proId)) {
      user.favorites.push(req.params.proId);
      await user.save();
    }
    res.json(user.favorites);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

app.delete('/api/user/favorites/:proId', auth, async (req, res) => {
  try {
    const user = await User.findById(getUserId(req));
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.favorites = user.favorites.filter(id => id.toString() !== req.params.proId);
    await user.save();
    res.json(user.favorites);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ==========================================
// 6. PROFESSIONAL ROUTES
// ==========================================
app.get('/api/professionals', async (req, res) => {
  try {
    const pros = await Professional.find();
    res.json(pros);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

app.put('/api/pro/profile', auth, checkRole('professional'), async (req, res) => {
  try {
    const updatedPro = await Professional.findOneAndUpdate(
      { userId: getUserId(req) },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    res.json(updatedPro);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Update failed' });
  }
});

// ==========================================
// 7. BOOKING ROUTES
// ==========================================
app.post('/api/bookings', auth, checkRole('client'), async (req, res) => {
  try {
    const { professionalId, professionalName, clientName, date, time, address, totalPrice } = req.body;
    
    if (!professionalId) {
       return res.status(400).json({ message: 'Professional ID is missing from request.' });
    }

    const actualUserId = getUserId(req);
    if (!actualUserId) {
        return res.status(400).json({ message: 'User ID is missing. Please log out and log back in.' });
    }

    const booking = new Booking({
      userId: actualUserId,
      clientName,
      professionalId,
      professionalName,
      date,
      time,
      address,
      totalPrice
    });
    
    await booking.save();

    // Safely Create Notification for the Professional
    try {
      const pro = await Professional.findById(professionalId);
      if (pro && pro.userId) {
        const notif = await createNotification(
          pro.userId, 
          'New Job Request!', 
          `${clientName} booked you for ${date} at ${time}.`,
          booking._id, // ---> NEW: Passing booking ID
          'status'     // ---> NEW: Passing type
        );
        io.emit('new_notification', notif);
      }
    } catch (notifErr) {
      console.error('Could not create notification, but booking succeeded:', notifErr.message);
    }

    res.status(201).json(booking);
  } catch (err) {
    console.error('Booking creation error:', err.message);
    res.status(500).json({ message: err.message || 'Booking failed' });
  }
});

app.get('/api/bookings', auth, checkRole('client'), async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: getUserId(req) }).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch bookings' });
  }
});

app.get('/api/pro/bookings', auth, checkRole('professional'), async (req, res) => {
  try {
    const pro = await Professional.findOne({ userId: getUserId(req) });
    if (!pro) return res.status(404).json({ message: 'Professional profile not found' });

    const bookings = await Booking.find({ professionalId: pro._id }).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch bookings' });
  }
});

app.patch('/api/bookings/:id/cancel', auth, checkRole('client'), async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, userId: getUserId(req) },
      { status: 'cancelled' },
      { new: true }
    );
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Cancellation failed' });
  }
});

app.patch('/api/admin/bookings/:id/status', auth, checkRole('admin', 'professional'), async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const notif = await createNotification(
      booking.userId,
      'Booking Update',
      `Your booking with ${booking.professionalName} is now ${req.body.status}.`,
      booking._id, // ---> NEW: Passing booking ID
      'status'     // ---> NEW: Passing type
    );
    io.emit('new_notification', notif);

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Update failed' });
  }
});

// ==========================================
// 8. NOTIFICATION & CHAT ROUTES
// ==========================================
app.get('/api/notifications', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: getUserId(req) }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch notifications' });
  }
});

app.patch('/api/notifications/read', auth, async (req, res) => {
  try {
    await Notification.updateMany({ userId: getUserId(req), isRead: false }, { isRead: true });
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update notifications' });
  }
});

app.get('/api/chat/:bookingId', auth, async (req, res) => {
  try {
    const messages = await Message.find({ bookingId: req.params.bookingId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch chat history' });
  }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));