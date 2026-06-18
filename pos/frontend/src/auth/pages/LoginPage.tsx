import { useState } from 'react';
import { AlertCircle, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import type { AuthenticatedUser } from '../types/auth';
import { login } from '../services/auth';
import logo from '../../imports/logo1.png';

interface LoginPageProps {
  onLogin: (user: AuthenticatedUser) => void;
}

const DEMO_ACCOUNT_GROUPS = [
  {
    key: 'superadmin',
    label: 'Superadmin',
    accounts: [
      { role: 'Superadmin', email: 'superadmin@gmail.com', pwd: 'superadmin123', accent: '#003534' },
    ],
  },
  {
    key: 'restaurant',
    label: 'Restaurant',
    accounts: [
      { role: 'Admin', email: 'restaurantadmin@gmail.com', pwd: 'restaurantadmin123', accent: '#007A5E' },
      { role: 'POS Staff', email: 'resstaff@pos.com', pwd: 'resstaffpos123', accent: '#0f766e' },
      { role: 'Inventory Staff', email: 'resstaff@inventory.com', pwd: 'resstaffinventory123', accent: '#2563eb' },
      { role: 'Manager', email: 'resstaff@manager.com', pwd: 'resstaffmanager123', accent: '#7c3aed' },
    ],
  },
  {
    key: 'retail',
    label: 'Retail',
    accounts: [
      { role: 'Admin', email: 'retailadmin@gmail.com', pwd: 'retailadmin123', accent: '#005656' },
      { role: 'POS Staff', email: 'retailstaff@pos.com', pwd: 'retailstaffpos123', accent: '#0f766e' },
      { role: 'Inventory Staff', email: 'retailstaff@inventory.com', pwd: 'retailstaffinventory123', accent: '#2563eb' },
      { role: 'Manager', email: 'retailstaff@manager.com', pwd: 'retailstaffmanager123', accent: '#7c3aed' },
    ],
  },
] as const;

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fillDemoAccount = (credential: { email: string; pwd: string }) => {
    setEmail(credential.email);
    setPassword(credential.pwd);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const user = await login(email.trim(), password);
      onLogin(user);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-6"
      style={{ background: 'linear-gradient(135deg, #003534 0%, #005656 50%, #003534 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="lava-blob lava-blob-top absolute left-1/2 top-[-14rem] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full opacity-60" />
        <div className="lava-blob lava-blob-right absolute right-[-7rem] top-1/2 h-[18rem] w-[18rem] -translate-y-1/2 rounded-full opacity-50" />
        <div className="lava-blob lava-blob-bottom absolute bottom-[-4rem] left-1/2 h-[13rem] w-[13rem] -translate-x-1/2 rounded-full opacity-55" />
        <div className="lava-blob lava-blob-left absolute left-[-9rem] top-1/2 h-[24rem] w-[24rem] -translate-y-1/2 rounded-full opacity-45" />
        <div className="absolute left-1/2 top-20 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-[rgba(0,122,94,0.05)] blur-3xl" />
      </div>

      <div className="relative z-10 grid w-full max-w-[1180px] overflow-hidden rounded-[22px] border border-white/10 shadow-2xl lg:grid-cols-[0.92fr_1.08fr]">
        <section className="flex min-h-[470px] flex-col justify-center bg-white/10 p-6 text-slate-100 backdrop-blur-xl sm:p-8 lg:min-h-[680px] lg:p-10">
          <div className="mx-auto w-full max-w-[500px]">
            <div className="mb-7 text-center">
              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center">
                <img src={logo} alt="N&Ns Logo" className="h-24 w-24 object-contain" />
              </div>
              <h1 className="mb-1 text-[32px] font-bold leading-tight tracking-normal text-white">Sign In</h1>
              <p className="text-base text-slate-300">Log in to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-base font-medium text-slate-300">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-[54px] w-full rounded-[14px] border border-white/12 bg-white/10 pl-12 pr-4 text-lg text-white outline-none transition placeholder:text-slate-500 focus:border-[#00A7A5] focus:ring-2 focus:ring-[#00A7A5]/20"
                    placeholder="Enter email address"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-base font-medium text-slate-300">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-[54px] w-full rounded-[14px] border border-white/12 bg-white/10 pl-12 pr-12 text-lg text-white outline-none transition placeholder:text-slate-500 focus:border-[#00A7A5] focus:ring-2 focus:ring-[#00A7A5]/20"
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-[14px] border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-[54px] w-full rounded-[14px] bg-gradient-to-br from-[#008967] to-[#00645e] text-lg font-semibold text-white transition hover:from-[#00a777] hover:to-[#005656] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          </div>
        </section>

        <section className="flex min-h-[470px] flex-col bg-[#F8FAFB] p-6 text-[#323B42] sm:p-8 lg:max-h-[680px] lg:p-9">
          <div className="mb-5">
            <h2 className="text-2xl font-bold tracking-normal">Demo accounts</h2>
          </div>

          <div className="demo-account-scroll min-h-0 flex-1 overflow-y-auto pr-2">
            <div className="space-y-5">
              {DEMO_ACCOUNT_GROUPS.map((group) => (
                <div key={group.key}>
                  <div className="mb-2 flex items-center gap-3">
                    <p className="shrink-0 text-sm font-bold uppercase tracking-wide text-[#6b7d83]">
                      {group.label}
                    </p>
                    <div className="h-px flex-1 bg-[#d9e2e2]" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {group.accounts.map((credential) => (
                      <button
                        key={credential.email}
                        type="button"
                        onClick={() => fillDemoAccount(credential)}
                        className="flex h-[82px] min-w-0 items-center gap-3 rounded-[14px] border border-[#d6e0e0] bg-white px-4 text-left transition hover:-translate-y-0.5 hover:border-[#005656]/40 hover:shadow-md"
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
                          style={{ background: credential.accent }}
                        >
                          {credential.role[0]}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-base font-bold leading-tight text-[#263238]">
                            {credential.role}
                          </span>
                          <span className="mt-0.5 block truncate text-sm leading-tight text-[#6b7d83]">
                            {credential.email}
                          </span>
                          <span className="mt-0.5 block truncate text-xs leading-tight text-[#7a8d93]">
                            pw: {credential.pwd}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <style>{`
        .lava-blob {
          background: radial-gradient(circle at 35% 35%, rgba(0,222,148,0.92), rgba(0,222,148,0.62) 43%, rgba(0,222,148,0.15) 70%, transparent 80%);
          box-shadow: inset 22px -28px 58px rgba(0,82,65,0.24), inset -18px 22px 58px rgba(170,255,223,0.16), 0 0 34px rgba(0,222,148,0.22);
        }

        .lava-blob-top {
          animation: blobMorph 18s ease-in-out infinite, clockwiseDriftTop 36s ease-in-out infinite;
        }

        .lava-blob-right {
          animation: blobMorphAlt 15s ease-in-out infinite -4s, counterClockwiseDriftRight 34s ease-in-out infinite;
        }

        .lava-blob-bottom {
          animation: blobMorphSmall 13s ease-in-out infinite -8s, clockwiseDriftBottom 32s ease-in-out infinite;
        }

        .lava-blob-left {
          animation: blobMorphWide 20s ease-in-out infinite -11s, counterClockwiseDriftLeft 38s ease-in-out infinite;
        }

        @keyframes blobMorph {
          0%, 100% { transform: translate(0, 0) scale(0.96) rotate(0deg); border-radius: 47% 53% 61% 39% / 44% 58% 42% 56%; }
          45% { transform: translate(56px, -18px) scale(1.06) rotate(24deg); border-radius: 41% 59% 57% 43% / 39% 64% 36% 61%; }
          72% { transform: translate(-18px, 36px) scale(1.12) rotate(36deg); border-radius: 62% 38% 39% 61% / 51% 43% 57% 49%; }
        }

        @keyframes blobMorphAlt {
          0%, 100% { transform: translate(0, 0) scale(1) rotate(0deg); border-radius: 55% 45% 48% 52% / 62% 38% 58% 42%; }
          35% { transform: translate(-34px, 28px) scale(1.14) rotate(-14deg); border-radius: 43% 57% 61% 39% / 45% 61% 39% 55%; }
          66% { transform: translate(18px, 62px) scale(0.92) rotate(-28deg); border-radius: 60% 40% 42% 58% / 58% 43% 57% 42%; }
        }

        @keyframes blobMorphSmall {
          0%, 100% { transform: translate(0, 0) scale(0.9) rotate(0deg); border-radius: 48% 52% 41% 59% / 44% 54% 46% 56%; }
          44% { transform: translate(46px, -38px) scale(1.2) rotate(20deg); border-radius: 61% 39% 58% 42% / 52% 42% 58% 48%; }
          76% { transform: translate(-18px, -68px) scale(0.96) rotate(34deg); border-radius: 42% 58% 47% 53% / 60% 39% 61% 40%; }
        }

        @keyframes blobMorphWide {
          0%, 100% { transform: translate(0, 0) scale(1.04) rotate(0deg); border-radius: 62% 38% 52% 48% / 46% 61% 39% 54%; }
          30% { transform: translate(-54px, -20px) scale(0.94) rotate(12deg); border-radius: 44% 56% 64% 36% / 58% 42% 49% 51%; }
          62% { transform: translate(-18px, -74px) scale(1.12) rotate(30deg); border-radius: 58% 42% 39% 61% / 43% 55% 45% 57%; }
        }

        @keyframes clockwiseDriftTop {
          0%, 100% { translate: -50% 0; }
          25% { translate: calc(-50% + 42px) 38px; }
          50% { translate: calc(-50% + 18px) 86px; }
          75% { translate: calc(-50% - 46px) 36px; }
        }

        @keyframes counterClockwiseDriftRight {
          0%, 100% { translate: 0 -50%; }
          25% { translate: -42px calc(-50% - 34px); }
          50% { translate: -86px calc(-50% + 12px); }
          75% { translate: -38px calc(-50% + 56px); }
        }

        @keyframes clockwiseDriftBottom {
          0%, 100% { translate: -50% 0; }
          25% { translate: calc(-50% - 34px) -30px; }
          50% { translate: calc(-50% + 10px) -76px; }
          75% { translate: calc(-50% + 48px) -22px; }
        }

        @keyframes counterClockwiseDriftLeft {
          0%, 100% { translate: 0 -50%; }
          25% { translate: 42px calc(-50% + 38px); }
          50% { translate: 88px calc(-50% - 8px); }
          75% { translate: 34px calc(-50% - 58px); }
        }

        .demo-account-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 167, 165, 0.4) transparent;
        }

        .demo-account-scroll::-webkit-scrollbar {
          width: 6px;
        }

        .demo-account-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .demo-account-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 167, 165, 0.3);
          border-radius: 999px;
        }

        .demo-account-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 167, 165, 0.5);
        }
      `}</style>
    </div>
  );
}
