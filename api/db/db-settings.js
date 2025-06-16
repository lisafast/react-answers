import dbConnect from './db-connect.js';
import { Setting } from '../../models/setting.js';
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';

async function settingsHandler(req, res) {
  if (req.method === 'GET') {
    const { key, keys } = req.query;
    await dbConnect();
    if (key) {
      const setting = await Setting.findOne({ key });
      return res.status(200).json({ key, value: setting ? setting.value : null });
    } else if (keys) {
      // keys should be a comma-separated list
      const keysArray = Array.isArray(keys) ? keys : keys.split(',');
      const settings = await Setting.find({ key: { $in: keysArray } });
      const result = {};
      keysArray.forEach(k => {
        const found = settings.find(s => s.key === k);
        result[k] = found ? found.value : null;
      });
      return res.status(200).json(result);
    } else {
      return res.status(400).json({ message: 'Key or keys required' });
    }
  } else if (req.method === 'POST') {
    const { key, value, settings } = req.body;
    await dbConnect();
    if (key) {
      await Setting.findOneAndUpdate({ key }, { value }, { upsert: true });
      return res.status(200).json({ message: 'Setting updated' });
    } else if (settings && typeof settings === 'object') {
      // settings is an object: { key1: value1, key2: value2, ... }
      const ops = Object.entries(settings).map(([k, v]) =>
        Setting.findOneAndUpdate({ key: k }, { value: v }, { upsert: true })
      );
      await Promise.all(ops);
      return res.status(200).json({ message: 'Settings updated' });
    } else {
      return res.status(400).json({ message: 'Key or settings required' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
}

export default function handler(req, res) {
  return withProtection(settingsHandler, authMiddleware, adminMiddleware)(req, res);
}
