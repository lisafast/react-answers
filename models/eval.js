import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const evalSchema = new Schema({
    chatId: { 
        type: String,
        required: false 
    },
    interactionId: { 
        type: String,
        required: false 
    },
    expertFeedback: { 
        type: Schema.Types.ObjectId, 
        ref: 'ExpertFeedback',
        required: false
    },
    usedExpertFeedback: { 
        type: Schema.Types.ObjectId, 
        ref: 'ExpertFeedback',
        required: false
    },
    similarityScores: {
        question: { type: Number, required: false, default: 0 }, // Similarity score for the question
        answer: { type: Number, required: false, default: 0 }, // Similarity score for the answer
        questionAnswer: { type: Number, required: false, default: 0 }, // Combined similarity score for question and answer
        sentences: [{ type: Number, required: false, default: 0 }] // Array of similarity scores
    },

}, { 
    timestamps: true, 
    versionKey: false,
    id: false
});

export const Eval = mongoose.models.Eval || mongoose.model('Eval', evalSchema);