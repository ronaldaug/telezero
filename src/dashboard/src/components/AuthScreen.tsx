import React, { useState, useEffect } from 'react';

interface AuthScreenProps {
  onAuthenticated: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [isSetup, setIsSetup] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      if (data.authenticated) {
        onAuthenticated();
      } else {
        setIsSetup(!data.initialized);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Failed to check auth status:', err);
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const endpoint = isSetup ? '/api/auth/setup' : '/api/auth/login';
    const body = isSetup
      ? { email, password, confirmPassword }
      : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        onAuthenticated();
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-cyber-blue text-2xl animate-pulse font-mono tracking-widest">INITIALIZING AUTH...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 font-mono relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#00f2ff22_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="border-2 border-cyber-blue p-8 bg-black shadow-[0_0_30px_rgba(0,242,255,0.1)] backdrop-blur-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-cyber-blue tracking-tighter mb-2">
              TELEZERO
            </h1>
            <p className="text-xs font-bold text-cyber-blue tracking-tighter mb-4">{isSetup ? 'SIGNUP' : 'SIGNIN'}</p>
            <div className="h-1 w-full bg-cyber-blue opacity-30" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-cyber-blue text-xs uppercase tracking-widest mb-2 opacity-70">
                Identification (Email)
              </label>
              <input
                type="email"
                required
                autoComplete="off"
                className="w-full bg-black border border-cyber-blue/30 p-3 text-white focus:border-cyber-blue focus:outline-none transition-colors shadow-inner selection:bg-cyber-blue/30"
                style={{ colorScheme: 'dark' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="USER@TELEZERO.SYS"
              />
            </div>

            <div>
              <label className="block text-cyber-blue text-xs uppercase tracking-widest mb-2 opacity-70">
                Access Code (Password)
              </label>
              <input
                type="password"
                required
                className="w-full bg-black border border-cyber-blue/30 p-3 text-white focus:border-cyber-blue focus:outline-none transition-colors shadow-inner"
                style={{ colorScheme: 'dark' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
              />
            </div>

            {isSetup && (
              <div>
                <label className="block text-cyber-blue text-xs uppercase tracking-widest mb-2 opacity-70">
                  Verify Access Code
                </label>
                <input
                  type="password"
                  required
                  className="w-full bg-black border border-cyber-blue/30 p-3 text-white focus:border-cyber-blue focus:outline-none transition-colors shadow-inner"
                  style={{ colorScheme: 'dark' }}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="********"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-900/20 border border-red-500 p-3 text-red-500 text-sm uppercase tracking-tighter animate-pulse">
                ERROR: {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-cyber-blue text-black font-bold p-4 uppercase tracking-[0.2em] hover:bg-white transition-colors duration-300 shadow-[0_0_15px_rgba(0,242,255,0.4)]"
            >
              {isSetup ? 'Initialize System' : 'Establish Link'}
            </button>
          </form>

          <div className="mt-8 text-[10px] text-cyber-blue/40 uppercase tracking-widest flex justify-between">
            <span>SECURE_CONNECTION_v1.0</span>
            <span>ENCRYPTED_AES_256</span>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-cyber-blue" />
        <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-cyber-blue" />
        <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-cyber-blue" />
        <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-cyber-blue" />
      </div>
    </div>
  );
};
