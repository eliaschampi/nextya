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

// Formatos de papel estándar (relación ancho/alto)
export const PAPER_FORMATS = {
	A5_VERTICAL: { name: 'A5 Vertical', ratio: 1 / 1.414, tolerance: 0.05 },
	A5_HORIZONTAL: { name: 'A5 Horizontal', ratio: 1.414, tolerance: 0.05 },
	A4_VERTICAL: { name: 'A4 Vertical', ratio: 1 / 1.414, tolerance: 0.05 },
	A4_HORIZONTAL: { name: 'A4 Horizontal', ratio: 1.414, tolerance: 0.05 }
};

/**
 * Verifica si una imagen tiene el formato especificado
 * @param imageWidth Ancho de la imagen
 * @param imageHeight Alto de la imagen
 * @param format Formato a verificar
 * @returns true si la imagen tiene el formato especificado
 */
export function checkImageFormat(
	imageWidth: number,
	imageHeight: number,
	format: ImageFormat
): boolean {
	const imageRatio = imageWidth / imageHeight;
	return Math.abs(imageRatio - format.ratio) <= format.tolerance;
}

/**
 * Verifica si una imagen tiene proporción A5 (vertical u horizontal)
 * @param width Ancho de la imagen
 * @param height Alto de la imagen
 * @returns Un objeto con el resultado de la validación y el formato detectado
 */
export function validateA5Proportion(
	width: number,
	height: number
): {
	isValid: boolean;
	format: string;
	isVertical: boolean;
} {
	const isVertical = checkImageFormat(width, height, PAPER_FORMATS.A5_VERTICAL);
	const isHorizontal = checkImageFormat(width, height, PAPER_FORMATS.A5_HORIZONTAL);

	return {
		isValid: isVertical || isHorizontal,
		format: isVertical
			? PAPER_FORMATS.A5_VERTICAL.name
			: isHorizontal
				? PAPER_FORMATS.A5_HORIZONTAL.name
				: 'Formato no A5',
		isVertical
	};
}

export function calculateCropDimensions(
	origWidth: number,
	origHeight: number,
	targetRatio: number
): { width: number; height: number; offsetX: number; offsetY: number } {
	let newWidth, newHeight;

	if (origWidth / origHeight > targetRatio) {
		// Imagen más ancha que el formato objetivo: recortar ancho
		newHeight = origHeight;
		newWidth = Math.round(origHeight * targetRatio);
	} else {
		// Imagen más alta que el formato objetivo: recortar alto
		newWidth = origWidth;
		newHeight = Math.round(origWidth / targetRatio);
	}

	// Calcular posición para centrar el recorte
	const offsetX = Math.max(0, Math.floor((origWidth - newWidth) / 2));
	const offsetY = Math.max(0, Math.floor((origHeight - newHeight) / 2));

	return { width: newWidth, height: newHeight, offsetX, offsetY };
}

