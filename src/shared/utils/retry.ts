type BackoffOptions = {
    maxRetries?: number;
    baseDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
};

export async function executeWithBackoff<T>(
    fn: () => Promise<T> | T,
    options: BackoffOptions = {}
): Promise<T> {
    const {
        maxRetries = 5,
        baseDelay = 1000,
        shouldRetry = () => true
    } = options;

    async function attempt(remaining: number): Promise<T> {
        try {
            return await fn();
        } catch (err) {
            if (remaining <= 0 || !shouldRetry(err)) {
                throw err;
            }
            const delay =
                baseDelay *
                Math.pow(2, (options.maxRetries || maxRetries) - remaining);
            await new Promise((resolve: any) => setTimeout(resolve, delay));
            return attempt(remaining - 1);
        }
    }

    return attempt(maxRetries);
}
