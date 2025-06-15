const Groq = require('groq-sdk');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const generateQuizQuestions = async (subject, grade, totalQuestions, difficulty) => {
    const prompt = `Generate ${totalQuestions} multiple choice questions about ${subject} for grade ${grade} students at ${difficulty} difficulty level. 
    Format each question as a JSON object with these exact fields:
    {
        "question": "question text here",
        "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
        "correctAnswer": "A" or "B" or "C" or "D"
    }
    Return an array of ${totalQuestions} such question objects.`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama3-8b-8192",
            temperature: 0.5,
            max_tokens: 2048,
        });

        let questions = [];
        try {
            const content = completion.choices[0].message.content;
            // Extract JSON array from response
            const jsonStr = content.substring(content.indexOf('['), content.lastIndexOf(']') + 1);
            questions = JSON.parse(jsonStr);
        } catch (parseError) {
            console.error('Failed to parse Groq response:', parseError);
            throw new Error('Failed to parse AI response');
        }

        return questions.map(q => ({
            questionId: uuidv4(),
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer
        }));
    } catch (error) {
        console.error('Groq API Error:', error);
        throw new Error('Failed to generate questions');
    }
};

const generateHint = async (question, subject, grade) => {
    const prompt = `As a helpful tutor, provide a brief hint for this ${subject} question: "${question}"
    The hint should:
    - Guide the student towards the answer without revealing it
    - Focus on key concepts or problem-solving steps
    - Be appropriate for grade ${grade} level
    - Be concise (max 2 sentences)
    Format: Return only the hint text without any prefixes.`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama3-8b-8192",
            temperature: 0.7,
            max_tokens: 100,
        });

        return completion.choices[0].message.content.trim();
    } catch (error) {
        console.error('Groq API Error:', error);
        throw new Error('Failed to generate hint');
    }
};

const generateSuggestions = async (subject, grade, responses) => {
    const prompt = `Based on this quiz performance in ${subject} for grade ${grade}:
    - Total questions: ${responses.length}
    - Correct answers: ${responses.filter(r => r.isCorrect).length}
    
    Provide exactly 2 specific suggestions to improve their understanding.
    Format your response as a valid JSON array of 2 strings like this:
    ["suggestion 1", "suggestion 2"]`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama3-8b-8192",
            temperature: 0.7,
        });

        try {
            return JSON.parse(completion.choices[0].message.content);
        } catch (parseError) {
            // If JSON parsing fails, split the response into two suggestions
            const text = completion.choices[0].message.content;
            const suggestions = text.split(/[\n\.]/).filter(s => s.trim());
            return [
                suggestions[0] || "Review the fundamental concepts of this topic",
                suggestions[1] || "Practice more problems in this subject area"
            ];
        }
    } catch (error) {
        console.error('Groq API Error:', error);
        return [
            "Practice more problems in this subject area",
            "Review the fundamental concepts of this topic"
        ];
    }
};

module.exports = { generateQuizQuestions, generateHint, generateSuggestions };
