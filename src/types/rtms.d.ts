// Type definitions for @zoom/rtms
declare module '@zoom/rtms' {
  export interface RTMSClientConfig {
    clientId: string;
    clientSecret: string;
  }

  export interface RTMSMetadata {
    userName?: string;
    userId?: string;
    [key: string]: unknown;
  }

  export interface RTMSLoggerConfig {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error' | 'disabled';
    format: 'text' | 'json';
  }

  export interface RTMSClient {
    join(payload: unknown): void;
    leave(): void;
    onTranscriptData(
      callback: (
        data: Buffer | string,
        size: number,
        timestamp: number,
        metadata: RTMSMetadata
      ) => void | Promise<void>
    ): void;
    onVideoData(
      callback: (
        data: Buffer,
        size: number,
        timestamp: number,
        metadata: RTMSMetadata
      ) => void | Promise<void>
    ): void;
    onAudioData(
      callback: (
        data: Buffer,
        size: number,
        timestamp: number,
        metadata: RTMSMetadata
      ) => void | Promise<void>
    ): void;
  }

  export interface RTMS {
    Client: new (config: RTMSClientConfig) => RTMSClient;
    configureLogger(config: RTMSLoggerConfig): void;
  }

  const rtms: RTMS;
  export default rtms;
}
