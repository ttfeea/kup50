import { BadGatewayException, Logger } from '@nestjs/common';

export abstract class BaseClient {
  protected readonly logger = new Logger(this.constructor.name);

  protected async requestJson<T>(
    url: string,
    init: RequestInit,
    providerName: string,
  ): Promise<T> {
    this.logger.debug(
      `Calling ${providerName} endpoint=${url} method=${init.method ?? 'GET'}`,
    );

    const response = await fetch(url, init);

    const body = await response.text();

    this.logger.debug(
      `${providerName} response status=${response.status} body=${body.slice(0, 250)}`,
    );

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
