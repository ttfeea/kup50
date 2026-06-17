import {
  CheckCircle2,
  Eye,
  EyeOff,
  PlugZap,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  checkIntegration,
  disconnectIntegration,
  saveIntegrationToken,
} from '../../services/integrations';
import { useAuth } from '../../contexts/AuthContext';
import { useIntegrations } from '../../contexts/IntegrationsContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
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
  tokenChanged: boolean;
};

const emptyForm: ProviderForm = {
  token: '',
  baseUrl: '',
  accountEmail: '',
  tokenChanged: false,
};

const statusStyles = {
  connected: 'border border-success/30 bg-success/10 text-success',
  error: 'border border-red-400/25 bg-red-400/10 text-red-200',
  missing: 'border border-white/10 bg-white/5 text-[#eae9fc]',
};

type IntegrationSettingsPanelProps = {
  className?: string;
  onDirtyChange?: (dirty: boolean) => void;
};

export function IntegrationSettingsPanel({
  className,
  onDirtyChange,
}: IntegrationSettingsPanelProps) {
  const { accessToken } = useAuth();
  const { showSnackbar } = useSnackbar();
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
  const [visibleTokens, setVisibleTokens] = useState<
    Record<IntegrationProvider, boolean>
  >({
    JIRA: false,
    GITLAB: false,
    GITHUB: false,
  });

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

  const dirty = useMemo(
    () =>
      providers.some((provider) => {
        const integration = integrationsByProvider.get(provider.id);
        const form = forms[provider.id];

        return (
          form.tokenChanged ||
          form.baseUrl !== (integration?.baseUrl ?? '') ||
          form.accountEmail !== (integration?.accountEmail ?? '')
        );
      }),
    [forms, integrationsByProvider],
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (integrationsError) {
      showSnackbar(integrationsError, 'error');
    }
  }, [integrationsError, showSnackbar]);

  function updateForm(
    provider: IntegrationProvider,
    key: Exclude<keyof ProviderForm, 'tokenChanged'>,
    value: string,
  ) {
    const savedTokenDisplay = savedTokenLabel(
      integrationsByProvider.get(provider)?.tokenPreview,
    );

    setForms((current) => ({
      ...current,
      [provider]: {
        ...current[provider],
        [key]: value,
        ...(key === 'token'
          ? { tokenChanged: value !== savedTokenDisplay }
          : {}),
      },
    }));
  }

  function notifyError(message: string) {
    showSnackbar(message, 'error');
  }

  async function handleSave(
    event: FormEvent<HTMLFormElement>,
    provider: IntegrationProvider,
  ) {
    event.preventDefault();

    if (!accessToken) {
      notifyError('Sign in to manage integrations.');
      return;
    }

    const form = forms[provider];
    if (!form.tokenChanged || !form.token.trim()) {
      notifyError('Paste a new token before saving.');
      return;
    }

    setBusyProvider(provider);

    try {
      const saved = await saveIntegrationToken(accessToken, provider, {
        token: form.token.trim(),
        baseUrl: form.baseUrl.trim() || undefined,
        accountEmail: form.accountEmail.trim() || undefined,
      });

      upsertIntegration(saved);
      setForms((current) => ({
        ...current,
        [provider]: {
          ...current[provider],
          token: savedTokenLabel(saved.tokenPreview),
          tokenChanged: false,
        },
      }));

      showSnackbar(
        `${providerLabel(provider)} token saved. Check the connection when ready.`,
        'warning',
      );
      await refreshIntegrations();
    } catch (saveError) {
      notifyError(
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
      notifyError('Sign in to manage integrations.');
      return;
    }

    setBusyProvider(provider);

    try {
      const result = await checkIntegration(accessToken, provider);
      upsertIntegration(result);
      showSnackbar(
        result.message,
        result.status === 'connected'
          ? 'success'
          : result.status === 'error'
            ? 'error'
            : 'warning',
      );
      await refreshIntegrations();
    } catch (checkError) {
      notifyError(
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
      notifyError('Sign in to manage integrations.');
      return;
    }

    setBusyProvider(provider);

    try {
      const disconnected = await disconnectIntegration(accessToken, provider);
      upsertIntegration(disconnected);
      await refreshIntegrations();
      showSnackbar(`${providerLabel(provider)} disconnected.`, 'warning');
    } catch (disconnectError) {
      notifyError(
        disconnectError instanceof Error
          ? disconnectError.message
          : 'Could not disconnect integration.',
      );
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <Panel className={`card-hover ${className ?? ''}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-ink dark:text-white">
            Integration settings
          </h3>
          <p className="mt-1 text-xs text-[#eae9fc]">
            Save stores credentials. Check validates the saved credentials.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void refreshIntegrations();
          }}
          disabled={loading}
          className="btn-outline px-4 py-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {dirty ? (
        <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          You have unsaved integration changes.
        </p>
      ) : null}

      <div className="mt-5 grid gap-4">
        {providers.map((provider) => {
          const integration = integrationsByProvider.get(provider.id);
          const form = forms[provider.id];
          const status = integration?.status ?? 'missing';
          const isBusy = busyProvider === provider.id;
          const guide = integrationGuides[provider.id];
          const hasSavedToken = Boolean(integration?.tokenPreview);
          const canRevealToken = form.tokenChanged && form.token.length > 0;

          return (
            <form
              key={provider.id}
              onSubmit={(event) => {
                void handleSave(event, provider.id);
              }}
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PlugZap className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-[#eae9fc]">
                      {provider.label}
                      {provider.id === 'JIRA' ? '' : ' (optional)'}
                    </p>
                    <span
                      className={`max-w-full rounded-full px-2.5 py-1 text-xs ${statusStyles[status]}`}
                    >
                      {integration?.message ?? 'Integration is not connected'}
                    </span>
                  </div>
                  {integration?.tokenPreview ? (
                    <p className="mt-1 text-xs text-ink-muted dark:text-slate-400">
                      Saved token {integration.tokenPreview}
                    </p>
                  ) : null}
                  <IntegrationGuideHint guide={guide} />
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      void handleCheck(provider.id);
                    }}
                    disabled={isBusy || loading || !hasSavedToken}
                    className="btn-outline px-3 py-2 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    {isBusy ? 'Working...' : 'Check'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleDisconnect(provider.id);
                    }}
                    disabled={isBusy || loading || !hasSavedToken}
                    className="btn-outline border-red-400/25 px-3 py-2 text-red-200 disabled:cursor-not-allowed disabled:opacity-70"
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
                  <div className="relative mt-1">
                    <input
                      value={form.token}
                      onFocus={(event) => event.currentTarget.select()}
                      onChange={(event) =>
                        updateForm(provider.id, 'token', event.target.value)
                      }
                      type={
                        visibleTokens[provider.id] && canRevealToken
                          ? 'text'
                          : 'password'
                      }
                      placeholder={
                        integration?.tokenPreview
                          ? savedTokenLabel(integration.tokenPreview)
                          : 'Paste token'
                      }
                      className="input-glass w-full pr-12"
                    />
                    {canRevealToken ? (
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleTokens((current) => ({
                            ...current,
                            [provider.id]: !current[provider.id],
                          }))
                        }
                        className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#eae9fc] hover:bg-white/10"
                        aria-label={
                          visibleTokens[provider.id]
                            ? 'Hide token'
                            : 'Show token'
                        }
                        title={
                          visibleTokens[provider.id]
                            ? 'Hide token'
                            : 'Show token'
                        }
                      >
                        {visibleTokens[provider.id] ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    ) : null}
                  </div>
                  {hasSavedToken && !form.tokenChanged ? (
                    <p className="mt-1 text-xs text-[#eae9fc]">
                      Saved tokens cannot be revealed. Paste a new token to
                      replace it.
                    </p>
                  ) : null}
                </label>
                <label className="block">
                  <span className="text-sm text-ink-muted dark:text-slate-400">
                    Base URL{provider.id === 'JIRA' ? '' : ' (optional)'}
                  </span>
                  <input
                    value={form.baseUrl}
                    onChange={(event) =>
                      updateForm(provider.id, 'baseUrl', event.target.value)
                    }
                    placeholder={baseUrlPlaceholder(provider.id)}
                    className="input-glass mt-1 w-full"
                  />
                </label>
                {guide.accountEmail?.required ? (
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
                      placeholder="you@company.com"
                      className="input-glass mt-1 w-full"
                    />
                  </label>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={
                  isBusy || loading || !form.tokenChanged || !form.token
                }
                className="btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
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
      const currentForm = current[provider.id];

      nextForms[provider.id] = {
        token: currentForm.tokenChanged
          ? currentForm.token
          : savedTokenLabel(integration?.tokenPreview),
        tokenChanged: currentForm.tokenChanged,
        baseUrl: integration?.baseUrl ?? currentForm.baseUrl,
        accountEmail: integration?.accountEmail ?? currentForm.accountEmail,
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

function savedTokenLabel(tokenPreview?: string) {
  return tokenPreview ? `Saved token ${tokenPreview}` : '';
}

function IntegrationGuideHint({
  guide,
}: {
  guide: (typeof integrationGuides)[IntegrationProvider];
}) {
  return (
    <details className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3 text-xs text-[#eae9fc]">
      <summary className="cursor-pointer font-medium text-[#eae9fc]">
        What to paste
      </summary>
      <ul className="mt-2 list-inside list-disc space-y-1.5">
        <li>
          <span className="font-medium">Base URL:</span>{' '}
          {guide.baseUrl.examples.map((example, index) => (
            <span key={example}>
              {index > 0 ? ' or ' : null}
              <code className="rounded bg-black/25 px-1 py-0.5 font-mono text-[11px]">
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
                className="font-medium text-primary underline underline-offset-2"
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
    </details>
  );
}
