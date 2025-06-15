const { v4: uuidv4 } = require('uuid');
const Quiz = require('../models/quiz.model');
const { generateQuizQuestions, generateHint, generateSuggestions } = require('../services/groq.service');
const { sendQuizResults } = require('../services/email.service');

const quizController = {
    generateQuiz: async (req, res) => {
        try {
            const { grade, subject, totalQuestions, maxScore, difficulty } = req.body;
            const username = req.user.username;

            // Generate AI questions
            const questions = await generateQuizQuestions(subject, grade, totalQuestions, difficulty);
            if (!questions || questions.length === 0) {
                throw new Error('Failed to generate questions');
            }

            const quiz = new Quiz({
                quizId: uuidv4(),
                username,
                grade,
                subject,
                difficulty,
                maxScore,
                questions,
                isCompleted: false
            });

            await quiz.save();

            // Remove correct answers before sending to client
            const clientQuiz = {
                ...quiz.toObject(),
                questions: questions.map(q => ({
                    questionId: q.questionId,
                    question: q.question,
                    options: q.options
                }))
            };

            res.json({ success: true, quiz: clientQuiz });
        } catch (error) {
            console.error('Quiz generation error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to generate quiz: ' + error.message 
            });
        }
    },

    submitQuiz: async (req, res) => {
        try {
            const { quizId, responses } = req.body;
            const username = req.user.username;

            const quiz = await Quiz.findOne({ quizId });
            if (!quiz) {
                return res.status(404).json({ success: false, message: 'Quiz not found' });
            }

            let score = 0;
            const evaluatedResponses = responses.map(response => {
                const question = quiz.questions.find(q => q.questionId === response.questionId);
                
                // Extract just the letter part (A, B, C, D) for comparison
                const getUserAnswer = (answer) => answer.match(/^[A-D]/i)?.[0]?.toUpperCase() || answer.toUpperCase();
                const userAnswerLetter = getUserAnswer(response.userResponse);
                const correctAnswerLetter = getUserAnswer(question.correctAnswer);
                
                const isCorrect = userAnswerLetter === correctAnswerLetter;
                if (isCorrect) {
                    score += (quiz.maxScore / quiz.questions.length);
                }

                return {
                    ...response,
                    isCorrect,
                    userAnswer: response.userResponse,
                    correctAnswer: question.correctAnswer
                };
            });

            // Round score to 2 decimal places
            const finalScore = Math.round(score * 100) / 100;

            const submission = {
                submissionId: uuidv4(),
                responses: evaluatedResponses,
                score: finalScore,
                submittedAt: new Date()
            };

            quiz.submissions.push(submission);
            quiz.isCompleted = true;
            await quiz.save();

            // Generate AI suggestions
            const suggestions = await generateSuggestions(
                quiz.subject, 
                quiz.grade, 
                evaluatedResponses
            );

            // Send email notification
            try {
                const userEmail = req.user.email; // Make sure this is available from auth
                if (userEmail) {
                    await sendQuizResults(
                        userEmail,
                        {
                            subject: quiz.subject,
                            grade: quiz.grade,
                            score: finalScore,
                            maxScore: quiz.maxScore,
                            correctCount: evaluatedResponses.filter(r => r.isCorrect).length,
                            totalQuestions: quiz.questions.length
                        },
                        suggestions
                    );
                    console.log('Email notification sent successfully');
                } else {
                    console.log('No email address available for user');
                }
            } catch (emailError) {
                console.error('Email notification failed:', emailError);
                // Continue with response even if email fails
            }

            res.json({ 
                success: true, 
                score: finalScore,
                totalQuestions: quiz.questions.length,
                maxScore: quiz.maxScore,
                submission,
                suggestions,
                emailSent: !!req.user.email
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    getQuizHistory: async (req, res) => {
        try {
            const { grade, subject, from, to, minScore, difficulty } = req.query;
            const username = req.user.username;

            let query = { username };

            // Add base filters
            if (grade) query.grade = parseInt(grade);
            if (subject) query.subject = { $regex: subject, $options: 'i' };
            if (difficulty) query.difficulty = difficulty;
            if (from || to) {
                query.createdAt = {};
                if (from) query.createdAt.$gte = new Date(from);
                if (to) query.createdAt.$lte = new Date(to);
            }

            // First get all quizzes matching base criteria
            let quizzes = await Quiz.find(query).sort({ createdAt: -1 });

            // Filter by minimum score if provided
            if (minScore && !isNaN(parseFloat(minScore))) {
                const minScoreValue = parseFloat(minScore);
                quizzes = quizzes.filter(quiz => {
                    if (!quiz.submissions || quiz.submissions.length === 0) return false;
                    
                    // Calculate percentage score from the highest submission
                    const highestScore = Math.max(
                        ...quiz.submissions.map(sub => 
                            (sub.score / quiz.maxScore) * 100
                        )
                    );
                    return highestScore >= minScoreValue;
                });
            }

            res.json({ success: true, history: quizzes });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    retryQuiz: async (req, res) => {
        try {
            const { quizId } = req.params;
            const username = req.user.username;

            const originalQuiz = await Quiz.findOne({ quizId });
            if (!originalQuiz) {
                return res.status(404).json({ success: false, message: 'Quiz not found' });
            }

            // Create new quiz with same questions but reset completion status
            const newQuiz = new Quiz({
                quizId: uuidv4(),
                username,
                grade: originalQuiz.grade,
                subject: originalQuiz.subject,
                difficulty: originalQuiz.difficulty,
                maxScore: originalQuiz.maxScore,
                questions: originalQuiz.questions,
                isCompleted: false,
                originalQuizId: originalQuiz.quizId // Reference to original quiz
            });

            await newQuiz.save();

            // Remove correct answers before sending to client
            const clientQuiz = {
                ...newQuiz.toObject(),
                questions: newQuiz.questions.map(q => ({
                    questionId: q.questionId,
                    question: q.question,
                    options: q.options
                }))
            };

            res.json({ success: true, quiz: clientQuiz });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    getHint: async (req, res) => {
        try {
            const { question, subject, grade } = req.body;
            
            // Generate AI hint
            const hint = await generateHint(question, subject, grade);
            
            if (!hint) {
                throw new Error('Could not generate hint');
            }

            res.json({ 
                success: true, 
                hint,
                questionId: req.body.questionId 
            });
        } catch (error) {
            console.error('Hint generation error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to generate hint: ' + error.message 
            });
        }
    }
};

module.exports = quizController;
