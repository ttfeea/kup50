import { CheckCircle2, PlugZap, RefreshCw, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  checkIntegration,
  disconnectIntegration,
  IntegrationProvider,
  IntegrationStatusDto,
  listIntegrations,
  saveIntegrationToken,
} from '../../api/integrations';
import { useAuth } from '../../contexts/AuthContext';
import { Panel } from '../ui/Panel';

const providers: Array<{ id: IntegrationProvider; label: string }> = [
  { id: 'JIRA', label: 'Jira' },
  { id: 'GITLAB', label: 'GitLab' },
  { id: 'GITHUB', label: 'GitHub' },
];

type ProviderForm = {
  token: string;
  baseUrl: string;
  accountEmail: string;
};

const emptyForm: ProviderForm = {
  token: '',
  baseUrl: '',
  accountEmail: '',
};

const statusStyles = {
  connected:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  error: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  missing: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

export function IntegrationSettingsPanel() {
  const { accessToken } = useAuth();
  const [integrations, setIntegrations] = useState<IntegrationStatusDto[]>([]);
  const [forms, setForms] = useState<Record<IntegrationProvider, ProviderForm>>(
    {
      JIRA: emptyForm,
      GITLAB: emptyForm,
      GITHUB: emptyForm,
    },
  );
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<IntegrationProvider | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const integrationsByProvider = useMemo(
    () =>
      new Map(
        integrations.map((integration) => [integration.provider, integration]),
      ),
    [integrations],
  );

  useEffect(() => {
    void loadIntegrations();
  }, [accessToken]);

  async function loadIntegrations() {
    if (!accessToken) {
      setLoading(false);
      setError('Sign in to manage integrations.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextIntegrations = await listIntegrations(accessToken);
      setIntegrations(nextIntegrations);
      setForms((current) => hydrateForms(current, nextIntegrations));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load integrations.',
      );
    } finally {
      setLoading(false);
    }
  }

  function updateForm(
    provider: IntegrationProvider,
    key: keyof ProviderForm,
    value: string,
  ) {
    setForms((current) => ({
      ...current,
      [provider]: {
        ...current[provider],
        [key]: value,
      },
    }));
  }

  async function handleSave(
    event: FormEvent<HTMLFormElement>,
    provider: IntegrationProvider,
  ) {
    event.preventDefault();

    if (!accessToken) {
      setError('Sign in to manage integrations.');
      return;
    }

    setBusyProvider(provider);
    setMessage(null);
    setError(null);

    try {
      const form = forms[provider];
      const saved = await saveIntegrationToken(accessToken, provider, {
        token: form.token,
        baseUrl: form.baseUrl || undefined,
        accountEmail: form.accountEmail || undefined,
      });

      mergeIntegration(saved);
      setForms((current) => ({
        ...current,
        [provider]: {
          ...current[provider],
          token: '',
        },
      }));
      setMessage(`${providerLabel(provider)} token saved.`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save token.',
      );
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleCheck(provider: IntegrationProvider) {
    if (!accessToken) {
      setError('Sign in to manage integrations.');
      return;
    }

    setBusyProvider(provider);
    setMessage(null);
    setError(null);

    try {
      const result = await checkIntegration(accessToken, provider);
      setMessage(result.message);
      await loadIntegrations();
    } catch (checkError) {
      setError(
        checkError instanceof Error
          ? checkError.message
          : 'Could not check connection.',
      );
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleDisconnect(provider: IntegrationProvider) {
    if (!accessToken) {
      setError('Sign in to manage integrations.');
      return;
    }

    setBusyProvider(provider);
    setMessage(null);
    setError(null);

    try {
      const disconnected = await disconnectIntegration(accessToken, provider);
      mergeIntegration(disconnected);
      setMessage(`${providerLabel(provider)} disconnected.`);
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : 'Could not disconnect integration.',
      );
    } finally {
      setBusyProvider(null);
    }
  }

  function mergeIntegration(nextIntegration: IntegrationStatusDto) {
    setIntegrations((current) => [
      ...current.filter(
        (integration) => integration.provider !== nextIntegration.provider,
      ),
      nextIntegration,
    ]);
    setForms((current) =>
      hydrateForms(current, [
        ...integrations.filter(
          (integration) => integration.provider !== nextIntegration.provider,
        ),
        nextIntegration,
      ]),
    );
  }

  return (
    <Panel>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink dark:text-white">
            Integrations
          </h2>
          <p className="mt-1 text-sm text-ink-muted dark:text-slate-400">
            Store personal access tokens for manual work-item fetches.
          </p>
        </div>
        <button
          type="button"
          onClick={loadIntegrations}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {message ? (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mt-4 space-y-4">
        {providers.map((provider) => {
          const integration = integrationsByProvider.get(provider.id);
          const form = forms[provider.id];
          const status = integration?.status ?? 'missing';
          const isBusy = busyProvider === provider.id;

          return (
            <form
              key={provider.id}
              onSubmit={(event) => handleSave(event, provider.id)}
              className="rounded-md border border-slate-200 p-4 dark:border-slate-800"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <PlugZap className="h-4 w-4 text-slate-500" />
                    <p className="text-sm font-medium">{provider.label}</p>
                    <span
                      className={`rounded-md px-2 py-1 text-xs ${statusStyles[status]}`}
                    >
                      {integration?.message ?? 'Integration is not connected'}
                    </span>
                  </div>
                  {integration?.tokenPreview ? (
                    <p className="mt-1 text-xs text-ink-muted dark:text-slate-400">
                      Token {integration.tokenPreview}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleCheck(provider.id)}
                    disabled={isBusy || loading}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    {isBusy ? 'Working...' : 'Check'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDisconnect(provider.id)}
                    disabled={isBusy || loading || status === 'missing'}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Disconnect
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <label className="block">
                  <span className="text-sm text-ink-muted dark:text-slate-400">
                    Token
                  </span>
                  <input
                    value={form.token}
                    onChange={(event) =>
                      updateForm(provider.id, 'token', event.target.value)
                    }
                    type="password"
                    placeholder="Paste token"
                    className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-ink-muted dark:text-slate-400">
                    Base URL
                  </span>
                  <input
                    value={form.baseUrl}
                    onChange={(event) =>
                      updateForm(provider.id, 'baseUrl', event.target.value)
                    }
                    placeholder={baseUrlPlaceholder(provider.id)}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-ink-muted dark:text-slate-400">
                    Account email
                  </span>
                  <input
                    value={form.accountEmail}
                    onChange={(event) =>
                      updateForm(
                        provider.id,
                        'accountEmail',
                        event.target.value,
                      )
                    }
                    placeholder={
                      provider.id === 'JIRA' ? 'Required for Jira' : 'Optional'
                    }
                    className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={isBusy || loading || !form.token}
                className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isBusy ? 'Saving...' : 'Save token'}
              </button>
            </form>
          );
        })}
      </div>
    </Panel>
  );
}

function hydrateForms(
  current: Record<IntegrationProvider, ProviderForm>,
  integrations: IntegrationStatusDto[],
) {
  return providers.reduce<Record<IntegrationProvider, ProviderForm>>(
    (nextForms, provider) => {
      const integration = integrations.find(
        (item) => item.provider === provider.id,
      );

      nextForms[provider.id] = {
        token: current[provider.id].token,
        baseUrl: integration?.baseUrl ?? current[provider.id].baseUrl,
        accountEmail:
          integration?.accountEmail ?? current[provider.id].accountEmail,
      };

      return nextForms;
    },
    { ...current },
  );
}

function providerLabel(provider: IntegrationProvider) {
  return providers.find((item) => item.id === provider)?.label ?? provider;
}

function baseUrlPlaceholder(provider: IntegrationProvider) {
  if (provider === 'JIRA') {
    return 'https://company.atlassian.net';
  }

  if (provider === 'GITLAB') {
    return 'https://gitlab.com';
  }

  return 'https://api.github.com';
}
