import { Injectable, Logger } from '@nestjs/common';

export interface BaseTool<TArgs = any, TResult = any> {
  name: string;
  description: string;
  category: 'query' | 'command' | 'analytics' | 'notification';
  parameters: any; // OpenAI Function JSON Schema
  execute(args: TArgs, context: { ownerId: string; storeId?: string }): Promise<TResult>;
}

@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private tools = new Map<string, BaseTool>();

  register(tool: BaseTool) {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool [${tool.name}] is already registered. Overwriting.`);
    }
    this.tools.set(tool.name, tool);
    this.logger.log(`Tool registered: ${tool.name} [Category: ${tool.category}]`);
  }

  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  getOpenAiToolDefinitions(allowedCategories?: string[]): any[] {
    return this.getAllTools()
      .filter((tool) => !allowedCategories || allowedCategories.includes(tool.category))
      .map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
  }

  async executeTool(
    name: string,
    args: any,
    context: { ownerId: string; storeId?: string },
  ): Promise<any> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool [${name}] is not registered in ToolRegistry.`);
    }
    this.logger.log(`Executing tool: ${name} with context ownerId=${context.ownerId}`);
    return await tool.execute(args, context);
  }
}
