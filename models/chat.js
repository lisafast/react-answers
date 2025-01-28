import mongoose from 'mongoose';


const ChatSchema = new mongoose.Schema({
    chatId: { type: String, required: true },
    interactions: [{
        type: mongoose.Schema.Types.ObjectId, ref: 'Interaction'
    }],
    provider: { type: String, required: false },
    referringUrl: { type: String, required: false }

}, { timestamps: true });

export const Chat = mongoose.models.Chat || mongoose.model('Chat', ChatSchema);