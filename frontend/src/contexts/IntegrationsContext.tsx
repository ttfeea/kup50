import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  IntegrationStatusDto,
  listIntegrations,
} from '../api/integrations';
import { useAuth } from './AuthContext';

type IntegrationsContextValue = {
  integrations: IntegrationStatusDto[];
  loading: boolean;
  error: string | null;
  refreshIntegrations: () => Promise<void>;
  upsertIntegration: (integration: IntegrationStatusDto) => void;
  connectedCount: number;
};

const IntegrationsContext = createContext<IntegrationsContextValue | undefined>(
  undefined,
);

export function IntegrationsProvider({ children }: PropsWithChildren) {
  const { accessToken } = useAuth();
  const [integrations, setIntegrations] = useState<IntegrationStatusDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshIntegrations = useCallback(async () => {
    if (!accessToken) {
      setIntegrations([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextIntegrations = await listIntegrations(accessToken);
      setIntegrations(nextIntegrations);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load integrations.',
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void refreshIntegrations();
  }, [refreshIntegrations]);

  const upsertIntegration = useCallback((integration: IntegrationStatusDto) => {
    setIntegrations((current) => [
      ...current.filter((item) => item.provider !== integration.provider),
      integration,
    ]);
  }, []);

  const connectedCount = useMemo(
    () => integrations.filter((item) => item.status === 'connected').length,
    [integrations],
  );

  const value = useMemo<IntegrationsContextValue>(
    () => ({
      integrations,
      loading,
      error,
      refreshIntegrations,
      upsertIntegration,
      connectedCount,
    }),
    [
      integrations,
      loading,
      error,
      refreshIntegrations,
      upsertIntegration,
      connectedCount,
    ],
  );

  return (
    <IntegrationsContext.Provider value={value}>
      {children}
    </IntegrationsContext.Provider>
  );
}

export function useIntegrations() {
  const context = useContext(IntegrationsContext);

  if (!context) {
    throw new Error('useIntegrations must be used within IntegrationsProvider');
  }

  return context;
}
