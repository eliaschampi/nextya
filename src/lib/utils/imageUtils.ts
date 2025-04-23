// Utilidades para manipulación de imágenes

/**
 * Representa las dimensiones de una imagen
 */
export interface ImageDimensions {
	width: number;
	height: number;
}

/**
 * Representa un formato de imagen con su relación de aspecto
 */
export interface ImageFormat {
	name: string;
	ratio: number;
	tolerance: number;
}

/**
 * Formatos de papel estándar (relación ancho/alto)
 */
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

/**
 * Calcula las dimensiones de recorte para ajustar una imagen a una proporción específica
 * @param origWidth Ancho original de la imagen
 * @param origHeight Alto original de la imagen
 * @param targetRatio Proporción objetivo (ancho/alto)
 * @returns Dimensiones y posición del recorte
 */
export function calculateCropDimensions(
	origWidth: number,
	origHeight: number,
	targetRatio: number
): { width: number; height: number; offsetX: number; offsetY: number } {
	let newWidth, newHeight;

	// Calcular la proporción actual
	const currentRatio = origWidth / origHeight;

	if (currentRatio > targetRatio) {
		// Imagen más ancha que el formato objetivo: recortar ancho
		newHeight = origHeight;
		newWidth = Math.round(origHeight * targetRatio);
	} else {
		// Imagen más alta que el formato objetivo: recortar alto
		newWidth = origWidth;
		newHeight = Math.round(origWidth / targetRatio);
	}

	// Asegurarse de que las dimensiones son válidas
	newWidth = Math.min(newWidth, origWidth);
	newHeight = Math.min(newHeight, origHeight);

	// Calcular posición para centrar el recorte
	const offsetX = Math.max(0, Math.floor((origWidth - newWidth) / 2));
	const offsetY = Math.max(0, Math.floor((origHeight - newHeight) / 2));

	return { width: newWidth, height: newHeight, offsetX, offsetY };
}

/**
 * Procesa una imagen aplicando transformaciones como rotación y recorte.
 * @param image Imagen a procesar
 * @param options Opciones de transformación
 * @returns Imagen procesada en formato base64
 */
export function processImageWithCanvas(
	image: HTMLImageElement,
	options: {
		rotation?: number;
		flip?: {
			horizontal?: boolean;
			vertical?: boolean;
		};
		crop?: {
			targetRatio?: number;
			x?: number;
			y?: number;
			width?: number;
			height?: number;
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

	// CASO 1: Rotación sin recorte
	if (
		options.rotation !== undefined &&
		!options.crop &&
		(options.rotation % 180 === 90 || options.rotation % 180 === 270)
	) {
		// Si la rotación es 90 o 270 grados, intercambiar dimensiones
		canvas.width = height;
		canvas.height = width;

		// Aplicar rotación
		ctx.save();
		ctx.translate(canvas.width / 2, canvas.height / 2);
		ctx.rotate((options.rotation * Math.PI) / 180);
		ctx.drawImage(image, -width / 2, -height / 2, width, height);
		ctx.restore();

		return canvas.toDataURL('image/jpeg', options.quality || 0.95);
	}

	// CASO 2: Recorte sin rotación
	if (options.crop && (!options.rotation || options.rotation === 0)) {
		// Si hay coordenadas específicas de recorte
		if (
			options.crop.x !== undefined &&
			options.crop.y !== undefined &&
			options.crop.width !== undefined &&
			options.crop.height !== undefined
		) {
			// Convertir coordenadas de pantalla a coordenadas de imagen real
			const displayToNaturalRatioX = width / image.width;
			const displayToNaturalRatioY = height / image.height;

			const cropX = Math.floor(options.crop.x * displayToNaturalRatioX);
			const cropY = Math.floor(options.crop.y * displayToNaturalRatioY);
			const cropWidth = Math.floor(options.crop.width * displayToNaturalRatioX);
			const cropHeight = Math.floor(options.crop.height * displayToNaturalRatioY);

			// Configurar canvas para el recorte
			canvas.width = cropWidth;
			canvas.height = cropHeight;

			// Dibujar la porción recortada
			ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
		} else if (options.crop.targetRatio) {
			// Calcular dimensiones basadas en la relación de aspecto objetivo
			const {
				width: cropWidth,
				height: cropHeight,
				offsetX,
				offsetY
			} = calculateCropDimensions(width, height, options.crop.targetRatio);

			// Configurar canvas para el recorte
			canvas.width = cropWidth;
			canvas.height = cropHeight;

			// Dibujar la porción recortada
			ctx.drawImage(image, offsetX, offsetY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
		}

		return canvas.toDataURL('image/jpeg', options.quality || 0.95);
	}

	// CASO 3: Rotación con recorte o rotación simple (0 o 180 grados)
	// Configurar canvas para la imagen completa
	canvas.width = width;
	canvas.height = height;

	// Aplicar rotación si existe
	if (options.rotation !== undefined && options.rotation !== 0) {
		ctx.save();
		ctx.translate(canvas.width / 2, canvas.height / 2);
		ctx.rotate((options.rotation * Math.PI) / 180);
		ctx.drawImage(image, -width / 2, -height / 2, width, height);
		ctx.restore();
	} else {
		// Sin rotación, simplemente dibujar la imagen
		ctx.drawImage(image, 0, 0, width, height);
	}

	// Aplicar volteo si está especificado
	if (options.flip && (options.flip.horizontal || options.flip.vertical)) {
		const flippedCanvas = document.createElement('canvas');
		flippedCanvas.width = width;
		flippedCanvas.height = height;
		const flippedCtx = flippedCanvas.getContext('2d');
		if (!flippedCtx) throw new Error('No se pudo obtener el contexto 2D del canvas');

		flippedCtx.save();
		flippedCtx.translate(options.flip.horizontal ? width : 0, options.flip.vertical ? height : 0);
		flippedCtx.scale(options.flip.horizontal ? -1 : 1, options.flip.vertical ? -1 : 1);
		flippedCtx.drawImage(canvas, 0, 0, width, height, 0, 0, width, height);
		flippedCtx.restore();

		// Reemplazar el canvas original con el volteado
		canvas.width = width;
		canvas.height = height;
		ctx.drawImage(flippedCanvas, 0, 0);
	}

	// Si hay recorte después de rotación, aplicarlo
	if (options.crop && options.crop.targetRatio) {
		// Calcular dimensiones basadas en la relación de aspecto objetivo
		const {
			width: cropWidth,
			height: cropHeight,
			offsetX,
			offsetY
		} = calculateCropDimensions(width, height, options.crop.targetRatio);

		// Crear un nuevo canvas para el recorte
		const croppedCanvas = document.createElement('canvas');
		croppedCanvas.width = cropWidth;
		croppedCanvas.height = cropHeight;
		const croppedCtx = croppedCanvas.getContext('2d');
		if (!croppedCtx) throw new Error('No se pudo obtener el contexto 2D del canvas');

		// Dibujar la porción recortada
		croppedCtx.drawImage(
			canvas,
			offsetX,
			offsetY,
			cropWidth,
			cropHeight,
			0,
			0,
			cropWidth,
			cropHeight
		);

		// Convertir a base64 y retornar
		return croppedCanvas.toDataURL('image/jpeg', options.quality || 0.95);
	}

	// Convertir a base64 y retornar
	return canvas.toDataURL('image/jpeg', options.quality || 0.95);
}

/**
 * Convierte una imagen base64 a un objeto File
 * @param base64Data Datos de la imagen en formato base64
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
