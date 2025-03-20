import jwt from 'jsonwebtoken';
import { withProtection } from '../../middleware/auth.js';

const secretKey = process.env.JWT_SECRET_KEY;

async function verifySessionHandler(req, res) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Token missing.' });
    }
  
    try {
        const decoded = jwt.verify(token, secretKey);
        console.log(`Readable ID (jti): ${decoded.jti}`);
        return res.status(200).json({ valid: true, chatId: decoded.jti });
    } catch (err) {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
}

export default function handler(req, res) {
    return verifySessionHandler(req, res);
}