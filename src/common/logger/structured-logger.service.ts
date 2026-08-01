import { Injectable, LoggerService, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT })
export class StructuredLoggerService implements LoggerService {
  private context?: string;

  setContext(context: string) {
    this.context = context;
  }

  log(message: any, ...optionalParams: any[]) {
    this.printLog('INFO', message, optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    this.printLog('ERROR', message, optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.printLog('WARN', message, optionalParams);
  }

  debug(message: any, ...optionalParams: any[]) {
    this.printLog('DEBUG', message, optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    this.printLog('VERBOSE', message, optionalParams);
  }

  private printLog(level: string, message: any, optionalParams: any[]) {
    const timestamp = new Date().toISOString();
    const ctx = this.context ? `[${this.context}]` : '';
    const formattedParams = optionalParams.length ? JSON.stringify(optionalParams) : '';
    console.log(`[${timestamp}] [${level}] ${ctx} ${message} ${formattedParams}`);
  }
}
