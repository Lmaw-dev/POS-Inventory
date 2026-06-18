import { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, Tag, DollarSign, TrendingUp, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import logoImage from '../../imports/ims-logo.png';
import centerLogoImage from '../../imports/ims-logo-nobg.png';

interface LoginPageProps {
  onLogin: (email: string, password: string) => void;
}

const REMEMBERED_EMAIL_KEY = 'ims_remembered_email';

const DEMO_ACCOUNT_GROUPS = [
  {
    label: 'Superadmin',
    accounts: [
      { role: 'Superadmin', email: 'superadmin@gmail.com', pwd: 'superadmin123', color: '#003534' },
    ],
  },
  {
    label: 'Restaurant Accounts',
    accounts: [
      { role: 'Admin', email: 'restaurantadmin@gmail.com', pwd: 'restaurantadmin123', color: '#007A5E' },
      { role: 'POS Staff', email: 'resstaff@pos.com', pwd: 'resstaffpos123', color: '#0f766e' },
      { role: 'Inventory Staff', email: 'resstaff@inventory.com', pwd: 'resstaffinventory123', color: '#2563eb' },
      { role: 'Manager', email: 'resstaff@manager.com', pwd: 'resstaffmanager123', color: '#7c3aed' },
    ],
  },
  {
    label: 'Retail Accounts',
    accounts: [
      { role: 'Admin', email: 'retailadmin@gmail.com', pwd: 'retailadmin123', color: '#005656' },
      { role: 'POS Staff', email: 'retailstaff@pos.com', pwd: 'retailstaffpos123', color: '#0f766e' },
      { role: 'Inventory Staff', email: 'retailstaff@inventory.com', pwd: 'retailstaffinventory123', color: '#2563eb' },
      { role: 'Manager', email: 'retailstaff@manager.com', pwd: 'retailstaffmanager123', color: '#7c3aed' },
    ],
  },
];

const CSS_ANIMATIONS = `
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
  @keyframes floatX { 0%,100%{transform:translateX(0)} 50%{transform:translateX(8px)} }
  @keyframes floatD { 0%,100%{transform:translate(0,0)} 50%{transform:translate(6px,-6px)} }
  @keyframes spin-slow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes spin-back { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
  @keyframes pulse-orb { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:.9;transform:scale(1.3)} }
  @keyframes fade-up { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
`;

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]     = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [view, setView]                 = useState<'login' | 'forgot' | 'forgotSent'>('login');
  const [forgotEmail, setForgotEmail]   = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));

    if (rememberMe) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }

    setLoading(false);
    onLogin(email, password);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setView('forgotSent');
  };

  return (
    <div className="min-h-screen flex font-['Inter',sans-serif]">
      <style>{CSS_ANIMATIONS}</style>

      {/* ── Left Panel ────────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between relative overflow-hidden p-10"
        style={{ background: 'linear-gradient(135deg, #001e1e 0%, #003534 40%, #005656 80%, #007A5E 100%)' }}
      >
        {/* Background blurs */}
        <div className="absolute top-16 left-16 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-24 right-8 w-96 h-96 bg-white/10 rounded-full blur-3xl" />

        {/* Top logo + name */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-lg overflow-hidden">
            <img src={logoImage} alt="IMS Logo" className="w-full h-full object-contain p-1" />
          </div>
          <div>
            <p className="text-white font-bold text-xl leading-tight">Bukolabs.io</p>
            <p className="text-white/70 text-xs">Inventory Management System</p>
          </div>
        </div>

        {/* Center Illustration */}
        <div className="relative z-10 flex items-center justify-center flex-1">
          <div className="relative w-[300px] h-[300px] flex items-center justify-center">

            {/* Outer spinning ring */}
            <div
              className="absolute w-[260px] h-[260px] rounded-full border border-white/20"
              style={{ animation: 'spin-slow 30s linear infinite' }}
            >
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#00A7A5]/70 rounded-full" />
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#008967]/70 rounded-full" />
            </div>

            {/* Inner counter-spinning ring */}
            <div
              className="absolute w-[200px] h-[200px] rounded-full border border-dashed border-white/15"
              style={{ animation: 'spin-back 20s linear infinite' }}
            >
              <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#007A5E]/80 rounded-full" />
              <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#00A7A5]/80 rounded-full" />
            </div>

            {/* Center circular logo — inside the two rings */}
            <div
              className="relative z-10 w-28 h-28 rounded-full overflow-hidden flex items-center justify-center"
              style={{
                animation: 'float 5s ease-in-out infinite',
                background: 'rgba(0,30,30,0.6)',
                border: '2px solid rgba(0,167,165,0.35)',
                boxShadow: '0 0 30px rgba(0,167,165,0.45), 0 0 60px rgba(0,167,165,0.18)',
              }}
            >
              <img
                src={centerLogoImage}
                alt="IMS Logo"
                className="w-[85%] h-[85%] object-contain"
                style={{ filter: 'drop-shadow(0 0 8px rgba(0,167,165,0.9))' }}
              />
            </div>

            {/* Floating icon orbs */}
            <div
              className="absolute top-[10px] right-[30px] w-11 h-11 bg-[#00A7A5]/40 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm border border-white/20"
              style={{ animation: 'float 3.2s ease-in-out infinite 0.3s' }}
            >
              <Tag className="w-5 h-5 text-white" />
            </div>

            <div
              className="absolute top-[40px] left-[20px] w-10 h-10 bg-[#008967]/40 rounded-full flex items-center justify-center shadow-md backdrop-blur-sm border border-white/20"
              style={{ animation: 'float 4s ease-in-out infinite 0.8s' }}
            >
              <TrendingUp className="w-4 h-4 text-white" />
            </div>

            <div
              className="absolute bottom-[20px] left-[40px] w-12 h-12 bg-[#005656]/50 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm border border-white/20"
              style={{ animation: 'floatD 3.8s ease-in-out infinite 0.5s' }}
            >
              <DollarSign className="w-5 h-5 text-white" />
            </div>

            <div
              className="absolute bottom-[30px] right-[20px] w-9 h-9 bg-[#007A5E]/40 rounded-full flex items-center justify-center shadow-md backdrop-blur-sm border border-white/20"
              style={{ animation: 'floatX 3.5s ease-in-out infinite 1.2s' }}
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>

            <div
              className="absolute top-[120px] right-[8px] w-8 h-8 bg-[#009BA5]/35 rounded-full flex items-center justify-center border border-white/20"
              style={{ animation: 'float 4.5s ease-in-out infinite 1.8s' }}
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>

            {/* Particle dots */}
            <div className="absolute top-[70px] right-[80px] w-2 h-2 bg-white/40 rounded-full" style={{ animation: 'pulse-orb 2.5s ease-in-out infinite 0.4s' }} />
            <div className="absolute bottom-[70px] right-[65px] w-1.5 h-1.5 bg-[#00A7A5]/60 rounded-full" style={{ animation: 'pulse-orb 3s ease-in-out infinite 1s' }} />
            <div className="absolute top-[160px] left-[55px] w-2 h-2 bg-white/30 rounded-full" style={{ animation: 'pulse-orb 2.8s ease-in-out infinite 0.7s' }} />
            <div className="absolute top-[30px] left-[90px] w-1.5 h-1.5 bg-[#008967]/50 rounded-full" style={{ animation: 'pulse-orb 3.2s ease-in-out infinite 1.5s' }} />
            <div className="absolute bottom-[120px] right-[15px] w-2 h-2 bg-[#007A5E]/50 rounded-full" style={{ animation: 'pulse-orb 2.2s ease-in-out infinite 0.2s' }} />
          </div>
        </div>

        {/* Bottom marketing text */}
        <div className="relative z-10 text-white" style={{ animation: 'fade-up 1s ease-out' }}>
          <h2 className="text-3xl font-bold mb-3 leading-tight">Manage Your Inventory with Ease</h2>
          <p className="text-white/80 text-base leading-relaxed mb-6">
            Track items, manage stock levels, and streamline your retail operations with our platform.
          </p>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#00A7A5] rounded-full" />
              <span className="text-white/70 text-sm">Real-time tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#007A5E] rounded-full" />
              <span className="text-white/70 text-sm">Smart alerts</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#008967] rounded-full" />
              <span className="text-white/70 text-sm">Analytics</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#F8FAFB]">
        <div className="w-full max-w-md" style={{ animation: 'fade-up 0.6s ease-out' }}>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-full bg-white shadow-md overflow-hidden border border-[#00A7A5]/30">
              <img src={logoImage} alt="IMS Logo" className="w-full h-full object-contain p-1" />
            </div>
            <span className="font-bold text-[#005656] text-lg">Bukolabs.io</span>
          </div>

          {/* ── LOGIN VIEW ── */}
          {view === 'login' && (
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-[#323B42] mb-1">Welcome back</h2>
                <p className="text-[#6b7280] text-sm">Sign in to your account to continue</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 mb-5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[#323B42] mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@bukolabs.io"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#d1d5db] rounded-xl text-sm text-[#323B42] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#005656] focus:ring-2 focus:ring-[#005656]/15 transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#323B42] mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-11 py-2.5 bg-white border border-[#d1d5db] rounded-xl text-sm text-[#323B42] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#005656] focus:ring-2 focus:ring-[#005656]/15 transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#6b7280] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label
                    className="flex items-center gap-2 cursor-pointer group"
                    onClick={() => setRememberMe(!rememberMe)}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${rememberMe ? 'bg-[#005656] border-[#005656]' : 'border-[#d1d5db] bg-white group-hover:border-[#005656]/50'}`}>
                      {rememberMe && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-[#6b7280]">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => { setView('forgot'); setForgotEmail(email); }}
                    className="text-sm text-[#007A5E] hover:text-[#005656] font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-[#005656]/25 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #005656 0%, #007A5E 50%, #00A7A5 100%)' }}
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
                    : 'Sign In'}
                </button>
              </form>

              {/* Demo credentials */}
              <div className="mt-6">
                <div className="relative flex items-center mb-4">
                  <div className="flex-1 h-px bg-[#e5e7eb]" />
                  <span className="px-3 text-xs text-[#9ca3af] bg-[#F8FAFB]">Demo accounts</span>
                  <div className="flex-1 h-px bg-[#e5e7eb]" />
                </div>
                <div className="max-h-72 overflow-y-auto pr-1 space-y-3">
                  {DEMO_ACCOUNT_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                        {group.label}
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {group.accounts.map((cred) => (
                          <button
                            key={cred.email}
                            type="button"
                            onClick={() => {
                              setEmail(cred.email);
                              setPassword(cred.pwd);
                              setError('');
                            }}
                            className="p-3 rounded-xl border border-[#e5e7eb] bg-white hover:border-[#005656]/30 hover:bg-[#f0f7f7] transition-all text-left"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                                style={{ background: cred.color }}
                              >
                                {cred.role[0]}
                              </div>
                              <span className="text-xs font-semibold text-[#323B42] truncate">{cred.role}</span>
                            </div>
                            <p className="text-[10px] text-[#9ca3af] truncate">{cred.email}</p>
                            <p className="text-[10px] text-[#9ca3af] truncate">pw: {cred.pwd}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── FORGOT PASSWORD VIEW ── */}
          {view === 'forgot' && (
            <>
              <button
                onClick={() => setView('login')}
                className="flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#323B42] mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-[#323B42] mb-1">Reset password</h2>
                <p className="text-[#6b7280] text-sm">Enter your email and we'll send you a reset link.</p>
              </div>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#323B42] mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="you@bukolabs.io"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#d1d5db] rounded-xl text-sm text-[#323B42] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#005656] focus:ring-2 focus:ring-[#005656]/15 transition-all"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-70"
                  style={{ background: 'linear-gradient(135deg, #005656 0%, #007A5E 50%, #00A7A5 100%)' }}
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                    : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}

          {/* ── FORGOT SENT VIEW ── */}
          {view === 'forgotSent' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-[#323B42] mb-2">Check your email</h2>
              <p className="text-[#6b7280] text-sm mb-6">
                We've sent a reset link to{' '}
                <span className="font-medium text-[#323B42]">{forgotEmail}</span>
              </p>
              <button
                onClick={() => setView('login')}
                className="text-sm text-[#007A5E] hover:text-[#005656] font-medium flex items-center gap-1.5 mx-auto transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
