const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    questionId: String,
    question: String,
    options: [String],
    correctAnswer: String
});

const quizSchema = new mongoose.Schema({
    quizId: String,
    username: String,
    grade: Number,
    subject: String,
    difficulty: String,
    maxScore: Number,
    questions: [questionSchema],
    isCompleted: {
        type: Boolean,
        default: false
    },
    submissions: [{
        submissionId: String,
        responses: [{
            questionId: String,
            userResponse: String,
            isCorrect: Boolean
        }],
        score: Number,
        submittedAt: Date
    }]
}, { timestamps: true });

module.exports = mongoose.model('Quiz', quizSchema);
