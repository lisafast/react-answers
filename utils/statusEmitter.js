// utils/statusEmitter.js
import { EventEmitter } from 'events';

// Create a single, shared instance for in-process communication
// Note: This will NOT work across multiple processes/servers without an external broker like Redis.
const statusEmitter = new EventEmitter();

// Increase max listeners if many concurrent requests are expected within one process
// statusEmitter.setMaxListeners(100); // Example: Set to a higher number if needed

export default statusEmitter;
