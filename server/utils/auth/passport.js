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
  const googleCallback = process.env.GOOGLE_CALLBACK_URL || `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/google/callback`;
  console.log('[Auth] Initializing Google Strategy with callback:', googleCallback);

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: googleCallback,
    proxy: true
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value?.toLowerCase();
      if (!email) return done(new Error('No email found in Google profile'), null);

      // 1. Try to find user by googleId
      let user = await User.findOne({ googleId: profile.id });
      
      if (user) {
        // Update existing social link if needed
        user.name = profile.displayName;
        user.avatar = profile.photos?.[0]?.value || user.avatar;
        await user.save();
        return done(null, user);
      }

      // 2. Try to find user by email (Account Linking)
      user = await User.findOne({ email });
      if (user) {
        user.googleId = profile.id;
        user.avatar = user.avatar || profile.photos?.[0]?.value;
        await user.save();
        console.log(`[Auth] Linked Google account for existing user: ${email}`);
        return done(null, user);
      }

      // 3. Create new user
      user = await User.create({
        googleId: profile.id,
        name: profile.displayName,
        email,
        avatar: profile.photos?.[0]?.value,
      });
      
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
    callbackURL: process.env.GITHUB_CALLBACK_URL || `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/github/callback`,
    scope: ['user:email']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = (profile.emails?.[0]?.value || `${profile.username}@github.com`).toLowerCase();

      // 1. Try to find user by githubId
      let user = await User.findOne({ githubId: profile.id });

      if (user) {
        user.name = profile.displayName || profile.username;
        user.avatar = profile.photos?.[0]?.value || user.avatar;
        await user.save();
        return done(null, user);
      }

      // 2. Try to find user by email (Account Linking)
      user = await User.findOne({ email });
      if (user) {
        user.githubId = profile.id;
        user.avatar = user.avatar || profile.photos?.[0]?.value;
        await user.save();
        console.log(`[Auth] Linked GitHub account for existing user: ${email}`);
        return done(null, user);
      }

      // 3. Create new user
      user = await User.create({
        githubId: profile.id,
        name: profile.displayName || profile.username,
        email,
        avatar: profile.photos?.[0]?.value,
      });
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));
} else {
  console.warn('⚠️ GitHub Client ID/Secret missing. GitHub Login disabled.');
}


export default passport;
