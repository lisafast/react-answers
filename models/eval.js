import mongoose from 'mongoose';

const Schema = mongoose.Schema;

// New sub-schema for sentence match traceability
const sentenceMatchTraceSchema = new Schema({
    sourceIndex: { type: Number, required: true }, // Index of the sentence in the current interaction's answer
    sourceSentenceText: { type: String, required: false, default: '' }, // Added: Actual text of the source sentence
    matchedInteractionId: { type: Schema.Types.ObjectId, ref: 'Interaction', required: true }, // ID of the interaction providing the expert feedback
    matchedSentenceIndex: { type: Number, required: true }, // Index of the sentence in the matched interaction's answer
    matchedSentenceText: { type: String, required: false, default: '' }, // Added: Actual text of the matched sentence
    matchedExpertFeedbackSentenceScore: { type: Number, required: false, default: null }, // Score given by expert for the matched sentence
    matchedExpertFeedbackSentenceExplanation: { type: String, required: false, default: '' }, // Explanation given by expert for the matched sentence
    similarity: { type: Number, required: true } // Similarity score between source and matched sentence
}, { _id: false });

const evalSchema = new Schema({
    expertFeedback: { 
        type: Schema.Types.ObjectId, 
        ref: 'ExpertFeedback',
        required: false
    },
    similarityScores: {
        sentences: [{ type: Number, required: false, default: 0 }],
        citation: { type: Number, required: false, default: 0 } // Added citation similarity
    },
    sentenceMatchTrace: [sentenceMatchTraceSchema] // Added traceability field
}, { 
    timestamps: true, 
    versionKey: false,
    id: false
});

export const Eval = mongoose.models.Eval || mongoose.model('Eval', evalSchema);