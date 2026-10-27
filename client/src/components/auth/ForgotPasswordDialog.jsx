import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Check, AlertTriangle, Mail, KeyRound, ShieldCheck } from 'lucide-react';
import API from '../../services/api';
import { Button, fieldClass } from '../settings/SettingsShared';

/**
 * Password recovery: email → 6-digit code → new password.
 * The server enforces every step (code attempts, expiry, single use); this
 * dialog only walks the user through them. It never signs the user in: after
 * the reset they sign in with the new password.
 */

const errorOf = (err, fallback) => err?.response?.data?.error
  || err?.response?.data?.details?.[0]?.replace(/^[a-zA-Z]+: /, '')
  || fallback;

const passwordProblems = (pw) => [
  pw.length < 8 && 'at least 8 characters',
  !/[A-Z]/.test(pw) && 'one uppercase letter',
  !/[0-9]/.test(pw) && 'one number',
].filter(Boolean);

const STEPS = { email: 1, code: 2, password: 3, done: 4 };

export default function ForgotPasswordDialog({ initialEmail = '', onClose }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const firstField = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => { firstField.current?.focus(); }, [step]);
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose();
      // keep Tab inside the dialog
      if (e.key === 'Tab' && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const requestCode = async (e) => {
    e?.preventDefault();
    if (busy) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter the email address you signed up with.');
    setBusy(true); setError(''); setInfo('');
    try {
      const r = await API.post('/api/auth/password/forgot', { email: email.trim() });
      setInfo(r.data?.message || 'If an account exists for that email, we sent a code to it.');
      setCooldown(60);
      setStep('code');
    } catch (err) {
      setError(errorOf(err, 'Could not send the code. Check your connection and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e) => {
    e?.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code from the email.');
    setBusy(true); setError(''); setInfo('');
    try {
      const r = await API.post('/api/auth/password/verify', { email: email.trim(), code });
      setResetToken(r.data.resetToken);
      setStep('password');
    } catch (err) {
      setError(errorOf(err, 'That code is invalid or has expired.'));
      if (err?.response?.data?.code === 'CODE_LOCKED') setCode('');
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e) => {
    e?.preventDefault();
    if (busy) return;
    const problems = passwordProblems(pw);
    if (problems.length) return setError(`Your password needs ${problems.join(', ')}.`);
    if (pw !== pw2) return setError('The two passwords do not match.');
    setBusy(true); setError('');
    try {
      await API.post('/api/auth/password/reset', { resetToken, password: pw, confirmPassword: pw2 });
      setStep('done');
    } catch (err) {
      setError(errorOf(err, 'Could not reset the password.'));
      if (err?.response?.data?.code === 'RESET_TOKEN_INVALID') { setStep('email'); setCode(''); }
    } finally {
      setBusy(false);
    }
  };

  const titles = {
    email: ['Reset your password', 'Enter your account email. We will send you a 6-digit code.'],
    code: ['Check your email', `Enter the code sent to ${email.trim()}. It expires in 10 minutes.`],
    password: ['Choose a new password', 'You will sign in with it next. Other devices will be signed out.'],
    done: ['Password updated', 'Sign in with your new password.'],
  };
  const Icon = { email: Mail, code: KeyRound, password: KeyRound, done: ShieldCheck }[step];
  const problems = passwordProblems(pw);

  return (
    <div className="fixed inset-0 z-[100010] flex items-end justify-center font-sans sm:items-center sm:p-5" style={{ isolation: 'isolate' }}>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={!busy ? onClose : undefined}
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fp-title"
        aria-describedby="fp-desc"
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-[22px] border border-[var(--st-line-strong)] bg-[var(--bg-primary)] p-6 text-[var(--text-primary)] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.6)] sm:max-w-[420px] sm:rounded-[22px] sm:p-7"
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--st-line)] bg-[var(--st-fill)]">
            <Icon size={16} />
          </span>
          {step !== 'done' && (
            <span className="text-[11px] font-medium text-[var(--text-tertiary)]" aria-label={`Step ${STEPS[step]} of 3`}>
              Step {STEPS[step]} of 3
            </span>
          )}
        </div>
        <h2 id="fp-title" className="text-[20px] font-medium tracking-[-0.03em]">{titles[step][0]}</h2>
        <p id="fp-desc" className="mt-1.5 break-words text-[13.5px] leading-[1.6] text-[var(--text-secondary)]">{titles[step][1]}</p>

        {step === 'email' && (
          <form onSubmit={requestCode} className="mt-5 flex flex-col gap-3" noValidate>
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--text-secondary)]">
              Email
              <input ref={firstField} type="email" autoComplete="email" inputMode="email" value={email}
                onChange={(e) => setEmail(e.target.value)} disabled={busy} className={`${fieldClass} h-10`} />
            </label>
            <Actions busy={busy} onClose={onClose} label="Send code" />
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={verifyCode} className="mt-5 flex flex-col gap-3" noValidate>
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--text-secondary)]">
              6-digit code
              <input ref={firstField} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy}
                className={`${fieldClass} h-11 text-center font-mono text-[20px] tracking-[0.5em]`} aria-describedby="fp-code-help" />
            </label>
            <div id="fp-code-help" className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--text-tertiary)]">
              <span>No email? Check spam, or</span>
              <button type="button" onClick={requestCode} disabled={busy || cooldown > 0}
                className="cursor-pointer font-medium text-[var(--text-primary)] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50">
                {cooldown > 0 ? `resend in ${cooldown}s` : 'send a new code'}
              </button>
            </div>
            <Actions busy={busy} onClose={onClose} label="Verify code" />
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={savePassword} className="mt-5 flex flex-col gap-3" noValidate>
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--text-secondary)]">
              New password
              <div className="relative">
                <input ref={firstField} type={showPw ? 'text' : 'password'} autoComplete="new-password" value={pw}
                  onChange={(e) => setPw(e.target.value)} disabled={busy} className={`${fieldClass} h-10 pr-10`} aria-describedby="fp-pw-rules" />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>
            <ul id="fp-pw-rules" className="flex flex-col gap-1 text-[12px]">
              {[['8+ characters', pw.length >= 8], ['One uppercase letter', /[A-Z]/.test(pw)], ['One number', /[0-9]/.test(pw)]].map(([t, ok]) => (
                <li key={t} className={`flex items-center gap-1.5 ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-tertiary)]'}`}>
                  {ok ? <Check size={12} strokeWidth={2.6} /> : <span className="mx-[4px] h-1 w-1 rounded-full bg-current" />} {t}
                </li>
              ))}
            </ul>
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--text-secondary)]">
              Confirm new password
              <input type={showPw ? 'text' : 'password'} autoComplete="new-password" value={pw2}
                onChange={(e) => setPw2(e.target.value)} disabled={busy} className={`${fieldClass} h-10`} />
            </label>
            {pw2 && pw !== pw2 && <p className="text-[12px] text-red-500">Passwords do not match.</p>}
            <Actions busy={busy} onClose={onClose} label="Save password" disabled={problems.length > 0 || pw !== pw2} />
          </form>
        )}

        {step === 'done' && (
          <div className="mt-6">
            <Button className="w-full" onClick={() => onClose({ email: email.trim() })} ref={firstField}>Back to sign in</Button>
          </div>
        )}

        <div aria-live="polite" className="mt-3 min-h-[1px]">
          {error && (
            <p className="flex items-start gap-2 rounded-xl bg-red-500/[0.06] px-3 py-2.5 text-[12.5px] text-red-500">
              <AlertTriangle size={14} className="mt-[1px] shrink-0" /> {error}
            </p>
          )}
          {!error && info && step === 'code' && (
            <p className="rounded-xl bg-[var(--st-fill)] px-3 py-2.5 text-[12.5px] text-[var(--text-secondary)]">{info}</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Actions({ busy, onClose, label, disabled }) {
  return (
    <div className="mt-2 flex gap-2">
      <Button variant="secondary" onClick={() => onClose()} disabled={busy} className="flex-1">Cancel</Button>
      <button type="submit" disabled={busy || disabled}
        className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center rounded-full bg-[var(--text-primary)] px-4 text-[13px] font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? 'Working…' : label}
      </button>
    </div>
  );
}
