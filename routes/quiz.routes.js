const express = require('express');
const quizController = require('../controllers/quiz.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Protected routes
router.post('/generate', verifyToken, quizController.generateQuiz);
router.post('/submit', verifyToken, quizController.submitQuiz);
router.get('/history', verifyToken, quizController.getQuizHistory);
router.get('/retry/:quizId', verifyToken, quizController.retryQuiz);
router.post('/hint', verifyToken, quizController.getHint);

module.exports = router;
