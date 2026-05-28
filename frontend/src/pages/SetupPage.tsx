import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { integrations } from '../data/mockData';

export function SetupPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Setup"
        description="Prepare the employee profile and work sources before creating reports."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="text-base font-semibold text-ink dark:text-white">
            Employee profile
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {['Full name', 'Department', 'Position', 'Manager'].map((label) => (
              <label key={label} className="block">
                <span className="text-sm text-ink-muted dark:text-slate-400">
                  {label}
                </span>
                <input
                  readOnly
                  value={
                    label === 'Full name'
                      ? 'Marta Kowalska'
                      : label === 'Department'
                        ? 'Engineering'
                        : label === 'Position'
                          ? 'Frontend Engineer'
                          : 'Piotr Nowak'
                  }
                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                />
              </label>
            ))}
          </div>
        </Panel>
        <Panel>
          <h2 className="text-base font-semibold text-ink dark:text-white">
            Integrations
          </h2>
          <div className="mt-4 space-y-3">
            {integrations.map((integration) => (
              <div
                key={integration.name}
                className="flex items-center justify-between rounded-md border border-slate-200 p-3 dark:border-slate-800"
              >
                <div>
                  <p className="text-sm font-medium">{integration.name}</p>
                  <p className="text-xs text-ink-muted dark:text-slate-400">
                    {integration.detail}
                  </p>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                  {integration.status}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
