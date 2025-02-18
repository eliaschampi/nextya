interface SupabaseError {
	status: number;
	message: string;
	code: string;
}

export const handleSupabaseError = (error: SupabaseError, context: string) => {
	console.error(`[${context}]`, error);

	return {
		status: error.status || 500,
		body: {
			error: error.message,
			context,
			code: error.code
		}
	};
};
