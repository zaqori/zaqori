// ZAQORI - Charts using vanilla SVG (no external dependencies)
window.QAQCharts = {
    lineChart: function(container, data, options = {}) {
        if (!container || !data || !data.length) return;
        const w = container.clientWidth || 600;
        const h = options.height || 280;
        const padding = { top: 20, right: 20, bottom: 40, left: 60 };
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;
        const max = Math.max(...data.map(d => d.value)) * 1.1;
        const min = Math.min(0, ...data.map(d => d.value));
        const range = max - min || 1;
        const stepX = chartW / (data.length - 1 || 1);
        const lineColor = options.color || '#6366f1';
        const fillColor = options.fillColor || 'rgba(99,102,241,0.15)';

        const points = data.map((d, i) => {
            const x = padding.left + i * stepX;
            const y = padding.top + chartH - ((d.value - min) / range) * chartH;
            return { x, y, ...d };
        });

        const pathD = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
        const areaD = pathD + ' L' + points[points.length-1].x + ',' + (padding.top + chartH) + ' L' + points[0].x + ',' + (padding.top + chartH) + ' Z';

        // Gridlines
        const gridLines = [];
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartH / 4) * i;
            const val = max - (range / 4) * i;
            gridLines.push(`<line x1="${padding.left}" y1="${y}" x2="${w - padding.right}" y2="${y}" stroke="currentColor" stroke-opacity="0.1" stroke-width="1"/>`);
            gridLines.push(`<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="currentColor" opacity="0.6">${formatVal(val, options.format)}</text>`);
        }

        // X-axis labels (every few)
        const xLabels = points.map((p, i) => {
            if (i % Math.ceil(points.length / 6) !== 0 && i !== points.length - 1) return '';
            return `<text x="${p.x}" y="${h - 10}" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.6">${p.label}</text>`;
        }).join('');

        // Dots
        const dots = points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${lineColor}"><title>${p.label}: ${formatVal(p.value, options.format)}</title></circle>`).join('');

        container.innerHTML = `
            <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" style="overflow:visible">
                ${gridLines.join('')}
                <path d="${areaD}" fill="${fillColor}"/>
                <path d="${pathD}" fill="none" stroke="${lineColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                ${dots}
                ${xLabels}
            </svg>
        `;
    },
    barChart: function(container, data, options = {}) {
        if (!container || !data || !data.length) return;
        const w = container.clientWidth || 600;
        const h = options.height || 280;
        const padding = { top: 20, right: 20, bottom: 40, left: 60 };
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;
        const max = Math.max(...data.map(d => d.value)) * 1.1;
        const barW = (chartW / data.length) * 0.7;
        const gap = (chartW / data.length) * 0.3;
        const color = options.color || '#6366f1';

        const bars = data.map((d, i) => {
            const x = padding.left + i * (barW + gap) + gap / 2;
            const barH = (d.value / max) * chartH;
            const y = padding.top + chartH - barH;
            return `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" rx="6"><title>${d.label}: ${formatVal(d.value, options.format)}</title></rect>
                    <text x="${x + barW/2}" y="${h - 10}" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.6">${d.label}</text>`;
        }).join('');

        const gridLines = [];
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartH / 4) * i;
            const val = max - (max / 4) * i;
            gridLines.push(`<line x1="${padding.left}" y1="${y}" x2="${w - padding.right}" y2="${y}" stroke="currentColor" stroke-opacity="0.1" stroke-width="1"/>`);
            gridLines.push(`<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="currentColor" opacity="0.6">${formatVal(val, options.format)}</text>`);
        }
        container.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" style="overflow:visible">${gridLines.join('')}${bars}</svg>`;
    }
};

function formatVal(v, format) {
    if (format === 'currency') return '$' + Math.round(v).toLocaleString();
    if (format === 'percent') return Math.round(v) + '%';
    if (format === 'kg') return Math.round(v) + 'kg';
    if (format === 'years') return v.toFixed(1);
    return Math.round(v).toLocaleString();
}
