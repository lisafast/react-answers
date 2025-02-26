import mongoose, { model } from 'mongoose';
const Schema = mongoose.Schema;

const expertFeedbackSchema = new Schema({
    totalScore: { type: Number, required: false, default: -1 },
    sentence1Score: { type: Number, required: false, default: -1 },
    sentence1Explanation: { type: String, required: false, default: '' },
    sentence2Score: { type: Number, required: false, default: -1 },
    sentence2Explanation: { type: String, required: false, default: '' },
    sentence3Score: { type: Number, required: false, default: -1 },
    sentence3Explanation: { type: String, required: false, default: '' },
    sentence4Score: { type: Number, required: false, default: -1 },
    sentence4Explanation: { type: String, required: false, default: '' },
    citationScore: { type: Number, required: false, default: -1 },
    citationExplanation: { type: String, required: false, default: '' },
    answerImprovement: { type: String, required: false, default: '' },
    expertCitationUrl: { type: String, required: false, default: '' },
    feedback: { type: String, required: false, default: '' }
}, {
    timestamps: true, versionKey: false,
    id: false,
});

export const ExpertFeedback = mongoose.models.ExpertFeedback || mongoose.model('ExpertFeedback', expertFeedbackSchema);
