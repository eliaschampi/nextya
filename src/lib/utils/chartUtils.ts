import type { ChartConfiguration } from 'chart.js/auto';

/**
 * Shared chart colors for consistency across all dashboards
 */
export const CHART_COLORS = {
	primary: 'rgba(100, 220, 150, 0.8)',
	secondary: 'rgba(54, 162, 235, 0.8)',
	tertiary: 'rgba(255, 206, 86, 0.8)',
	quaternary: 'rgba(255, 99, 132, 0.8)',
	approved: 'rgba(100, 220, 150, 0.8)', // Green for approved
	middle: 'rgba(255, 206, 86, 0.8)', // Yellow for middle
	failed: 'rgba(255, 99, 132, 0.8)' // Red for failed
} as const;

/**
 * Create score distribution chart configuration
 * Used by eval and course dashboards for consistency
 */
export function createScoreDistributionConfig(data: {
	approved: number;
	middle: number;
	failed: number;
}): ChartConfiguration {
	return {
		type: 'doughnut',
		data: {
			labels: ['Aprobados (≥14)', 'Regulares (10-14)', 'Desaprobados (<10)'],
			datasets: [
				{
					data: [data.approved, data.middle, data.failed],
					backgroundColor: [CHART_COLORS.approved, CHART_COLORS.middle, CHART_COLORS.failed],
					borderWidth: 1
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				title: {
					display: true,
					text: 'Distribución de Notas'
				},
				tooltip: {
					callbacks: {
						label: function (context) {
							const value = context.raw as number;
							return `${context.label}: ${value.toFixed(2)}%`;
						}
					}
				},
				legend: {
					position: 'right',
					labels: {
						font: {
							size: 12
						}
					}
				}
			}
		}
	};
}
