import React, { useEffect, useState } from 'react';
import { BookOpen, Sparkles, ArrowRight, Feather } from 'lucide-react';
import { authenticate, authenticateWithOAuth, listOAuthProviders } from '../services/storyService';

export const AuthPage = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [providers, setProviders] = useState([]);

  useEffect(() => {
    listOAuthProviders().then(setProviders).catch(() => setProviders([]));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setError('');
    setIsLoading(true);
    try {
      const user = await authenticate(email, password, isLogin ? 'login' : 'register');
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = async (providerId) => {
    setError('');
    setIsLoading(true);
    try {
      const user = await authenticateWithOAuth(providerId);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OAuth sign-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#020617] text-white overflow-hidden">
      <div className="hidden lg:flex w-1/2 relative bg-indigo-950/20 items-center justify-center p-12 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />

        <div className="relative z-10 max-w-lg">
          <div className="mb-8 text-indigo-400"><BookOpen size={64} /></div>
          <h1 className="text-6xl font-serif font-bold mb-6 leading-tight">Craft Worlds.<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-sky-400">Weave Myths.</span></h1>
          <p className="text-xl text-slate-400 leading-relaxed mb-8">Bewritten is your practical co-author. Build characters, track plot arcs, and keep continuity tight.</p>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-slate-900/50 backdrop-blur-sm p-4 rounded-xl border border-slate-800"><Sparkles className="text-amber-400 mb-2" /><h3 className="font-bold text-slate-200">AI Collaboration</h3><p className="text-sm text-slate-500">Break writer's block quickly.</p></div>
            <div className="bg-slate-900/50 backdrop-blur-sm p-4 rounded-xl border border-slate-800"><Feather className="text-emerald-400 mb-2" /><h3 className="font-bold text-slate-200">World Building</h3><p className="text-sm text-slate-500">Track setting and events.</p></div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-950">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight text-white">{isLogin ? 'Welcome back' : 'Start your journey'}</h2>
            <p className="mt-2 text-sm text-slate-400">{isLogin ? 'Enter your credentials to access your library.' : 'Create an account to begin writing your masterpiece.'}</p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300">Email address</label>
                <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full rounded-xl bg-slate-900 border border-slate-700 text-white px-4 py-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-slate-600" placeholder="writer@bewritten.ai" />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300">Password</label>
                <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full rounded-xl bg-slate-900 border border-slate-700 text-white px-4 py-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-slate-600" placeholder="••••••••" />
              </div>
            </div>

            {error && <div className="text-sm text-red-400">{error}</div>}

            <button type="submit" disabled={isLoading} className="group relative flex w-full justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
              {isLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <span className="flex items-center gap-2">{isLogin ? 'Sign In' : 'Create Account'}<ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></span>}
            </button>
          </form>

          {providers.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-slate-500">Or continue with</div>
              <div className="grid grid-cols-2 gap-2">
                {providers.map((provider) => (
                  <button
                    key={provider.id}
                    disabled={isLoading || !provider.configured}
                    onClick={() => handleOAuth(provider.id)}
                    className="rounded-lg border border-slate-700 bg-slate-900/70 text-sm px-3 py-2 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {provider.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-center">
            <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