export function processImageWithCanvas(
	image: HTMLImageElement,
	options: {
		rotation?: number;
		flip?: {
			horizontal?: boolean;
			vertical?: boolean;
		};
		zoom?: number;
		crop?: {
			targetRatio: number;
			x?: number;
			y?: number;
			width?: number;
			height?: number;
		};
		quality?: number;
	}
): string {
	// Crear un canvas temporal para el procesamiento inicial
	const tempCanvas = document.createElement('canvas');
	const tempCtx = tempCanvas.getContext('2d');
	if (!tempCtx) throw new Error('No se pudo obtener el contexto 2D del canvas');

	// Obtener dimensiones naturales de la imagen
	let { naturalWidth: imgWidth, naturalHeight: imgHeight } = image;

	// Definir dimensiones iniciales del canvas
	tempCanvas.width = imgWidth;
	tempCanvas.height = imgHeight;

	// Dibujar la imagen original en el canvas temporal
	tempCtx.drawImage(image, 0, 0, imgWidth, imgHeight);

	// Definir el canvas final que contendrá el resultado
	const outputCanvas = document.createElement('canvas');
	const outputCtx = outputCanvas.getContext('2d');
	if (!outputCtx) throw new Error('No se pudo obtener el contexto 2D del canvas');

	// 1. Procesar el recorte primero si existe
	if (options.crop) {
		let cropX = 0;
		let cropY = 0;
		let cropWidth = imgWidth;
		let cropHeight = imgHeight;

		// Si hay zoom, ajustar el recorte
		const zoomFactor = options.zoom || 1;

		// Si se proporcionan coordenadas específicas de recorte
		if (
			options.crop.x !== undefined &&
			options.crop.y !== undefined &&
			options.crop.width !== undefined &&
			options.crop.height !== undefined
		) {
			// Convertir coordenadas de pantalla a coordenadas de imagen real
			const displayToNaturalRatioX = imgWidth / image.width;
			const displayToNaturalRatioY = imgHeight / image.height;

			// Cuando hay zoom, necesitamos ajustar el centro del recorte
			if (zoomFactor !== 1) {
				// Calculamos el centro del área visible
				const centerX = image.width / 2;
				const centerY = image.height / 2;

				// Calculamos la posición relativa al centro
				const relX = options.crop.x - centerX;
				const relY = options.crop.y - centerY;

				// Ajustamos según el zoom (si hacemos zoom in, el recorte es más pequeño en la imagen real)
				const adjustedRelX = relX / zoomFactor;
				const adjustedRelY = relY / zoomFactor;

				// Calculamos las nuevas coordenadas ajustadas
				const adjustedX = centerX + adjustedRelX;
				const adjustedY = centerY + adjustedRelY;

				// Ajustamos el tamaño del recorte
				const adjustedWidth = options.crop.width / zoomFactor;
				const adjustedHeight = options.crop.height / zoomFactor;

				// Convertimos a coordenadas naturales
				cropX = Math.floor(adjustedX * displayToNaturalRatioX);
				cropY = Math.floor(adjustedY * displayToNaturalRatioY);
				cropWidth = Math.floor(adjustedWidth * displayToNaturalRatioX);
				cropHeight = Math.floor(adjustedHeight * displayToNaturalRatioY);
			} else {
				// Sin zoom, usamos el cálculo original
				cropX = Math.floor(options.crop.x * displayToNaturalRatioX);
				cropY = Math.floor(options.crop.y * displayToNaturalRatioY);
				cropWidth = Math.floor(options.crop.width * displayToNaturalRatioX);
				cropHeight = Math.floor(options.crop.height * displayToNaturalRatioY);
			}
		} else {
			// Calcular dimensiones basadas en la relación de aspecto objetivo
			const cropDimensions = calculateCropDimensions(imgWidth, imgHeight, options.crop.targetRatio);
			cropX = cropDimensions.offsetX;
			cropY = cropDimensions.offsetY;
			cropWidth = cropDimensions.width;
			cropHeight = cropDimensions.height;
		}

		// Asegurarse de que las dimensiones del recorte son válidas
		cropX = Math.max(0, Math.min(imgWidth - 1, cropX));
		cropY = Math.max(0, Math.min(imgHeight - 1, cropY));
		cropWidth = Math.max(1, Math.min(imgWidth - cropX, cropWidth));
		cropHeight = Math.max(1, Math.min(imgHeight - cropY, cropHeight));

		// Extraer los datos del recorte
		const croppedImgData = tempCtx.getImageData(cropX, cropY, cropWidth, cropHeight);

		// Redimensionar el canvas temporal para el recorte
		tempCanvas.width = cropWidth;
		tempCanvas.height = cropHeight;

		// Colocar los datos recortados en el canvas temporal
		tempCtx.putImageData(croppedImgData, 0, 0);

		// Actualizar las dimensiones para los próximos pasos
		imgWidth = cropWidth;
		imgHeight = cropHeight;
	}

	// 2. Aplicar rotación y volteo
	let finalWidth = imgWidth;
	let finalHeight = imgHeight;

	// Determinar las dimensiones finales según la rotación
	if (options.rotation && (options.rotation % 180 === 90 || options.rotation % 180 === 270)) {
		finalWidth = imgHeight;
		finalHeight = imgWidth;
	}

	// Configurar el canvas de salida
	outputCanvas.width = finalWidth;
	outputCanvas.height = finalHeight;

	// Aplicar transformaciones
	outputCtx.save();

	// Mover al centro del canvas
	outputCtx.translate(finalWidth / 2, finalHeight / 2);

	// Aplicar rotación
	if (options.rotation) {
		outputCtx.rotate((options.rotation * Math.PI) / 180);
	}

	// Aplicar volteo
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

	// Dibujar la imagen centrada
	outputCtx.drawImage(tempCanvas, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

	outputCtx.restore();

	// Convertir a base64 y retornar
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
