import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, LoggerOptions } from './Logger'; // Adjust the import path
import { Span } from './trace';

describe('Logger', () => {
    let logger: Logger;
    const loggerOptions: LoggerOptions = {
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
        debug: true,
    };

    beforeEach(() => {
        vi.useFakeTimers();
        logger = Logger.getInstance(loggerOptions);
        logger.flush = vi.fn().mockResolvedValue(null); // Mock flush to avoid real HTTP requests
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        vi.useRealTimers();
    });

    it('should get a singleton instance of the Logger', () => {
        const loggerInstance1 = Logger.getInstance(loggerOptions);
        const loggerInstance2 = Logger.getInstance(loggerOptions);

        expect(loggerInstance1).toBe(loggerInstance2);
    });

    it('should start and end a trace', () => {
        const traceName = 'test-trace';
        const span = logger.startTrace(traceName);

        expect(span).toBeInstanceOf(Span);
        expect(logger.currentSpan()).toBe(span);

        logger.endTrace();
        expect(logger.currentSpan()).toBeUndefined();
    });

    it('should throw an error when ending a trace without an active trace', () => {
        expect(() => logger.endTrace()).toThrowError('No active trace to end.');
    });

    it('should start and end a span', () => {
        const traceName = 'test-trace';
        const spanName = 'test-span';

        logger.startTrace(traceName);
        const span = logger.startSpan(spanName);

        expect(span).toBeInstanceOf(Span);
        expect(logger.currentSpan()).toBe(span);

        logger.endSpan();
        expect(logger.currentSpan()).toBeUndefined();
    });

    it('should throw an error when starting a span without an active trace', () => {
        expect(() => logger.startSpan('test-span')).toThrowError('No active trace to start a span.');
    });

    it('should retrieve the current span', () => {
        const traceName = 'test-trace';
        const spanName = 'test-span';

        logger.startTrace(traceName);
        const traceSpan = logger.currentSpan();

        logger.startSpan(spanName);
        const span = logger.currentSpan();

        expect(span).toBeInstanceOf(Span);
        expect(span).not.toBe(traceSpan);
    });

    it('should trace a callback with a given name', () => {
        const traceName = 'test-trace-callback';
        const callback = vi.fn().mockReturnValue('callback-result');

        const result = logger.trace(traceName, callback);

        expect(callback).toHaveBeenCalled();
        expect(result).toBe('callback-result');
    });

    it('should flush the traces buffer', async () => {
        loggerOptions.debug = false;
        logger = Logger.getInstance(loggerOptions);
        logger.startTrace('test-trace');
        logger.endTrace();

        await logger.flush();

        expect(logger.flush).toHaveBeenCalled();
    });
});
