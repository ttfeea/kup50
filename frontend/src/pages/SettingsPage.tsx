import { FormEvent, useEffect, useState } from 'react';
import { IntegrationSettingsPanel } from '../components/integrations/IntegrationSettingsPanel';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import {
  DEFAULT_EMAIL_BODY,
  DEFAULT_EMAIL_SUBJECT,
} from '../constants/emailTemplates';
import { useAuth } from '../contexts/AuthContext';

const TEMPLATE_VARIABLES = [
  { label: 'Month', value: '{{month}}' },
  { label: 'Full name', value: '{{fullname}}' },
  { label: 'Employee ID', value: '{{employeeId}}' },
  { label: 'Manager', value: '{{managerName}}' },
  { label: 'Period start', value: '{{periodStart}}' },
  { label: 'Period end', value: '{{periodEnd}}' },
] as const;

export function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [fullname, setFullname] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [managerName, setManagerName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [managerEmail, setManagerEmail] = useState('');
  const [receiverEmail, setReceiverEmail] = useState('');
  const [emailSubjectTemplate, setEmailSubjectTemplate] = useState(
    DEFAULT_EMAIL_SUBJECT,
  );
  const [emailBodyTemplate, setEmailBodyTemplate] =
    useState(DEFAULT_EMAIL_BODY);
  const [templateTarget, setTemplateTarget] = useState<'subject' | 'body'>(
    'subject',
  );

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
    setReceiverEmail(user.reportReceiverEmail || user.managerEmail);
    setEmailSubjectTemplate(
      user.reportEmailSubjectTemplate || DEFAULT_EMAIL_SUBJECT,
    );
    setEmailBodyTemplate(user.reportEmailBodyTemplate || DEFAULT_EMAIL_BODY);
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

  async function handleSaveEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingEmail(true);
    setError(null);
    setMessage(null);

    try {
      await updateProfile({
        reportReceiverEmail: receiverEmail.trim(),
        reportEmailSubjectTemplate:
          emailSubjectTemplate.trim() || DEFAULT_EMAIL_SUBJECT,
        reportEmailBodyTemplate: emailBodyTemplate.trim() || DEFAULT_EMAIL_BODY,
      });
      setMessage('Email settings saved successfully.');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save email settings.',
      );
    } finally {
      setSavingEmail(false);
    }
  }

  function insertTemplateVariable(value: string) {
    if (templateTarget === 'subject') {
      setEmailSubjectTemplate((current) => `${current}${value}`);
      return;
    }

    setEmailBodyTemplate((current) => `${current}${value}`);
  }

  return (
    <div className="settings-page page-shell page-view space-y-8">
      <PageHeader
        title="Settings"
      />

      {message ? (
        <div className="rounded-[10px] border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[10px] border border-[rgba(255,45,107,0.30)] bg-[rgba(255,45,107,0.10)] px-4 py-3 text-sm text-[#ff6b9d]">
          {error}
        </div>
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted dark:text-slate-400">
            Configuration
          </h2>
        </div>

        <div className="grid gap-6">
          <Panel className="card-hover">
            <h3 className="text-base font-semibold text-ink dark:text-white">
              Profile settings
            </h3>
            <form
              onSubmit={(event) => {
                void handleSave(event);
              }}
              className="mt-4 grid gap-4 sm:grid-cols-2"
            >
              <label className="block">
                <span className="text-sm text-ink-muted dark:text-slate-400">
                  Employee ID
                </span>
                <input
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  placeholder="Enter employee ID"
                  className="input-glass mt-1 w-full"
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
                  className="input-glass mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="text-sm text-ink-muted dark:text-slate-400">
                  Email
                </span>
                <input
                  readOnly
                  value={user?.email ?? ''}
                  className="input-glass mt-1 w-full cursor-not-allowed opacity-60"
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
                  className="input-glass mt-1 w-full"
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
                  className="input-glass mt-1 w-full"
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
                  className="input-glass mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="text-sm text-ink-muted dark:text-slate-400">
                  Manager email
                </span>
                <input
                  type="email"
                  value={managerEmail}
                  onChange={(event) => setManagerEmail(event.target.value)}
                  placeholder="Enter manager email"
                  className="input-glass mt-1 w-full"
                />
              </label>
              <div className="sm:col-span-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? 'Saving...' : 'Save profile'}
                </button>
              </div>
            </form>
          </Panel>

          <IntegrationSettingsPanel />

          <Panel className="card-hover">
            <h3 className="text-base font-semibold text-ink dark:text-white">
              Email settings
            </h3>
            <form
              onSubmit={(event) => {
                void handleSaveEmail(event);
              }}
              className="mt-4 grid gap-4"
            >
              <label className="block">
                <span className="text-sm text-ink-muted dark:text-slate-400">
                  Receiver email
                </span>
                <input
                  type="email"
                  value={receiverEmail}
                  onChange={(event) => setReceiverEmail(event.target.value)}
                  placeholder={managerEmail || 'manager@example.com'}
                  className="input-glass mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="text-sm text-ink-muted dark:text-slate-400">
                  Subject template
                </span>
                <input
                  value={emailSubjectTemplate}
                  onChange={(event) =>
                    setEmailSubjectTemplate(event.target.value)
                  }
                  onFocus={() => setTemplateTarget('subject')}
                  className="input-glass mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="text-sm text-ink-muted dark:text-slate-400">
                  Body template
                </span>
                <textarea
                  value={emailBodyTemplate}
                  onChange={(event) => setEmailBodyTemplate(event.target.value)}
                  onFocus={() => setTemplateTarget('body')}
                  rows={6}
                  className="input-glass mt-1 w-full"
                />
              </label>
              <details className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200">
                  Dostępne zmienne: miesiąc, imię i nazwisko, ID pracownika,
                  manager, okres
                </summary>
                <p className="mt-2 text-xs text-ink-muted dark:text-slate-400">
                  Kliknij pole tematu lub treści, a następnie wybierz zmienną.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {TEMPLATE_VARIABLES.map((variable) => (
                    <button
                      key={variable.value}
                      type="button"
                      onClick={() => insertTemplateVariable(variable.value)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-primary hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      {variable.label}
                    </button>
                  ))}
                </div>
              </details>
              <div>
                <button
                  type="submit"
                  disabled={savingEmail}
                  className="btn-primary disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingEmail ? 'Saving...' : 'Save email settings'}
                </button>
              </div>
            </form>
          </Panel>
        </div>
      </section>

    </div>
  );
}
