import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[var(--bg-primary)] font-sans text-[var(--text-primary)]">
      
      {/* Left Column: Form Section */}
      <div className="flex-1 flex flex-col items-center px-6 py-16 lg:py-24 relative z-10 w-full lg:w-1/2 min-h-screen overflow-y-auto">
         {/* Top-left branding - made relative/absolute mixed specifically for mobile safe-area */}
         <div className="absolute top-6 left-6 lg:top-8 lg:left-8 flex items-center gap-3 cursor-pointer group z-50" onClick={() => navigate('/')}>
             <span className=" text-xl tracking-tight">TutorBoard</span>
         </div>

          <div className="w-full max-w-sm">
            <motion.div
              key={isSignUp ? 'signup' : 'signin'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col"
            >
                {/* Header Section */}
                <div className="mb-10">
                  <h1 className="text-3xl font-serif font-bold text-[var(--text-primary)] mb-2.5">
                    {isSignUp ? 'Create an account' : 'Welcome back'}
                  </h1>
                  <p className="text-[var(--text-secondary)] text-[15px] leading-relaxed opacity-80">
                    {isSignUp ? 'Enter your details to get started.' : 'Sign in to your account to continue.'}
                  </p>
                </div>

                {/* Form Fields */}
                <div className="space-y-5">
                   {isSignUp && (
                     <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)] ml-1">Full Name</label>
                        <div className="relative">
                           <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={18} />
                           <input 
                              type="text" 
                              placeholder="Your full name" 
                              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-[var(--text-tertiary)]/50"
                           />
                        </div>
                     </div>
                   )}
                   
                   <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)] ml-1">Email address</label>
                      <div className="relative">
                         <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={18} />
                         <input 
                            type="email" 
                            placeholder="name@company.com" 
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-[var(--text-tertiary)]/50"
                         />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Password</label>
                        {!isSignUp && (
                          <button className="text-[11px] font-bold text-blue-500 hover:text-blue-600 transition-colors uppercase tracking-tight">
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                         <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={18} />
                         <input 
                            type="password" 
                            placeholder="••••••••" 
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-[var(--text-tertiary)]/50"
                         />
                      </div>
                   </div>
                </div>

                {/* Primary Action */}
                <button 
                  className="w-full py-4 rounded-2xl text-[15px] font-bold transition-all flex items-center justify-center gap-2 mt-10 shadow-md hover:shadow-lg active:scale-[0.98]"
                  style={{
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--bg-primary)'
                  }}
                >
                   {isSignUp ? 'Sign Up' : 'Sign In'}
                   <ArrowRight size={18} />
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4 my-10">
                   <div className="h-[1px] flex-1 bg-[var(--border-color)] opacity-50"></div>
                   <span className="text-[10px] text-[var(--text-tertiary)] font-bold tracking-[0.2em]">OR CONTINUE WITH</span>
                   <div className="h-[1px] flex-1 bg-[var(--border-color)] opacity-50"></div>
                </div>

                {/* Social Login */}
                <div className="grid grid-cols-2 gap-4 mb-10">
                   <button className="flex items-center justify-center gap-2.5 py-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-all text-sm font-bold shadow-sm active:scale-[0.98]">
                      <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                         <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                         <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                         <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                         <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Google
                   </button>
                   <button className="flex items-center justify-center gap-2.5 py-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-all text-sm font-bold shadow-sm active:scale-[0.98]">
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                         <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.699-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .839-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"/>
                      </svg>
                      GitHub
                   </button>
                </div>

                {/* Footer Toggle */}
                <div className="text-center text-sm text-[var(--text-secondary)] py-4 border-t border-[var(--border-color)]/30">
                   {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                   <button 
                     onClick={() => setIsSignUp(!isSignUp)}
                     className="font-bold text-blue-500 hover:text-blue-600 transition-colors"
                   >
                     {isSignUp ? 'Sign In' : 'Sign Up'}
                   </button>
                </div>
            </motion.div>
          </div>
      </div>

      {/* Right Column: Decorative Graphic Section */}
      <div className="hidden lg:flex flex-1 relative bg-[var(--bg-secondary)] overflow-hidden items-center justify-center p-12">
        {/* Abstract Background Elements */}
        <div className="absolute inset-0 z-0 opacity-30">
           <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/40 blur-[120px]"></div>
           <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/40 blur-[120px]"></div>
        </div>
        
        {/* Dynamic Glassmorphic Card Overlay */}
        <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
           className="relative z-10 w-full max-w-lg aspect-square border border-[var(--border-color)] bg-[var(--bg-primary)]/50 backdrop-blur-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col justify-between p-10"
        >
            <div className="space-y-4">
               <div className="w-12 h-12 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center shadow-sm">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-primary)]"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
               </div>
               <h2 className="text-3xl font-serif font-bold text-[var(--text-primary)] leading-tight mt-6">
                 Master concepts faster with interactive models.
               </h2>
               <p className="text-[var(--text-secondary)] leading-relaxed max-w-sm mt-4 text-[15px]">
                 TutorBoard is your personal learning canvas. Join a community of learners pushing the boundaries of spatial education.
               </p>
            </div>

            {/* Mock Code Editor Snippet */}
            <div className="w-full h-36 rounded-xl bg-[#1e1e1e] border border-[#333] shadow-inner p-5 font-mono text-[13px] text-green-400 overflow-hidden relative">
               <div className="absolute top-3 left-3 flex gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
               </div>
               <motion.div 
                 initial={{ y: 20, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 transition={{ duration: 1, delay: 0.6 }}
                 className="mt-6 flex flex-col gap-2.5"
               >
                 <div><span className="text-pink-400">const</span> <span className="text-blue-400">knowledge</span> = <span className="text-yellow-300">await</span> <span className="text-[#dcdcaa]">learn</span>();</div>
                 <div><span className="text-gray-500">{"// Visualizing complexity..."}</span></div>
                 <div><span className="text-[#9cdcfe]">canvas</span>.<span className="text-[#dcdcaa]">render</span>(<span className="text-[#9cdcfe]">knowledge</span>);</div>
               </motion.div>
            </div>
        </motion.div>

      </div>
    </div>
  );
};

export default Auth;
