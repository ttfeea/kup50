import { FormEvent, useEffect, useMemo, useState } from 'react';
import { IntegrationSettingsPanel } from '../components/integrations/IntegrationSettingsPanel';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import {
  DEFAULT_EMAIL_BODY,
  DEFAULT_EMAIL_SUBJECT,
} from '../constants/emailTemplates';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';

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
  const { showSnackbar } = useSnackbar();
  const [employeeId, setEmployeeId] = useState('');
  const [fullname, setFullname] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [managerName, setManagerName] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [integrationDirty, setIntegrationDirty] = useState(false);
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
    setReceiverEmail(user.reportReceiverEmail || user.managerEmail);
    setEmailSubjectTemplate(
      user.reportEmailSubjectTemplate || DEFAULT_EMAIL_SUBJECT,
    );
    setEmailBodyTemplate(user.reportEmailBodyTemplate || DEFAULT_EMAIL_BODY);
  }, [user]);

  const profileDirty = useMemo(
    () =>
      Boolean(user) &&
      (employeeId !== user?.employeeId ||
        fullname !== user?.name ||
        position !== user?.position ||
        department !== user?.department ||
        managerName !== user?.managerName),
    [department, employeeId, fullname, managerName, position, user],
  );

  const emailDirty = useMemo(
    () =>
      Boolean(user) &&
      (receiverEmail !== (user?.reportReceiverEmail || user?.managerEmail) ||
        emailSubjectTemplate !==
          (user?.reportEmailSubjectTemplate || DEFAULT_EMAIL_SUBJECT) ||
        emailBodyTemplate !==
          (user?.reportEmailBodyTemplate || DEFAULT_EMAIL_BODY)),
    [emailBodyTemplate, emailSubjectTemplate, receiverEmail, user],
  );

  const dirty = profileDirty || emailDirty || integrationDirty;

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      const href = link.href;
      if (!href || link.target || href === window.location.href) {
        return;
      }

      event.preventDefault();
      if (window.confirm('Leave Settings and discard unsaved changes?')) {
        window.location.href = href;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [dirty]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      await updateProfile({
        fullname: fullname.trim(),
        employeeId: employeeId.trim(),
        position: position.trim(),
        department: department.trim(),
        managerName: managerName.trim(),
      });
      showSnackbar('Profile saved successfully.', 'success');
    } catch (saveError) {
      showSnackbar(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save profile.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingEmail(true);

    try {
      await updateProfile({
        reportReceiverEmail: receiverEmail.trim(),
        reportEmailSubjectTemplate:
          emailSubjectTemplate.trim() || DEFAULT_EMAIL_SUBJECT,
        reportEmailBodyTemplate: emailBodyTemplate.trim() || DEFAULT_EMAIL_BODY,
      });
      showSnackbar('Email settings saved successfully.', 'success');
    } catch (saveError) {
      showSnackbar(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save email settings.',
        'error',
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
      <PageHeader title="Settings" />

      {dirty ? (
        <div className="rounded-[10px] border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          You have unsaved settings changes.
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
              <div className="pt-1 sm:col-span-2">
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

          <IntegrationSettingsPanel onDirtyChange={setIntegrationDirty} />

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
                  placeholder="manager@example.com"
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
                  Available variables: month, full name, employee ID, manager,
                  period
                </summary>
                <p className="mt-2 text-xs text-ink-muted dark:text-slate-400">
                  Select the subject or body field, then choose a variable.
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
