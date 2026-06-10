import { CheckCircle2, PlugZap, RefreshCw, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  checkIntegration,
  disconnectIntegration,
  saveIntegrationToken,
} from '../../services/integrations';
import { useAuth } from '../../contexts/AuthContext';
import { useIntegrations } from '../../contexts/IntegrationsContext';
import { integrationGuides } from '../../data/integrationGuides';
import type {
  IntegrationProvider,
  IntegrationStatusDto,
} from '../../models/dtos/integration.dto';
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

type IntegrationSettingsPanelProps = {
  className?: string;
};

export function IntegrationSettingsPanel({
  className,
}: IntegrationSettingsPanelProps) {
  const { accessToken } = useAuth();
  const {
    integrations,
    loading,
    error: integrationsError,
    refreshIntegrations,
    upsertIntegration,
  } = useIntegrations();
  const [forms, setForms] = useState<Record<IntegrationProvider, ProviderForm>>(
    {
      JIRA: emptyForm,
      GITLAB: emptyForm,
      GITHUB: emptyForm,
    },
  );
  const [busyProvider, setBusyProvider] = useState<IntegrationProvider | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? integrationsError;

  const integrationsByProvider = useMemo(
    () =>
      new Map(
        integrations.map((integration) => [integration.provider, integration]),
      ),
    [integrations],
  );

  useEffect(() => {
    setForms((current) => hydrateForms(current, integrations));
  }, [integrations]);

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
      setActionError('Sign in to manage integrations.');
      return;
    }

    setBusyProvider(provider);
    setMessage(null);
    setActionError(null);

    try {
      const form = forms[provider];
      const trimmedToken = form.token.trim();
      const trimmedBaseUrl = form.baseUrl.trim();
      const trimmedAccountEmail = form.accountEmail.trim();

      const saved = await saveIntegrationToken(accessToken, provider, {
        token: trimmedToken,
        baseUrl: trimmedBaseUrl || undefined,
        accountEmail: trimmedAccountEmail || undefined,
      });

      upsertIntegration(saved);
      setForms((current) => ({
        ...current,
        [provider]: {
          ...current[provider],
          token: '',
        },
      }));

      setMessage(
        `${providerLabel(provider)} token saved. Use Check connection to validate it.`,
      );
      await refreshIntegrations();
    } catch (saveError) {
      setActionError(
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
      setActionError('Sign in to manage integrations.');
      return;
    }

    setBusyProvider(provider);
    setMessage(null);
    setActionError(null);

    try {
      const result = await checkIntegration(accessToken, provider);
      upsertIntegration(result);
      setMessage(result.message);
      await refreshIntegrations();
    } catch (checkError) {
      setActionError(
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
      setActionError('Sign in to manage integrations.');
      return;
    }

    setBusyProvider(provider);
    setMessage(null);
    setActionError(null);

    try {
      const disconnected = await disconnectIntegration(accessToken, provider);
      upsertIntegration(disconnected);
      await refreshIntegrations();
      setMessage(`${providerLabel(provider)} disconnected.`);
    } catch (disconnectError) {
      setActionError(
        disconnectError instanceof Error
          ? disconnectError.message
          : 'Could not disconnect integration.',
      );
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <Panel className={className}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-ink dark:text-white">
            Integration settings
          </h3>
          <p className="mt-1 text-sm text-ink-muted dark:text-slate-400">
            Save a token, then use Check connection to verify. See each provider
            for the exact URL and scopes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void refreshIntegrations();
          }}
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
          const guide = integrationGuides[provider.id];

          return (
            <form
              key={provider.id}
              onSubmit={(event) => {
                void handleSave(event, provider.id);
              }}
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
                  <IntegrationGuideHint guide={guide} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void handleCheck(provider.id);
                    }}
                    disabled={isBusy || loading}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    {isBusy ? 'Working...' : 'Check'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleDisconnect(provider.id);
                    }}
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
                {guide.accountEmail?.required ? (
                  <label className="block">
                    <span className="text-sm text-ink-muted dark:text-slate-400">
                      Account email
                      <span className="text-red-600 dark:text-red-400">
                        {' '}
                        (required)
                      </span>
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
                      placeholder="you@company.com"
                      className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                    />
                  </label>
                ) : null}
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
  return integrationGuides[provider].baseUrl.examples[0] ?? '';
}

function IntegrationGuideHint({
  guide,
}: {
  guide: (typeof integrationGuides)[IntegrationProvider];
}) {
  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300">
      <p className="font-medium text-slate-700 dark:text-slate-200">
        What to paste
      </p>
      <ul className="mt-2 list-inside list-disc space-y-1.5">
        <li>
          <span className="font-medium">Base URL:</span>{' '}
          {guide.baseUrl.examples.map((example, index) => (
            <span key={example}>
              {index > 0 ? ' or ' : null}
              <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px] dark:bg-slate-950">
                {example}
              </code>
            </span>
          ))}
          . {guide.baseUrl.hint}
        </li>
        <li>
          <span className="font-medium">Token scopes:</span>{' '}
          {guide.token.scopes.join(', ')}. {guide.token.hint}
          {guide.token.createUrl ? (
            <>
              {' '}
              <a
                href={guide.token.createUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-300"
              >
                Create token
              </a>
            </>
          ) : null}
        </li>
        {guide.accountEmail ? (
          <li>
            <span className="font-medium">Account email:</span>{' '}
            {guide.accountEmail.hint}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
