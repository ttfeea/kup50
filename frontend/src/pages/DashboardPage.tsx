import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { recentReports, reportItems } from '../data/mockData';

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of recent KUP50 reporting activity and draft progress."
        actions={
          <Link
            to="/report/new"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            New report
          </Link>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Open draft', '1'],
          ['Preview items', '14'],
          ['Connected sources', '2'],
        ].map(([label, value]) => (
          <Panel key={label}>
            <p className="text-sm text-ink-muted dark:text-slate-400">
              {label}
            </p>
            <p className="mt-3 text-3xl font-semibold text-ink dark:text-white">
              {value}
            </p>
          </Panel>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <h2 className="text-base font-semibold text-ink dark:text-white">
            Recent reports
          </h2>
          <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
            {recentReports.map((report) => (
              <Link
                key={report.id}
                to="/report/1"
                className="grid grid-cols-3 gap-3 py-3 text-sm hover:text-emerald-700 dark:hover:text-emerald-300"
              >
                <span>{report.period}</span>
                <span>{report.status}</span>
                <span className="text-right">{report.items} items</span>
              </Link>
            ))}
          </div>
        </Panel>
        <Panel className="lg:col-span-2">
          <h2 className="text-base font-semibold text-ink dark:text-white">
            Latest work items
          </h2>
          <div className="mt-4 space-y-3">
            {reportItems.map((item) => (
              <div
                key={item.title}
                className="rounded-md bg-slate-50 p-3 dark:bg-slate-950"
              >
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-xs text-ink-muted dark:text-slate-400">
                  {item.source} · {item.type} · {item.status}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
