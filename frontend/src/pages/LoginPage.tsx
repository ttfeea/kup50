import { ArrowRight, Moon, Sun } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export function LoginPage() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [lastEmail, setLastEmail] = useState(() =>
    localStorage.getItem('lastEmail'),
  );
  const [email, setEmail] = useState(lastEmail ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email.trim());
      navigate('/dashboard');
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : 'Sign in failed',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10 dark:bg-surface-dark">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-600 text-base font-bold text-white">
              K
            </div>
            <div>
              <h1 className="text-lg font-semibold text-ink dark:text-white">
                KUP50
              </h1>
              <p className="text-sm text-ink-muted dark:text-slate-400">
                Sign in
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-200"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>
        </div>
        <form className="space-y-4" onSubmit={handleLogin}>
          {lastEmail ? (
            <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
              <p className="font-medium">Welcome back</p>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('lastEmail');
                  setLastEmail(null);
                  setEmail('');
                }}
                className="mt-1 text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-300"
              >
                Use another email
              </button>
            </div>
          ) : null}
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Email
            </span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
            />
          </label>
          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Signing in...' : 'Continue'}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  );
}
