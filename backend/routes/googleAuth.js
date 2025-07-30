const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @route   GET /auth/google
// @desc    Start Google OAuth flow
// @access  Public
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

// @route   GET /auth/google/callback
// @desc    Google OAuth callback
// @access  Public
router.get('/google/callback', 
  passport.authenticate('google', { session: false }),
  (req, res) => {
    // Generate JWT token
    const payload = {
      userId: req.user._id,
      email: req.user.email
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      avatar: req.user.avatar,
      role: req.user.role
    }))}`);
  }
);

// @route   POST /auth/google/verify
// @desc    Verify Google token from frontend
// @access  Public
router.post('/google/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    // Verify the token with Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Check if user exists
    let user = await User.findOne({ googleId });

    if (!user) {
      // Check if user exists with same email
      user = await User.findOne({ email });
      
      if (user) {
        // Link Google account to existing user
        user.googleId = googleId;
        user.name = name || user.name;
        user.avatar = picture || user.avatar;
        user.authMethod = user.password ? 'both' : 'google';
        await user.save();
      } else {
        // Create new user
        user = new User({
          googleId,
          email,
          name,
          avatar: picture,
          role: 'admin',
          authMethod: 'google'
        });
        await user.save();
      }
    }

    // Generate JWT token
    const jwtPayload = {
      userId: user._id,
      email: user.email
    };

    const jwtToken = jwt.sign(jwtPayload, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.json({
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Google verification error:', error);
    res.status(400).json({ message: 'Invalid Google token' });
  }
});

module.exports = router;
