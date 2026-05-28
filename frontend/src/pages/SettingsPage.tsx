import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { useTheme } from '../contexts/ThemeContext';

export function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Local frontend preferences for the mock application shell."
      />
      <Panel>
        <h2 className="text-base font-semibold text-ink dark:text-white">
          Appearance
        </h2>
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
    </div>
  );
}
