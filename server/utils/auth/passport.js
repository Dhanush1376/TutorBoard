import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import User from '../../models/User.js';
import dotenv from 'dotenv';
dotenv.config();

// Passport Serialize/Deserialize - DB implementation
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    if (!user) return done(null, false);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// 1. Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const googleCallback = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/google/callback`;
  console.log('[Auth] Initializing Google Strategy with callback:', googleCallback);

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: googleCallback,
    proxy: true
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error('No email found in Google profile'), null);

      // Find or create user
      const user = await User.findOneAndUpdate(
        { googleId: profile.id },
        { 
          $set: { 
            name: profile.displayName, 
            email: email.toLowerCase(),
            avatar: profile.photos?.[0]?.value 
          } 
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));
} else {
  console.warn('⚠️ Google Client ID/Secret missing. Google Login disabled.');
}

// 2. GitHub Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/github/callback`,
    scope: ['user:email']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // GitHub sometimes hides email; we use username fallback locally but prefer profile.emails
      const email = profile.emails?.[0]?.value || `${profile.username}@github.com`;

      const user = await User.findOneAndUpdate(
        { githubId: profile.id },
        { 
          $set: { 
            name: profile.displayName || profile.username, 
            email: email.toLowerCase(),
            avatar: profile.photos?.[0]?.value 
          } 
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));
} else {
  console.warn('⚠️ GitHub Client ID/Secret missing. GitHub Login disabled.');
}


export default passport;
