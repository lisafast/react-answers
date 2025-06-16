import jwt from 'jsonwebtoken';
import { Session } from '../models/session.js'; // Adjust path as needed
import dbConnect from '../api/db/db-connect.js';
import { Setting } from '../models/setting.js'; // Adjust path as needed

const secretKey = process.env.JWT_SECRET_KEY;

// Helper function to get session duration in seconds from settings
const getSessionDurationSeconds = async () => {
    await dbConnect();
    const durationSetting = await Setting.findOne({ key: 'sessionDuration' });
    // sessionDuration is stored in minutes, default to 60 minutes if not set
    return durationSetting && !isNaN(parseInt(durationSetting.value, 10))
        ? parseInt(durationSetting.value, 10) * 60
        : 5*60;
};

// Core function to verify and renew the session
async function verifyAndRenewSession(req, res) {
    let token = null;

    if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    } else if (req.headers.cookie) {
        const match = req.headers.cookie.match(/token=([^;]+)/);
        if (match) token = match[1];
    }

    if (!token) {
        // No token, but don't send a response here. Let the handler decide if it's an error.
        // Or, if all routes using this require a session, send 401.
        // For now, let's assume routes might have optional sessions or handle this.
        // If a session is strictly required, the calling handler or a subsequent auth middleware should check req.sessionId.
        // console.log('No token found for session renewal');
        return true; // Proceed, but req.sessionId will be undefined
    }

    let decoded;
    try {
        decoded = jwt.verify(token, secretKey);
    } catch (err) {
        // console.error('Token verification failed in sessionRenewal:', err.message);
        // Clear invalid cookie
        res.setHeader('Set-Cookie', 
            process.env.NODE_ENV === 'development'
                ? `token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
                : `token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
        );
        // Potentially send 401 if session is mandatory for all routes using this.
        // For now, proceed, req.sessionId will be undefined.
        return true; 
    }

    const sessionIdFromToken = decoded.jti; // jwtid claim holds our sessionId
    if (!sessionIdFromToken) {
        // console.error('No jti (sessionId) in token in sessionRenewal');
        return true; // Proceed, req.sessionId will be undefined.
    }

    // Get session duration from settings
    const SESSION_DURATION_SECONDS = await getSessionDurationSeconds();
    const newExpiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

    try {
        await dbConnect();
        const updatedSession = await Session.findOneAndUpdate(
            { sessionId: sessionIdFromToken }, 
            { $set: { expiresAt: newExpiresAt } },
            { new: true, upsert: false } 
        );

        if (!updatedSession) {
            // console.log(`Session not found for renewal: ${sessionIdFromToken}, clearing cookie.`);
            res.setHeader('Set-Cookie', 
                process.env.NODE_ENV === 'development'
                    ? `token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
                    : `token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
            );
            return true; // Proceed, req.sessionId will be undefined.
        }

        // Successfully renewed, issue new token
        const newToken = jwt.sign({}, secretKey, {
            jwtid: sessionIdFromToken,
            expiresIn: `${SESSION_DURATION_SECONDS}s`
        });

        res.setHeader('Set-Cookie', 
            process.env.NODE_ENV === 'development'
                ? `token=${newToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_DURATION_SECONDS}`
                : `token=${newToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_DURATION_SECONDS}`
        );
        
        req.sessionId = sessionIdFromToken; // Make sessionId available to the handler
        return true; // Success

    } catch (dbError) {
        console.error('DB error renewing session:', dbError);
        // In case of DB error, we might not want to block the request entirely,
        // but the session won't be renewed. The old token might still be valid for its original duration.
        // Or, decide to send a 500 error. For now, let it proceed without renewal.
        req.sessionId = sessionIdFromToken; // Use the sessionId from the valid token, even if DB update failed
        return true; 
    }
}

// Higher-order function to wrap handlers with session renewal
export const withSessionRenewal = (handler) => {
  return async (req, res) => {
    await verifyAndRenewSession(req, res); // This attempts to populate req.sessionId

    // If verifyAndRenewSession did not result in a valid sessionId,
    // and no response has been sent yet, return a 401 error.
    if (!req.sessionId) {
      if (!res.headersSent) {
        return res.status(401).json({ error: 'Session is required, invalid, or expired.' });
      }
      // If headers already sent, we can't send a new response, so just return.
      return;
    }
    
    // If req.sessionId is populated, proceed to the actual handler.
    return handler(req, res);
  };
};

// Export the core function if it needs to be used directly or for testing
export { verifyAndRenewSession };
