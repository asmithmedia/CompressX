export class CompressXClient {
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  private async request(path: string, options: RequestInit = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  async compress(params: {
    sourceModelId: string;
    sourceModelName: string;
    method: string;
    config: Record<string, unknown>;
  }) {
    return this.request("/compress", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async getJob(jobId: string) {
    return this.request(`/compress/${jobId}`);
  }

  async getCredits() {
    return this.request("/credits");
  }

  async searchModels(query: string) {
    return this.request(`/models?q=${encodeURIComponent(query)}`);
  }
}
