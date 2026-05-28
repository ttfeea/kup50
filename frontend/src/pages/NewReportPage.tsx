import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { reportItems } from '../data/mockData';

export function NewReportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New report"
        description="Draft a KUP50 report from selected work items. This screen uses mock preview data."
        actions={
          <Link
            to="/report/1"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Preview report
          </Link>
        }
      />
      <Panel>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-ink dark:text-white">
            Select work items
          </h2>
          <span className="text-sm text-ink-muted dark:text-slate-400">
            {reportItems.length} mock items available
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {reportItems.map((item) => (
            <label
              key={item.title}
              className="flex gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800"
            >
              <input type="checkbox" defaultChecked className="mt-1 h-4 w-4" />
              <span>
                <span className="block text-sm font-medium">{item.title}</span>
                <span className="mt-1 block text-xs text-ink-muted dark:text-slate-400">
                  {item.source} · {item.type} · {item.status}
                </span>
              </span>
            </label>
          ))}
        </div>
      </Panel>
    </div>
  );
}
