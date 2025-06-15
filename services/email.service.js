const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD // Use App Password from Gmail
    },
    tls: {
        rejectUnauthorized: false
    }
});

const sendQuizResults = async (userEmail, quizData, suggestions) => {
    try {
        console.log('Sending email to:', userEmail);
        
        const emailTemplate = `
            <h2>Your Quiz Results</h2>
            <p>Here are your results for the ${quizData.subject} quiz:</p>
            <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
                <p><strong>Subject:</strong> ${quizData.subject}</p>
                <p><strong>Grade Level:</strong> ${quizData.grade}</p>
                <p><strong>Score:</strong> ${quizData.score} out of ${quizData.maxScore}</p>
                <p><strong>Questions Correct:</strong> ${quizData.correctCount} out of ${quizData.totalQuestions}</p>
            </div>
            
            <h3>Improvement Suggestions:</h3>
            <ul>
                ${suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
            </ul>
        `;

        const info = await transporter.sendMail({
            from: `"Quizzer App" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: `Quiz Results - ${quizData.subject}`,
            html: emailTemplate
        });

        console.log('Email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Email sending failed:', error);
        throw new Error('Failed to send email notification');
    }
};

module.exports = { sendQuizResults };
