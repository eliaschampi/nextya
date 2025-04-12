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
 * Verifica si una imagen tiene un formato específico
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
 * Calcula las dimensiones para recortar una imagen a un formato específico
 * @param origWidth Ancho original
 * @param origHeight Alto original
 * @param targetRatio Relación de aspecto objetivo (ancho/alto)
 * @returns Dimensiones para el recorte
 */
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
	const offsetX = Math.max(0, (origWidth - newWidth) / 2);
	const offsetY = Math.max(0, (origHeight - newHeight) / 2);

	return { width: newWidth, height: newHeight, offsetX, offsetY };
}

/**
 * Procesa una imagen en un canvas (rotación o recorte)
 * @param image Elemento de imagen
 * @param options Opciones de procesamiento
 * @returns Datos de la imagen procesada en formato base64
 */
export function processImageWithCanvas(
	image: HTMLImageElement,
	options: {
		rotation?: number;
		crop?: {
			targetRatio: number;
		};
		quality?: number;
	}
): string {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('No se pudo obtener el contexto 2D del canvas');

	const { naturalWidth, naturalHeight } = image;
	const width = naturalWidth;
	const height = naturalHeight;

	// Configurar dimensiones según la operación
	if (
		options.rotation !== undefined &&
		(options.rotation % 180 === 90 || options.rotation % 180 === 270)
	) {
		// Si la rotación es 90 o 270 grados, intercambiar dimensiones
		canvas.width = height;
		canvas.height = width;
	} else if (options.crop) {
		// Si es recorte, calcular nuevas dimensiones
		const {
			width: cropWidth,
			height: cropHeight,
			offsetX,
			offsetY
		} = calculateCropDimensions(naturalWidth, naturalHeight, options.crop.targetRatio);

		canvas.width = cropWidth;
		canvas.height = cropHeight;

		// Dibujar la porción recortada
		ctx.drawImage(
			image,
			offsetX,
			offsetY,
			cropWidth,
			cropHeight, // Fuente (recorte)
			0,
			0,
			cropWidth,
			cropHeight // Destino (canvas completo)
		);

		// Retornar la imagen recortada
		return canvas.toDataURL('image/jpeg', options.quality || 0.95);
	} else {
		canvas.width = width;
		canvas.height = height;
	}

	// Si hay rotación, aplicarla
	if (options.rotation !== undefined && options.rotation !== 0) {
		ctx.save();
		ctx.translate(canvas.width / 2, canvas.height / 2);
		ctx.rotate((options.rotation * Math.PI) / 180);
		ctx.drawImage(image, -naturalWidth / 2, -naturalHeight / 2, naturalWidth, naturalHeight);
		ctx.restore();
	} else if (!options.crop) {
		// Si no hay recorte ni rotación, simplemente dibujar la imagen
		ctx.drawImage(image, 0, 0, width, height);
	}

	// Convertir a base64 y retornar
	return canvas.toDataURL('image/jpeg', options.quality || 0.95);
}

/**
 * Convierte datos de imagen base64 a un objeto File
 * @param base64Data Datos de imagen en formato base64
 * @param fileName Nombre del archivo
 * @returns Objeto File
 */
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
