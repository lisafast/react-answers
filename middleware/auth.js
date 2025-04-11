import jwt from 'jsonwebtoken';
import { User } from '../models/user.js';
import dbConnect from '../api/db/db-connect.js';
import ServerLoggingService from '../services/ServerLoggingService.js'; // Added for logging in helper

 

export const generateToken = (user) => {
  const JWT_SECRET = process.env.JWT_SECRET_KEY;
  console.log('Generating token for user:', { userId: user._id, email: user.email, role: user.role });
  return jwt.sign(
    { userId: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const handleCORS = (req, res) => {
  console.log('CORS handling for request:', { 
    method: req.method, 
    path: req.path,
    origin: req.headers.origin,
    headers: req.headers
  });

  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    console.log('Set Access-Control-Allow-Origin to:', origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
      "Access-Control-Allow-Headers",
      "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === 'OPTIONS') {
      console.log('Handling OPTIONS preflight request');
      return res.status(200).end();
  }
  return true;
};

const verifyAuth = async (req, res) => {
  try {
    const JWT_SECRET = process.env.JWT_SECRET_KEY;
    const authHeader = req.headers.authorization;
    console.log('Verifying auth with headers:', {
      authorization: authHeader,
      method: req.method,
      path: req.path
    });

    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Auth failed: No bearer token provided');
      res.status(401).json({ message: 'No token provided' });
      return false;
    }

    const token = authHeader.split(' ')[1];
    console.log('Attempting to verify token');
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token verified successfully:', { userId: decoded.userId, email: decoded.email, role: decoded.role }); // Log email too
    await dbConnect();
    // Find user by email instead of _id
    const user = await User.findOne({ email: decoded.email }); 
    if (!user) {
      console.log('Auth failed: User not found in database using email:', decoded.email); // Log email on failure
      res.status(401).json({ message: 'User not found' });
      return false;
    }
    req.user = user.toObject(); 
    // Log email along with userId and role upon successful authentication
    console.log('Auth successful for user:', { userId: user._id, email: user.email, role: user.role }); 
    // Assign a plain JavaScript object representation of the user, not the full Mongoose document
    
    return true;
  } catch (error) {
    console.error('Auth error:', error.message);
    res.status(401).json({ message: 'Invalid token' });
    return false;
  }
};

const verifyAdmin = (req, res) => {
  // Log using available identifiers (_id and email) from req.user
  console.log('Verifying admin access for user:', { 
    userId: req.user?._id, // Use _id from the user object
    email: req.user?.email, // Also log email for clarity
    role: req.user?.role 
  });
  
  if (req.user.role !== 'admin') {
    // Log using available identifiers (_id and email) on denial
    console.log('Admin access denied for user:', { userId: req.user?._id, email: req.user?.email });
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  console.log('Admin access granted for user:', req.user?.userId);
  return true;
};

export const withProtection = (handler, ...middleware) => {
  return async (req, res) => {
    console.log('withProtection wrapper called for:', {
      path: req.path,
      method: req.method,
      middlewareCount: middleware.length
    });

    // Handle CORS preflight before any middleware
    //const corsResult = handleCORS(req, res);
    //if (corsResult !== true) {
    //  console.log('CORS preflight handled, ending request');
    //  return corsResult;
    //}

    for (const mw of middleware) {
      console.log('Executing middleware:', mw.name);
      const result = await mw(req, res);
      if (!result) {
        console.log('Middleware check failed:', mw.name);
        return;
      }
    }
    console.log('All middleware passed, executing handler');
    return handler(req, res);
  };
};

// New helper function to verify an optional token without DB lookup or error response
export const verifyOptionalToken = (req) => {
  const authHeader = req.headers.authorization;
  const logContext = { method: req.method, path: req.path };

  if (!authHeader?.startsWith('Bearer ')) {
    // No token provided, which is acceptable for an optional check
    return null;
  }

  const token = authHeader.split(' ')[1];
  try {
    const JWT_SECRET = process.env.JWT_SECRET_KEY;
    const decoded = jwt.verify(token, JWT_SECRET);
    // Token is valid, return the decoded payload
    ServerLoggingService.debug('Optional token verified successfully', null, { ...logContext, userId: decoded.userId, role: decoded.role });
    return decoded;
  } catch (error) {
    // Token is invalid or expired
    ServerLoggingService.warn(`Invalid or expired optional token received: ${error.message}`, null, logContext);
    return null;
  }
};


export const authMiddleware = verifyAuth;
export const adminMiddleware = verifyAdmin;
