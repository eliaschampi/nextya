<script lang="ts">
	import { Plus, Upload } from 'lucide-svelte';

	interface Props {
		dis?: boolean;
		multiple?: boolean;
		accept?: string;
		variant?: 'primary' | 'outline';
		size?: 'sm' | 'md' | 'lg';
		icon?: 'plus' | 'upload';
		text?: string;
		class?: string;
		onFileSelect: (files: FileList) => void;
	}

	const {
		dis = false,
		multiple = true,
		accept = 'image/jpeg,image/png,image/webp',
		variant = 'primary',
		size = 'sm',
		icon = 'plus',
		text = 'Añadir',
		class: className = '',
		onFileSelect
	}: Props = $props();

	function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files?.length) {
			onFileSelect(input.files);
			input.value = ''; // Reset input
		}
	}

	const IconComponent = icon === 'plus' ? Plus : Upload;
	const buttonClasses = `btn ${variant === 'primary' ? 'btn-primary' : 'btn-outline btn-primary'} btn-${size} ${dis ? 'btn-disabled' : ''} ${className}`;
</script>

<label class={buttonClasses}>
	<IconComponent size={16} />
	{text}
	<input
		type="file"
		{accept}
		{multiple}
		class="hidden"
		onchange={handleFileChange}
		disabled={dis}
	/>
</label>
