export function responseMessage(response: { data: string }): string | null {
	try {
		const parsedData = JSON.parse(response.data);
		if (Array.isArray(parsedData) && parsedData.length >= 2) {
			if (typeof parsedData[1] === 'string') {
				return parsedData[1];
			}
		}
	} catch {
		const match = response.data.match(/,\s*['"](.*)['"]\s*\]/);
		if (match && match[1]) {
			return match[1];
		}
	}
	return null;
}
