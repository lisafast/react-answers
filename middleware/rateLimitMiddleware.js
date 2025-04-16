import { RateLimiterMemory, RateLimiterMongo } from 'rate-limiter-flexible';
import mongoose from 'mongoose';
import crypto from 'crypto';
import ServerLoggingService from '../services/ServerLoggingService.js';
import SettingsService from '../services/SettingsService.js'; // To get the current setting
import dbConnect from '../api/db/db-connect.js';

// --- Configuration ---
const RATE_LIMIT_POINTS = 10; // Default points
const RATE_LIMIT_DURATION = 60; // Default duration (seconds)

// --- Fingerprint Function ---
const getFingerprint = (req) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown-ip';
    const userAgent = req.headers['user-agent'] || 'unknown-agent';
    return crypto.createHash('sha256').update(ip + userAgent).digest('hex');
};

// --- Limiter Instances ---
let memoryLimiter = null;
let mongoLimiter = null;
let currentLimiterType = null; // Track the currently active type
let isInitializing = false; // Prevent concurrent initializations

// --- Initialization Logic ---
const initializeRateLimiters = async () => {
    if (isInitializing) return; // Avoid race conditions
    isInitializing = true;

    try {
        const settings = await SettingsService.getSettings();
        const limiterType = settings?.rateLimiterType || 'memory'; // Default to memory
        const points = settings?.rateLimitPoints || RATE_LIMIT_POINTS;
        const duration = settings?.rateLimitDuration || RATE_LIMIT_DURATION;

        const opts = { points, duration };

        // Initialize Memory Limiter (always initialize as a fallback or default)
        if (!memoryLimiter || currentLimiterType !== 'memory') {
             memoryLimiter = new RateLimiterMemory(opts);
             ServerLoggingService.info('In-Memory Rate Limiter Initialized/Updated', null, opts);
        }

        // Initialize Mongo Limiter if needed
        if (limiterType === 'mongodb') {
            if (!mongoLimiter || currentLimiterType !== 'mongodb') {
                await dbConnect(); // Ensure DB connection
                const mongoConn = mongoose.connection;
                const mongoOpts = {
                    ...opts,
                    storeClient: mongoConn,
                    dbName: process.env.MONGODB_DBNAME || 'your_db_name', // Use env var or config
                    collectionName: 'rateLimits',
                    // insuranceLimiter: memoryLimiter // Optional fallback
                };
                mongoLimiter = new RateLimiterMongo(mongoOpts);
                ServerLoggingService.info('MongoDB Rate Limiter Initialized/Updated', null, mongoOpts);
            }
        }
        currentLimiterType = limiterType; // Update the active type
    } catch (error) {
        ServerLoggingService.error('Failed to initialize rate limiters', null, error);
        // Fallback to memory limiter if initialization fails
        if (!memoryLimiter) {
             memoryLimiter = new RateLimiterMemory({ points: RATE_LIMIT_POINTS, duration: RATE_LIMIT_DURATION });
             ServerLoggingService.warn('Fell back to default memory rate limiter due to init error.');
        }
        currentLimiterType = 'memory';
    } finally {
        isInitializing = false;
    }
};

// --- Middleware Function ---
export const rateLimitMiddleware = async (req, res) => {
    // Initialize/Re-initialize if needed (e.g., settings changed, cold start)
    // Consider fetching settings less frequently in a real-world scenario for performance
    await initializeRateLimiters();

    const fingerprint = getFingerprint(req);
    const chatId = req.body?.chatId || 'system';

    // Select the active limiter
    const activeLimiter = currentLimiterType === 'mongodb' && mongoLimiter ? mongoLimiter : memoryLimiter;

    if (!activeLimiter) {
        ServerLoggingService.error('No active rate limiter available!', chatId);
        // Fail open or closed? Let's fail open for now, but log error.
        return true;
    }

    try {
        await activeLimiter.consume(fingerprint);
        // Log which limiter was used (optional)
        // ServerLoggingService.debug(`Rate limit check passed (${currentLimiterType})`, chatId, { fingerprint });
        return true; // Request allowed
    } catch (rejRes) {
        if (rejRes instanceof Error) {
            // Log internal limiter error (e.g., DB connection issue)
            ServerLoggingService.error(`Rate Limiter (${currentLimiterType}) internal error`, chatId, rejRes);
            // Fail open? Be cautious. Maybe deny during errors.
            // res.status(500).json({ message: 'Internal server error during rate limit check.' });
            // return false;
            return true; // Fail open for now
        } else {
            // Rate limit exceeded
            ServerLoggingService.warn(`Rate limit exceeded (${currentLimiterType})`, chatId, { fingerprint, ip: req.ip });
            res.status(429).json({ message: 'Too many requests, please try again later.' });
            return false; // Request blocked
        }
    }
};

// Optional: Function to force re-initialization if settings change elsewhere
export const refreshRateLimiterSettings = async () => {
    ServerLoggingService.info('Refreshing rate limiter settings...');
    currentLimiterType = null; // Force re-check on next request
    mongoLimiter = null; // Allow re-creation with new settings
    memoryLimiter = null; // Allow re-creation with new settings
    await initializeRateLimiters();
};
