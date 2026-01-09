/**
 * Functional utility to wrap an async operation with a loading state.
 * @param setLoading A setter function to update the loading state.
 * @param fn The async operation to perform.
 */
export async function withLoadingState<T>(
	setLoading: (loading: boolean) => void,
	fn: () => Promise<T> | T,
): Promise<T> {
	setLoading(true);
	try {
		return await fn();
	} finally {
		setLoading(false);
	}
}
