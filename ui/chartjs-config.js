/**
 * Shared Chart.js configuration module for the Gut Tracker app.
 * Loaded via <script> tag after the Chart.js CDN script.
 * All functions are global (window scope).
 */

// ============================================================
// Emoji Markers Plugin
// ============================================================

const CHART_THEME = {
    font: {
        family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        size: 9,
        color: '#61716b',
        markerSize: 16
    },
    grid: {
        color: 'rgba(97, 113, 107, 0.2)',
        lineWidth: 1
    },
    spacing: {
        padding: { top: 6, right: 8, bottom: 0, left: 0 }
    },
    tooltip: {
        background: '#17221e',
        color: '#fff',
        padding: '6px 9px',
        borderRadius: '6px',
        fontSize: '11px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    }
};

function getChartScaleDefaults() {
    const tickFont = { family: CHART_THEME.font.family, size: CHART_THEME.font.size };
    const gridStyle = { color: CHART_THEME.grid.color, lineWidth: CHART_THEME.grid.lineWidth };

    return {
        x: {
            type: 'category',
            grid: { ...gridStyle, display: true },
            border: { display: false },
            ticks: {
                autoSkip: true,
                maxRotation: 0,
                color: CHART_THEME.font.color,
                font: tickFont
            }
        },
        y: {
            beginAtZero: true,
            grid: gridStyle,
            border: { display: false },
            ticks: {
                color: CHART_THEME.font.color,
                font: tickFont
            }
        }
    };
}

function mergeChartScaleOptions(defaults, overrides) {
    const scale = { ...defaults, ...overrides };
    ['grid', 'border', 'ticks'].forEach(key => {
        scale[key] = { ...defaults[key], ...(overrides[key] || {}) };
    });
    scale.ticks.font = { ...defaults.ticks.font, ...(overrides.ticks?.font || {}) };
    return scale;
}

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
                ctx.font = `${CHART_THEME.font.markerSize}px serif`;
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
    const yScale = opts.yScale || {};
    const scaleDefaults = getChartScaleDefaults();

    return {
        type: 'line',
        data: {
            labels: (opts.data && opts.data.labels) || [],
            datasets: (opts.data && opts.data.datasets) || []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            font: {
                family: CHART_THEME.font.family,
                size: CHART_THEME.font.size
            },
            color: CHART_THEME.font.color,
            layout: CHART_THEME.spacing,
            scales: {
                x: mergeChartScaleOptions(scaleDefaults.x, opts.xScale || {}),
                y: {
                    ...mergeChartScaleOptions(scaleDefaults.y, yScale),
                    title: {
                        display: opts.yTitle ? true : false,
                        text: opts.yTitle || '',
                        color: CHART_THEME.font.color,
                        font: { family: CHART_THEME.font.family, size: CHART_THEME.font.size },
                        ...(yScale.title || {})
                    },
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
                legend: {
                    display: false,
                    labels: {
                        color: CHART_THEME.font.color,
                        font: { family: CHART_THEME.font.family, size: CHART_THEME.font.size }
                    }
                },
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
            tooltipEl.style.background = CHART_THEME.tooltip.background;
            tooltipEl.style.color = CHART_THEME.tooltip.color;
            tooltipEl.style.padding = CHART_THEME.tooltip.padding;
            tooltipEl.style.borderRadius = CHART_THEME.tooltip.borderRadius;
            tooltipEl.style.fontFamily = CHART_THEME.font.family;
            tooltipEl.style.fontSize = CHART_THEME.tooltip.fontSize;
            tooltipEl.style.pointerEvents = 'none';
            tooltipEl.style.opacity = '0';
            tooltipEl.style.transition = 'opacity 0.12s';
            tooltipEl.style.zIndex = '10';
            tooltipEl.style.whiteSpace = 'nowrap';
            tooltipEl.style.boxShadow = CHART_THEME.tooltip.boxShadow;
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