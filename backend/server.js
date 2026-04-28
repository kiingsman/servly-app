require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const Professional = require('./models/Professional');

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Middleware
app.use(cors());
app.use(express.json());

// Basic Health Route (To test if Render is awake)
app.get('/', (req, res) => {
  res.send('Servly Backend is Running and Connected to MongoDB!');
});

// API Endpoint to fetch all professionals
app.get('/api/professionals', async (req, res) => {
  try {
    const pros = await Professional.find();
    res.json(pros);
  } catch (error) {
    console.error('Error fetching professionals:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Auto-seed sample data if the database is empty
const seedDatabase = async () => {
  try {
    const count = await Professional.countDocuments();
    if (count === 0) {
      await Professional.insertMany([
        { name: 'Ibrahim Musa', category: 'electric', title: 'Master Electrician', rating: 4.9, reviews: 120, distance: '2.5km', price: 15000, verified: true, avatar: 'https://i.pravatar.cc/150?img=33' },
        { name: 'Amina Yusuf', category: 'cleaning', title: 'Deep Cleaning Pro', rating: 4.7, reviews: 85, distance: '4.1km', price: 10000, verified: true, avatar: 'https://i.pravatar.cc/150?img=47' },
        { name: 'Samuel Obi', category: 'plumbing', title: 'Expert Plumber', rating: 4.8, reviews: 210, distance: '1.2km', price: 12000, verified: true, avatar: 'https://i.pravatar.cc/150?img=11' },
        { name: 'David Okafor', category: 'ac', title: 'HVAC Technician', rating: 4.5, reviews: 42, distance: '3.0km', price: 18000, verified: false, avatar: 'https://i.pravatar.cc/150?img=60' }
      ]);
      console.log('Sample professionals added to MongoDB!');
    }
  } catch (err) {
    console.error('Seeding error:', err);
  }
};

// Run the seeder
seedDatabase();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});