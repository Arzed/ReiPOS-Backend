import { Injectable, Logger } from '@nestjs/common';

export interface AiTelemetryLog {
  userId?: string;
  ownerId: string;
  userQuery: string;
  agentRole?: string;
  toolsCalled: string[];
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
}

@Injectable()
export class AiObservabilityService {
  private readonly logger = new Logger(AiObservabilityService.name);
  private logs: AiTelemetryLog[] = [];

  // Approximate pricing for gpt-4o-mini / gpt-4o
  private readonly COST_PER_1K_INPUT_USD = 0.00015;
  private readonly COST_PER_1K_OUTPUT_USD = 0.0006;

  logTelemetry(params: {
    ownerId: string;
    userQuery: string;
    agentRole?: string;
    toolsCalled?: string[];
    latencyMs: number;
    promptTokens?: number;
    completionTokens?: number;
    status: 'SUCCESS' | 'FAILED';
    errorMessage?: string;
  }) {
    const promptTokens = params.promptTokens || 0;
    const completionTokens = params.completionTokens || 0;
    const totalTokens = promptTokens + completionTokens;

    const estimatedCostUsd =
      (promptTokens / 1000) * this.COST_PER_1K_INPUT_USD +
      (completionTokens / 1000) * this.COST_PER_1K_OUTPUT_USD;

    const record: AiTelemetryLog = {
      ownerId: params.ownerId,
      userQuery: params.userQuery,
      agentRole: params.agentRole || 'GeneralAgent',
      toolsCalled: params.toolsCalled || [],
      latencyMs: params.latencyMs,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
      status: params.status,
      errorMessage: params.errorMessage,
    };

    this.logs.push(record);
    if (this.logs.length > 500) {
      this.logs.shift(); // Keep latest 500 records in memory
    }

    this.logger.log(
      `[AI TELEMETRY] Agent=${record.agentRole} | Owner=${record.ownerId} | Latency=${record.latencyMs}ms | Tokens=${record.totalTokens} | EstCost=$${record.estimatedCostUsd} | Tools=[${record.toolsCalled.join(', ')}]`,
    );
  }

  getRecentLogs(limit = 50): AiTelemetryLog[] {
    return this.logs.slice(-limit);
  }
}
