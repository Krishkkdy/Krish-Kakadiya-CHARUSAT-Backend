const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/jwt.config');

const authController = {
    login: async (req, res) => {
        try {
            const { username, password, email } = req.body;
            
            // Find or create user
            let user = await User.findOne({ username });
            if (!user) {
                user = new User({
                    username,
                    email,
                    password // In production, hash the password
                });
                await user.save();
            }

            const token = jwt.sign(
                { 
                    username: user.username,
                    email: user.email 
                },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            res.json({ 
                success: true, 
                token,
                user: { username: user.username, email: user.email }
            });
        } catch (error) {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
};

module.exports = authController;
