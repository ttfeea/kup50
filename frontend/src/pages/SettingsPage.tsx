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
    setManagerEmail(user.managerEmail);
  }, [user]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
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
        managerEmail: managerEmail.trim(),
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
    <div className="settings-page page-shell page-view space-y-8">
     
      <PageHeader
        title="Settings"
        description="Employee profile, work-source connections, and app preferences."
      />

      {message ? (
        <div className="rounded-[10px] border border-[rgba(157,0,255,0.25)] bg-[rgba(157,0,255,0.08)] px-4 py-3 text-sm text-[#d966ff]">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[10px] border border-[rgba(255,45,107,0.30)] bg-[rgba(255,45,107,0.10)] px-4 py-3 text-sm text-[#ff6b9d]">
          {error}
        </div>
      ) : null}

      {/* ── Configuration section ── */}
      <section className="space-y-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="section-bar" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
              Configuration
            </h2>
          </div>
          <p className="mt-1 pl-[19px] text-sm text-[var(--foreground-muted)]">
            Update the profile fields used by report rows and saved to your account.
          </p>
        </div>

        <div className="grid gap-6">
          {/* Employee profile panel */}
          <Panel className="card-hover">
            <div className="flex items-center gap-3 mb-1">
              <div className="section-bar" />
              <h3 className="text-base font-semibold text-[var(--foreground)]">
                Employee profile
              </h3>
            </div>
            <p className="mb-4 pl-[19px] text-sm text-[var(--foreground-muted)]">
              Editable profile fields are stored in the database and reused in reports.
            </p>
            <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
                  Employee ID
                </span>
                <input
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  placeholder="Enter employee ID"
                  className="mt-1 input-glass w-full"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
                  Full name
                </span>
                <input
                  value={fullname}
                  onChange={(event) => setFullname(event.target.value)}
                  placeholder="Enter full name"
                  className="mt-1 input-glass w-full"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
                  Email
                </span>
                <input
                  readOnly
                  value={user?.email ?? ''}
                  className="mt-1 input-glass w-full opacity-60 cursor-not-allowed"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
                  Title
                </span>
                <input
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                  placeholder="Enter title"
                  className="mt-1 input-glass w-full"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
                  Department
                </span>
                <input
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  placeholder="Enter department"
                  className="mt-1 input-glass w-full"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
                  Manager name
                </span>
                <input
                  value={managerName}
                  onChange={(event) => setManagerName(event.target.value)}
                  placeholder="Enter manager name"
                  className="mt-1 input-glass w-full"
                />
              </label>
              <div className="sm:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? 'Saving...' : 'Save profile'}
                </button>
              </div>
            </form>
          </Panel>

          <IntegrationSettingsPanel />
        </div>
      </section>

      {/* ── Preferences section ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="section-bar" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
            Preferences
          </h2>
        </div>

        

        {/* Report delivery panel */}
        <Panel className="card-hover">
          <div className="flex items-center gap-3 mb-4">
            <div className="section-bar" />
            <h3 className="text-base font-semibold text-[var(--foreground)]">
              Report delivery
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
                Manager email
              </span>
              <input
                value={managerEmail}
                onChange={(event) => setManagerEmail(event.target.value)}
                placeholder="Enter manager email"
                className="mt-1 input-glass w-full"
              />
              <p className="mt-2 text-xs text-[var(--foreground-faint)]">
                This profile field is saved with your account.
              </p>
            </label>
          </div>
        </Panel>
      </section>
    </div>
  );
}