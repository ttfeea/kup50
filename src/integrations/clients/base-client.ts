import { BadGatewayException } from '@nestjs/common';

export abstract class BaseClient {
  protected async requestJson<T>(
    url: string,
    init: RequestInit,
    providerName: string,
  ): Promise<T> {
    const response = await fetch(url, init);

    if (!response.ok) {
      const body = await response.text();
      throw new BadGatewayException({
        message: `${providerName} request failed`,
        status: response.status,
        details: body.slice(0, 500),
      });
    }

    return (await response.json()) as T;
  }
}
