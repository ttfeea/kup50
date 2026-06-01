import { FormEvent, useEffect, useState } from 'react';
import { IntegrationSettingsPanel } from '../components/integrations/IntegrationSettingsPanel';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, updateProfile } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [fullname, setFullname] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [managerName, setManagerName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [managerEmail, setManagerEmail] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }

    setEmployeeId(user.employeeId);
    setFullname(user.name);
    setPosition(user.position);
    setDepartment(user.department);
    setManagerName(user.managerName);
  }, [user]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await updateProfile({
        fullname: fullname.trim(),
        employeeId: employeeId.trim(),
        position: position.trim(),
        department: department.trim(),
        managerName: managerName.trim(),
      });
      setMessage('Profile saved successfully.');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save profile.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Employee profile, work-source connections, and app preferences."
      />

      {message ? (
        <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted dark:text-slate-400">
            Configuration
          </h2>
          <p className="mt-1 text-sm text-ink-muted dark:text-slate-400">
            Update the profile fields used by report rows and saved to your account.
          </p>
        </div>

        <div className="grid gap-6">
          <Panel>
            <h3 className="text-base font-semibold text-ink dark:text-white">
              Employee profile
            </h3>
            <p className="mt-1 text-sm text-ink-muted dark:text-slate-400">
              Editable profile fields are stored in the database and reused in reports.
            </p>
            <form onSubmit={handleSave} className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-ink-muted dark:text-slate-400">
                  Employee ID
                </span>
                <input
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  placeholder="Enter employee ID"
                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                />
              </label>
              <label className="block">
                <span className="text-sm text-ink-muted dark:text-slate-400">
                  Full name
                </span>
                <input
                  value={fullname}
                  onChange={(event) => setFullname(event.target.value)}
                  placeholder="Enter full name"
                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                />
              </label>
              <label className="block">
                <span className="text-sm text-ink-muted dark:text-slate-400">
                  Email
                </span>
                <input
                  readOnly
                  value={user?.email ?? ''}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950"
                />
              </label>
              <label className="block">
                <span className="text-sm text-ink-muted dark:text-slate-400">
                  Title
                </span>
                <input
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                  placeholder="Enter title"
                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                />
              </label>
              <label className="block">
                <span className="text-sm text-ink-muted dark:text-slate-400">
                  Department
                </span>
                <input
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  placeholder="Enter department"
                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                />
              </label>
              <label className="block">
                <span className="text-sm text-ink-muted dark:text-slate-400">
                  Manager name
                </span>
                <input
                  value={managerName}
                  onChange={(event) => setManagerName(event.target.value)}
                  placeholder="Enter manager name"
                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                />
              </label>
              <div className="sm:col-span-2 flex flex-col gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? 'Saving…' : 'Save profile'}
                </button>
              </div>
            </form>
          </Panel>

          <IntegrationSettingsPanel />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted dark:text-slate-400">
            Preferences
          </h2>
        </div>
        <Panel>
          <h3 className="text-base font-semibold text-ink dark:text-white">
            Appearance
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(['light', 'dark'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTheme(mode)}
                className={`rounded-md border px-4 py-3 text-left text-sm font-medium capitalize ${
                  theme === mode
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </Panel>

        <Panel>
          <h3 className="text-base font-semibold text-ink dark:text-white">
            Report delivery
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm text-ink-muted dark:text-slate-400">
                Manager email
              </span>
              <input
                value={managerEmail}
                onChange={(event) => setManagerEmail(event.target.value)}
                placeholder="Enter manager email"
                className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
              />
              <p className="mt-2 text-xs text-ink-muted dark:text-slate-400">
                This field is prepared for future report email delivery configuration.
              </p>
            </label>
          </div>
        </Panel>
      </section>
    </div>
  );
}
