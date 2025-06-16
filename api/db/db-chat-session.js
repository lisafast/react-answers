import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose'; // Added mongoose
import { Session } from '../../models/session.js'; // Added Session model
import { Setting } from '../../models/setting.js'; // Added Setting model
import dbConnect from './db-connect.js'; // Ensure you have a db-connect.js to handle DB connection

const secretKey = process.env.JWT_SECRET_KEY;
// Default session duration, can be overridden by environment variable
const SESSION_DURATION_SECONDS = parseInt(process.env.SESSION_DURATION_SECONDS, 10) || 3600; // 1 hour
const isProd = process.env.NODE_ENV !== 'development';

export default async function handler(req, res) {
    

    try {
        await dbConnect(); // Ensure the database connection is established
        // 1. Get the concurrent user limit from settings
        const concurrentSetting = await Setting.findOne({ key: 'concurrentSessions' });
        const durationSetting = await Setting.findOne({ key: 'sessionDuration' });
        // Default to a sensible value if not set in DB or if parsing fails
        const maxConcurrentUsers = concurrentSetting && !isNaN(parseInt(concurrentSetting.value, 10)) ? parseInt(concurrentSetting.value, 10) : 100;
        const sessionDurationSeconds = durationSetting && !isNaN(parseInt(durationSetting.value, 10)) ? parseInt(durationSetting.value, 10) * 60 : 5 * 60; // Default to 5 minutes if not set or invalid

        // 2. Count active sessions (not expired)
        const now = new Date();
        const activeSessionsCount = await Session.countDocuments({ expiresAt: { $gt: now } });

        if (activeSessionsCount >= maxConcurrentUsers) {
            return res.status(429).json({ error: 'Maximum number of concurrent users reached.' });
        }

        // 3. Create new session
        const newSessionId = uuidv4(); // This will be our sessionId and JWT ID
        const expiresAt = new Date(Date.now() + sessionDurationSeconds * 1000);

        // Save session to DB
        await Session.create({ sessionId: newSessionId, expiresAt });

        // 4. Issue JWT
        const options = {
            jwtid: newSessionId, // Use the newSessionId as the JWT ID (jti claim)
            expiresIn: `${sessionDurationSeconds}s` // e.g., '3600s'
        };
        const token = jwt.sign({}, secretKey, options);

        // 5. Set cookie
        const cookieOptions = [
            `token=${token}; `,
            'HttpOnly; ',
            isProd ? 'Secure; ' : '', // Secure only in production
            'SameSite=Strict; ',
            'Path=/; ',
            `Max-Age=${sessionDurationSeconds}`
        ].join('');

        res.setHeader('Set-Cookie', cookieOptions);

        // Return the new sessionId (which is also the chatId in your current logic)
        return res.status(200).json({ chatId: newSessionId }); // Changed from readableId to newSessionId for clarity

    } catch (error) {
        console.error("Error in db-chat-session handler:", error);
        return res.status(500).json({ error: 'Internal server error while creating session.' });
    }
}