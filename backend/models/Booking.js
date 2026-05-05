const express = require('express');
const router = express.Router();
const admin = require('firebase-admin'); // Import firebase admin

// Ensure you have initialized firebase admin somewhere in your backend startup (e.g. server.js)
// admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// POST: Create a new booking
router.post('/', async (req, res) => {
    try {
        const { professionalId, professionalName, clientName, date, time, address, totalPrice } = req.body;

        // 1. Save booking to DB (Replace with your actual DB logic)
        const newBooking = {
            professionalId, professionalName, clientName, date, time, address, totalPrice, status: 'pending'
        };
        // await db.collection('bookings').insertOne(newBooking);

        // 2. Fetch professional's device token from DB (Replace with your actual DB logic)
        // const pro = await db.collection('professionals').findOne({ _id: professionalId });
        const deviceToken = "THE_PROS_DEVICE_TOKEN_FROM_DB"; 

        // 3. Send Push Notification to wake up their phone
        if (deviceToken) {
            const message = {
                notification: {
                    title: 'New Job Request! 🛎️',
                    body: `${clientName} has requested your service at ${time}.`
                },
                data: {
                    bookingId: '12345', // send data to open specific screen in app
                    action: 'new_job'
                },
                token: deviceToken,
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        channelId: 'job_requests' // Important for overriding Do Not Disturb
                    }
                }
            };

            admin.messaging().send(message)
                .then((response) => console.log('Successfully sent push notification:', response))
                .catch((error) => console.log('Error sending push notification:', error));
        }

        res.status(201).json({ message: "Booking created successfully", booking: newBooking });

    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;