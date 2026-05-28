import { IntegrationSettingsPanel } from '../components/integrations/IntegrationSettingsPanel';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';

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
        <IntegrationSettingsPanel />
      </div>
    </div>
  );
}
