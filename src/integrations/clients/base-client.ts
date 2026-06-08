import { BadGatewayException, Logger } from '@nestjs/common';

export abstract class BaseClient {
  protected readonly logger = new Logger(this.constructor.name);

  protected async requestJson<T>(
    url: string,
    init: RequestInit,
    providerName: string,
  ): Promise<T> {
    const response = await fetch(url, init);

    const body = await response.text();

    if (!response.ok) {
      throw new BadGatewayException({
        message: `${providerName} request failed. Verify the token, base URL, and permissions.`,
        status: response.status,
        details: body.slice(0, 500),
      });
    }

    return body ? (JSON.parse(body) as T) : ({} as T);
  }
}
