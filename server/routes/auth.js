import { signup, signin, getMe, socialLoginSuccess } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import passport from '../utils/passport.js';

const router = Router();

router.post('/signup', signup);
router.post('/signin', signin);
router.get('/me', protect, getMe);

// ─── GOOGLE OAUTH ───
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login?error=google_failed', session: false }),
  socialLoginSuccess
);

// ─── GITHUB OAUTH ───
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get('/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login?error=github_failed', session: false }),
  socialLoginSuccess
);

export default router;
