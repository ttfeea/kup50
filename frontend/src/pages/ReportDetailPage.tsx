import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { reportItems } from '../data/mockData';

export function ReportDetailPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="May 2026 report"
        description="Preview of a draft report container with selected creative work evidence."
        actions={
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Submit draft
          </button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel>
          <h2 className="text-base font-semibold text-ink dark:text-white">
            Report metadata
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-ink-muted dark:text-slate-400">Employee</dt>
              <dd>Marta Kowalska</dd>
            </div>
            <div>
              <dt className="text-ink-muted dark:text-slate-400">Period</dt>
              <dd>May 2026</dd>
            </div>
            <div>
              <dt className="text-ink-muted dark:text-slate-400">Status</dt>
              <dd>Draft</dd>
            </div>
          </dl>
        </Panel>
        <Panel className="lg:col-span-2">
          <h2 className="text-base font-semibold text-ink dark:text-white">
            Included items
          </h2>
          <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
            {reportItems.map((item) => (
              <article key={item.title} className="py-4 first:pt-0 last:pb-0">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-xs text-ink-muted dark:text-slate-400">
                  {item.source} · {item.type} · {item.status}
                </p>
              </article>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
