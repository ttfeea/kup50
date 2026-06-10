import { IntegrationProvider } from '../api/integrations';

export type IntegrationGuide = {
  baseUrl: {
    examples: string[];
    hint: string;
  };
  token: {
    hint: string;
    scopes: string[];
    createUrl?: string;
  };
  accountEmail?: {
    required: boolean;
    hint: string;
  };
};

export const integrationGuides: Record<IntegrationProvider, IntegrationGuide> =
  {
    GITLAB: {
      baseUrl: {
        examples: ['https://gitlab.com', 'https://gitlab.com/your-username'],
        hint: 'Use your GitLab instance root URL. Profile links are OK — only the host is used (not a login or project page).',
      },
      token: {
        hint: 'GitLab → Preferences → Access tokens. Create a personal access token (starts with glpat-).',
        scopes: ['read_api', 'read_user'],
        createUrl: 'https://gitlab.com/-/user_settings/personal_access_tokens',
      },
    },
    JIRA: {
      baseUrl: {
        examples: ['https://your-company.atlassian.net'],
        hint: 'Your Atlassian Cloud site URL (the same URL you use in the browser, without /wiki or /jira paths).',
      },
      token: {
        hint: 'Atlassian account → Security → API tokens. This is not your login password.',
        scopes: [
          'Jira product access on your account (API token inherits your site permissions)',
        ],
        createUrl:
          'https://id.atlassian.com/manage-profile/security/api-tokens',
      },
      accountEmail: {
        required: true,
        hint: 'The email address of your Atlassian account (used with the API token for authentication).',
      },
    },
    GITHUB: {
      baseUrl: {
        examples: ['https://api.github.com'],
        hint: 'Use the API host, not your profile page (e.g. github.com/ttfeea is not a base URL). For GitHub Enterprise Server, use your API root URL.',
      },
      token: {
        hint: 'Classic PAT recommended. Fine-grained tokens need Issues (read) and profile read access.',
        scopes: ['read:user', 'repo (required for commits on private repos)'],
        createUrl: 'https://github.com/settings/tokens',
      },
    },
  };
