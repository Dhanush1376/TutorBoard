import { LogOut, Settings, CreditCard, User, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useTutorStore from '../../store/tutorStore';

const AccountMenu = ({ onSettingsClick, variant = 'full', layoutView = 'right' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);
  const isLeftHand = layoutView === 'left';
  const { user, logout } = useAuth();
  const { sessionManifest, guestTrialStatus } = useTutorStore(state => ({
    sessionManifest: state.sessionManifest || {},
    guestTrialStatus: state.guestTrialStatus
  }));
  
  const isGuest = !!user?.isGuest;
  const sessionLimit = 3; // soft limit context
  
  // Interaction limit from backend
  const { count: usageCount, limit: usageLimit, warning: usageWarning } = guestTrialStatus;
  const usageProgress = Math.min(100, (usageCount / usageLimit) * 100);
  
  // Get initials
  const initials = user?.name 
    ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'G';

  const handleLogout = () => {
    logout();
  };

  if (variant === 'compact') {
    return (
      <div className="relative" ref={menuRef}>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2.5 p-1 px-2 rounded-full transition-all border ${isOpen ? 'bg-[var(--bg-tertiary)] border-[var(--border-color)]' : 'border-transparent hover:border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]'}`}
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] uppercase tracking-wider shadow-sm transition-transform hover:scale-105 ${isGuest ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-[var(--border-color)]' : 'bg-[var(--text-primary)] text-[var(--bg-primary)]'}`}>
            {isGuest ? 'G' : initials}
          </div>
          <div className="flex flex-col flex-1 items-start pr-1 overflow-hidden min-w-0">
             <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate max-w-[80px]">
               {user?.name || 'Guest'}
             </span>
          </div>
        </button>

        {/* Dropdown Menu - Top orientation (aligned based on hand view) */}
        <div 
          className={`absolute top-full ${isLeftHand ? 'left-0' : 'right-0'} pt-2 w-56 transition-all duration-300 ease-spring z-[100] ${isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-1 pointer-events-none'}`}
        >
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-1.5 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 mb-1 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
               <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs uppercase tracking-wider ${isGuest ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-[var(--border-color)]' : 'bg-[var(--text-primary)] text-[var(--bg-primary)]'}`}>
                    {isGuest ? 'G' : initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <p className="text-[13px] font-bold text-[var(--text-primary)] truncate">{user?.name || 'Guest User'}</p>
                      {isGuest && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-[var(--text-primary)]/10 text-[var(--text-primary)] text-[8px] font-black uppercase tracking-tighter border border-[var(--text-primary)]/20 shadow-sm">
                          Trial
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-medium text-[var(--text-tertiary)] truncate">{user?.email || 'guest@tutorboard.app'}</p>
                  </div>
               </div>
            </div>
            
            {isGuest && (
              <div className={`px-4 py-3 border-b border-[var(--border-color)] ${usageWarning ? 'bg-amber-500/5' : 'bg-[var(--bg-primary)]'}`}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${usageWarning ? 'text-amber-500' : 'text-[var(--text-secondary)]'}`}>
                    {usageWarning ? 'Trial Near Limit' : 'Trial Usage'}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--text-primary)]">{usageCount}/{usageLimit} interactions</span>
                </div>
                <div className="h-1.5 w-full bg-[var(--bg-tertiary)] rounded-full overflow-hidden border border-[var(--border-color)]/30">
                  <div 
                    className={`h-full transition-all duration-1000 ease-out ${usageWarning ? 'bg-amber-500' : 'bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-secondary)]'}`} 
                    style={{ width: `${usageProgress}%` }} 
                  />
                </div>
              </div>
            )}
            
            <div className="p-1 space-y-0.5">

              {isGuest && (
                <button 
                  onClick={() => { setIsOpen(false); onSettingsClick('appearance'); }}
                  className="w-full flex items-center gap-3 p-2.5 hover:bg-[var(--bg-tertiary)] rounded-xl text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-left"
                >
                  <Settings size={15} />
                  Settings
                </button>
              )}

              {isGuest ? (
                <button 
                  onClick={() => { setIsOpen(false); logout(); }}
                  className="w-full flex items-center justify-between p-2.5 px-3 bg-amber-500 text-black rounded-xl text-[11px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg group mt-2"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="animate-pulse" />
                    Claim Full Profile
                  </div>
                  <ChevronRight size={12} className="opacity-50" />
                </button>
              ) : (
                <button className="w-full flex items-center gap-3 p-2.5 hover:bg-[var(--bg-tertiary)] rounded-xl text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-left">
                  <CreditCard size={15} />
                  Subscription
                </button>
              )}
              
              <div className="h-[1px] bg-[var(--border-color)] my-1.5 mx-2" />
              
              <button 
                onClick={() => { setIsOpen(false); handleLogout(); }} 
                className="w-full flex items-center gap-3 p-2.5 hover:bg-red-500/10 rounded-xl text-[13px] font-medium text-red-500 transition-colors text-left"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full mb-1" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 p-2 rounded-2xl transition-all border ${isOpen ? 'bg-[var(--bg-tertiary)] border-[var(--border-color)]' : 'border-transparent hover:border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]'}`}
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] uppercase tracking-wider shadow-sm ${isGuest ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-[var(--border-color)]' : 'bg-[var(--text-primary)] text-[var(--bg-primary)]'}`}>
          {isGuest ? 'G' : initials}
        </div>
        <div className="flex-1 text-left whitespace-nowrap overflow-hidden">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{user?.name || 'Loading...'}</p>
            {isGuest && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--text-primary)]/10 text-[var(--text-primary)] text-[7px] font-black uppercase tracking-tighter border border-[var(--text-primary)]/20">Trial</span>
            )}
          </div>
        </div>
      </button>

      {/* Context menu on click - Sidebar orientation (bottom-up) */}
      <div 
        className={`absolute bottom-full left-0 w-full pb-2 transition-all duration-300 ease-spring z-[100] ${isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-1 pointer-events-none'}`}
      >
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[18px] p-1.5 shadow-2xl">
          
          {isGuest ? (
            <div className={`p-2.5 px-3 mb-2 rounded-xl border transition-colors ${usageWarning ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[var(--bg-tertiary)] border-[var(--border-color)]/50'}`}>
               <div className="flex justify-between items-center mb-2">
                  <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${usageWarning ? 'text-amber-500' : 'text-amber-500/80'}`}>
                    {usageWarning ? 'Trial Near Limit' : 'Trial Usage'}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">
                    {usageCount}/{usageLimit}
                  </span>
               </div>
               <div className="h-1.5 w-full bg-[var(--bg-primary)] rounded-full overflow-hidden border border-[var(--border-color)]/10">
                  <div 
                    className={`h-full transition-all duration-1000 ease-out ${usageWarning ? 'bg-amber-500' : 'bg-amber-500/60'}`} 
                    style={{ width: `${usageProgress}%` }} 
                  />
               </div>
               
               <div className="mt-3 space-y-1">
                 <button 
                   onClick={() => { setIsOpen(false); onSettingsClick('appearance'); }}
                   className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 transition-all"
                 >
                   <Settings size={12} />
                   Trial Settings
                 </button>
                 <button 
                   onClick={() => { setIsOpen(false); logout(); }}
                   className="w-full p-2.5 bg-amber-500 text-black rounded-lg text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-[0_4px_12px_rgba(245,158,11,0.2)]"
                 >
                   <Sparkles size={12} />
                   Create Official Account
                 </button>
               </div>
            </div>
          ) : (
            <button className="w-full flex items-center gap-3 p-2.5 hover:bg-[var(--bg-tertiary)] rounded-xl text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-left">
              <CreditCard size={15} />
              Subscription
            </button>
          )}
          
          {!isGuest && <div className="h-[1px] bg-[var(--border-color)] my-1.5 mx-2" />}
          <button 
            onClick={() => { setIsOpen(false); handleLogout(); }} 
            className="w-full flex items-center gap-3 p-2.5 hover:bg-red-500/10 rounded-xl text-[13px] font-medium text-red-500 transition-colors text-left"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountMenu;
