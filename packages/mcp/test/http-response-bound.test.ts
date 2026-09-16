import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { McpClient } from "../src";

describe("McpClient Streamable HTTP response bounding", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer((_request, response) => {
      const body = JSON.stringify({ filler: "x".repeat(64 * 1024) });
      response.writeHead(200, {
        "content-type": "application/json",
        "content-length": String(Buffer.byteLength(body)),
      });
      response.end(body);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("fails the connection when a response exceeds maxBufferSize", async () => {
    const client = new McpClient({
      name: "oversized",
      transport: {
        type: "streamableHttp",
        url: baseUrl,
        ssrfProtection: "disabled",
        maxBufferSize: 1024,
      },
    });

    await expect(client.connect()).rejects.toThrow(/maxBufferSize/);
    await client.close();
  });
});
