// Utilidades para manipulación de imágenes

export interface ImageDimensions {
	width: number;
	height: number;
}

export interface ImageFormat {
	name: string;
	ratio: number;
	tolerance: number;
}

export const PAPER_FORMATS = {
	A5_VERTICAL: { name: 'A5 Vertical', ratio: 1 / 1.414, tolerance: 0.05 },
	A5_HORIZONTAL: { name: 'A5 Horizontal', ratio: 1.414, tolerance: 0.05 }
};

export function calculateCropDimensions(
	origWidth: number,
	origHeight: number,
	targetRatio: number
): { width: number; height: number; offsetX: number; offsetY: number } {
	const currentRatio = origWidth / origHeight;
	let newWidth: number, newHeight: number;

	if (currentRatio > targetRatio) {
		newHeight = origHeight;
		newWidth = Math.round(newHeight * targetRatio);
	} else {
		newWidth = origWidth;
		newHeight = Math.round(newWidth / targetRatio);
	}

	newWidth = Math.min(newWidth, origWidth);
	newHeight = Math.min(newHeight, origHeight);

	const offsetX = Math.floor((origWidth - newWidth) / 2);
	const offsetY = Math.floor((origHeight - newHeight) / 2);

	return { width: newWidth, height: newHeight, offsetX, offsetY };
}

export function processImageWithCanvas(
	image: HTMLImageElement,
	options: {
		rotation?: number;
		flip?: { horizontal?: boolean; vertical?: boolean };
		crop?: { x?: number; y?: number; width?: number; height?: number; targetRatio: number };
		quality?: number;
	}
): string {
	const tempCanvas = document.createElement('canvas');
	const tempCtx = tempCanvas.getContext('2d');
	if (!tempCtx) throw new Error('No se pudo obtener el contexto 2D del canvas');

	let imgWidth = image.naturalWidth;
	let imgHeight = image.naturalHeight;

	tempCanvas.width = imgWidth;
	tempCanvas.height = imgHeight;
	tempCtx.drawImage(image, 0, 0, imgWidth, imgHeight);

	const outputCanvas = document.createElement('canvas');
	const outputCtx = outputCanvas.getContext('2d');
	if (!outputCtx) throw new Error('No se pudo obtener el contexto 2D del canvas');

	// 1. Aplicar recorte
	if (options.crop) {
		let cropX = options.crop.x ?? 0;
		let cropY = options.crop.y ?? 0;
		let cropWidth = options.crop.width ?? imgWidth;
		let cropHeight = options.crop.height ?? imgHeight;

		if (
			options.crop.x === undefined ||
			options.crop.y === undefined ||
			options.crop.width === undefined ||
			options.crop.height === undefined
		) {
			const cropDimensions = calculateCropDimensions(imgWidth, imgHeight, options.crop.targetRatio);
			cropX = cropDimensions.offsetX;
			cropY = cropDimensions.offsetY;
			cropWidth = cropDimensions.width;
			cropHeight = cropDimensions.height;
		}

		cropX = Math.max(0, Math.min(imgWidth - 1, cropX));
		cropY = Math.max(0, Math.min(imgHeight - 1, cropY));
		cropWidth = Math.max(1, Math.min(imgWidth - cropX, cropWidth));
		cropHeight = Math.max(1, Math.min(imgHeight - cropY, cropHeight));

		const croppedImgData = tempCtx.getImageData(cropX, cropY, cropWidth, cropHeight);
		tempCanvas.width = cropWidth;
		tempCanvas.height = cropHeight;
		tempCtx.putImageData(croppedImgData, 0, 0);

		imgWidth = cropWidth;
		imgHeight = cropHeight;
	}

	// 2. Aplicar rotación y volteo
	let finalWidth = imgWidth;
	let finalHeight = imgHeight;

	if (options.rotation && (options.rotation % 180 === 90 || options.rotation % 180 === 270)) {
		finalWidth = imgHeight;
		finalHeight = imgWidth;
	}

	outputCanvas.width = finalWidth;
	outputCanvas.height = finalHeight;

	outputCtx.save();
	outputCtx.translate(finalWidth / 2, finalHeight / 2);

	if (options.rotation) {
		outputCtx.rotate((options.rotation * Math.PI) / 180);
	}

	if (options.flip) {
		const scaleX = options.flip.horizontal ? -1 : 1;
		const scaleY = options.flip.vertical ? -1 : 1;
		outputCtx.scale(scaleX, scaleY);
	}

	const drawWidth =
		options.rotation && (options.rotation % 180 === 90 || options.rotation % 180 === 270)
			? imgHeight
			: imgWidth;
	const drawHeight =
		options.rotation && (options.rotation % 180 === 90 || options.rotation % 180 === 270)
			? imgWidth
			: imgHeight;

	outputCtx.drawImage(tempCanvas, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
	outputCtx.restore();

	return outputCanvas.toDataURL('image/jpeg', options.quality || 0.95);
}

export function base64ToFile(base64Data: string, fileName: string): File {
	const byteString = atob(base64Data.split(',')[1]);
	const mimeType = base64Data.split(',')[0].split(':')[1].split(';')[0];
	const arrayBuffer = new ArrayBuffer(byteString.length);
	const uint8Array = new Uint8Array(arrayBuffer);

	for (let i = 0; i < byteString.length; i++) {
		uint8Array[i] = byteString.charCodeAt(i);
	}

	const blob = new Blob([arrayBuffer], { type: mimeType });
	return new File([blob], fileName, { type: mimeType });
}

export function checkImageFormat(
	imageWidth: number,
	imageHeight: number,
	format: ImageFormat
): boolean {
	const imageRatio = imageWidth / imageHeight;
	return Math.abs(imageRatio - format.ratio) <= format.tolerance;
}

export function validateA5Proportion(
	width: number,
	height: number
): {
	isValid: boolean;
	format: string;
} {
	const isVertical = checkImageFormat(width, height, PAPER_FORMATS.A5_VERTICAL);
	return {
		isValid: isVertical,
		format: isVertical ? PAPER_FORMATS.A5_VERTICAL.name : 'Formato no A5'
	};
}
