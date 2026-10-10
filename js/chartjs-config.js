/**
 * Shared Chart.js configuration module for the Gut Tracker app.
 * Loaded via <script> tag after the Chart.js CDN script.
 * All functions are global (window scope).
 */

// ============================================================
// Emoji Markers Plugin
// ============================================================

const emojiMarkersPlugin = {
    id: 'emojiMarkers',
    afterDatasetsDraw(chart) {
        const { ctx } = chart;
        chart.data.datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            const emoji = dataset.emoji;
            if (!emoji) return;

            meta.data.forEach((point, pointIndex) => {
                const value = dataset.data[pointIndex];
                if (value === null || value === undefined || value === '' || value === 0) return;

                const { x, y } = point.getProps(['x', 'y']);
                ctx.save();
                ctx.font = '16px serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(emoji, x, y);
                ctx.restore();
            });
        });
    }
};

// Register the plugin
if (typeof Chart !== 'undefined') {
    Chart.register(emojiMarkersPlugin);
}

// ============================================================
// Chart Configuration Factory
// ============================================================

function createChartConfig(options = {}) {
    const opts = options || {};
    return {
        type: 'line',
        data: {
            labels: (opts.data && opts.data.labels) || [],
            datasets: (opts.data && opts.data.datasets) || []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            legend: { display: false },
        tooltips: { enabled: false },
            scales: {
                x: {
                    type: 'category',
                    ticks: {
                        autoSkip: true,
                        maxRotation: 0
                    },
                    ...(opts.xScale || {})
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: opts.yTitle ? true : false,
                        text: opts.yTitle || ''
                    },
                    ...(opts.yScale || {})
                }
            },
            elements: {
                line: {
                    borderDash: [4, 2],
                    borderWidth: 2,
                    tension: 0
                },
                point: {
                    radius: 0
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: createExternalTooltipHandler(opts.getLabel, opts.getDetail)
                }
            }
        }
    };
}

// ============================================================
// External Tooltip Handler
// ============================================================

function createExternalTooltipHandler(getLabel, getDetail) {
    return function(context) {
        const { chart, tooltip } = context;
        const canvasParent = chart.canvas.parentNode;

        // Ensure parent has position: relative for tooltip positioning
        if (canvasParent.style.position !== 'relative' &&
            getComputedStyle(canvasParent).position === 'static') {
            canvasParent.style.position = 'relative';
        }

        let tooltipEl = canvasParent.querySelector('.chartjs-tooltip');

        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.className = 'chartjs-tooltip';
            tooltipEl.style.position = 'absolute';
            tooltipEl.style.background = '#17221e';
            tooltipEl.style.color = '#fff';
            tooltipEl.style.padding = '6px 9px';
            tooltipEl.style.borderRadius = '6px';
            tooltipEl.style.fontSize = '11px';
            tooltipEl.style.pointerEvents = 'none';
            tooltipEl.style.opacity = '0';
            tooltipEl.style.transition = 'opacity 0.12s';
            tooltipEl.style.zIndex = '10';
            tooltipEl.style.whiteSpace = 'nowrap';
            tooltipEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            canvasParent.appendChild(tooltipEl);
        }

        if (tooltip.opacity === 0) {
            tooltipEl.style.opacity = '0';
            return;
        }

        // Build content
        let labelText = '';
        let detailText = '';

        if (typeof getLabel === 'function') {
            const label = getLabel(tooltip);
            labelText = Array.isArray(label) ? label.join(', ') : String(label || '');
        }

        if (typeof getDetail === 'function') {
            const detail = getDetail(tooltip);
            detailText = Array.isArray(detail) ? detail.join(', ') : String(detail || '');
        }

        tooltipEl.textContent = '';
        if (labelText) {
            const labelDiv = document.createElement('div');
            labelDiv.textContent = labelText;
            tooltipEl.appendChild(labelDiv);
        }
        if (detailText) {
            const detailDiv = document.createElement('div');
            detailDiv.textContent = detailText;
            tooltipEl.appendChild(detailDiv);
        }

        // Position above the data point
        const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;
        tooltipEl.style.opacity = '1';
        tooltipEl.style.left = positionX + tooltip.caretX + 'px';
        tooltipEl.style.top = positionY + tooltip.caretY - tooltipEl.offsetHeight - 8 + 'px';
    };
}

// ============================================================
// Chart Instance Management
// ============================================================

function createEmojiChart(canvas, config) {
    const canvasEl = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
    if (!canvasEl) {
        console.error('Canvas element not found');
        return null;
    }

    // Destroy existing chart if present
    const existingChart = Chart.getChart(canvasEl);
    if (existingChart) {
        existingChart.destroy();
    }

    return new Chart(canvasEl.getContext('2d'), config);
}

function destroyChart(chart) {
    if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
    }
}
