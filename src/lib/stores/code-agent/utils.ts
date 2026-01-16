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

export function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			// 保留完整的 data:xxx;base64,xxx 格式
			resolve(result);
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}
