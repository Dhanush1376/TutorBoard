import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import dotenv from 'dotenv';
dotenv.config();

// Passport Serialize/Deserialize - Mock implementation
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    // Return a mock user
    const user = { id, name: 'Guest User', email: 'guest@example.com' };
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// 1. Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/google/callback`,
    proxy: true
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Mock user creation/finding
      const user = {
        id: profile.id,
        name: profile.displayName,
        email: profile.emails?.[0]?.value || 'google-user@example.com',
        avatar: profile.photos?.[0]?.value
      };
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
      // Mock user creation/finding
      const user = {
        id: profile.id,
        name: profile.displayName || profile.username,
        email: profile.emails?.[0]?.value || `${profile.username}@github.com`,
        avatar: profile.photos?.[0]?.value
      };
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));
} else {
  console.warn('⚠️ GitHub Client ID/Secret missing. GitHub Login disabled.');
}


export default passport;
