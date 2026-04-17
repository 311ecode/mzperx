/* Newspaper Counts Panel - compare expected (from summary) vs actual (from route) */

function computeActualCounts() {
    const actual = {};
    if (!routeData || !routeData.delivery_route) return actual;
    routeData.delivery_route.forEach(street => {
        street.deliveries.forEach(d => {
            actual[d.newspaper] = (actual[d.newspaper] || 0) + 1;
        });
    });
    return actual;
}

function getActualForSummaryCode(actualMap, summaryCode) {
    // Try the exact code first, then with trailing C stripped (HDC -> HD).
    // NRC stays NRC because actualMap already has a direct hit.
    if (actualMap[summaryCode] !== undefined) return actualMap[summaryCode];
    if (summaryCode.length > 2 && summaryCode.endsWith('C')) {
        const stripped = summaryCode.slice(0, -1);
        if (actualMap[stripped] !== undefined) return actualMap[stripped];
    }
    return 0;
}

function getDeliveryCodeForSummaryCode(actualMap, summaryCode) {
    if (actualMap[summaryCode] !== undefined) return summaryCode;
    if (summaryCode.length > 2 && summaryCode.endsWith('C')) {
        const stripped = summaryCode.slice(0, -1);
        if (actualMap[stripped] !== undefined) return stripped;
    }
    return summaryCode;
}

function buildCountsRows() {
    if (!routeData || !routeData.newspaper_summary) return { rows: [], totals: null };

    const actual = computeActualCounts();
    const rows = [];
    let totalExpected = 0;
    let totalActual = 0;
    let totalLeftover = 0;

    routeData.newspaper_summary.forEach(ns => {
        const expected = ns.total_circulation - ns.leftover_papers;
        const displayCode = getDeliveryCodeForSummaryCode(actual, ns.code);
        const actualCount = getActualForSummaryCode(actual, ns.code);
        const match = actualCount === expected;

        totalExpected += expected;
        totalActual += actualCount;
        totalLeftover += ns.leftover_papers;

        rows.push({
            code: displayCode,
            name: ns.name,
            totalCirculation: ns.total_circulation,
            leftover: ns.leftover_papers,
            expected,
            actual: actualCount,
            match,
        });
    });

    // Detect delivery codes that aren't in the summary at all (shouldn't happen,
    // but if it does the deliverer should see it)
    const summaryCodes = new Set();
    routeData.newspaper_summary.forEach(ns => {
        summaryCodes.add(ns.code);
        if (ns.code.length > 2 && ns.code.endsWith('C')) {
            summaryCodes.add(ns.code.slice(0, -1));
        }
    });
    Object.keys(actual).forEach(code => {
        if (!summaryCodes.has(code)) {
            rows.push({
                code,
                name: '(niet in overzicht)',
                totalCirculation: null,
                leftover: null,
                expected: 0,
                actual: actual[code],
                match: false,
            });
            totalActual += actual[code];
        }
    });

    return {
        rows,
        totals: {
            totalCirculation: totalExpected + totalLeftover,
            leftover: totalLeftover,
            expected: totalExpected,
            actual: totalActual,
            match: totalActual === totalExpected,
        },
    };
}

function renderCountsPanel() {
    const { rows, totals } = buildCountsRows();
    const body = document.getElementById('countsPanelBody');
    if (!body) return;

    if (!rows.length) {
        body.innerHTML = `<div class="counts-empty">Geen data beschikbaar</div>`;
        return;
    }

    const rowsHtml = rows.map(r => {
        const icon = r.match
            ? `<span class="counts-check counts-check-ok" title="Klopt">✓</span>`
            : `<span class="counts-check counts-check-bad" title="Wijkt af">✗</span>`;
        const extra = (r.totalCirculation !== null && r.leftover > 0)
            ? `<div class="counts-sub">oplage ${r.totalCirculation} − over ${r.leftover}</div>`
            : '';
        return `
            <div class="counts-row ${r.match ? 'counts-row-ok' : 'counts-row-bad'}">
                <div class="counts-code">${r.code}</div>
                <div class="counts-name">
                    <div class="counts-name-main">${r.name}</div>
                    ${extra}
                </div>
                <div class="counts-numbers">
                    <span class="counts-actual">${r.actual}</span>
                    <span class="counts-sep">/</span>
                    <span class="counts-expected">${r.expected}</span>
                </div>
                <div class="counts-icon">${icon}</div>
            </div>
        `;
    }).join('');

    const totalIcon = totals.match
        ? `<span class="counts-check counts-check-ok">✓</span>`
        : `<span class="counts-check counts-check-bad">✗</span>`;

    body.innerHTML = `
        <div class="counts-list">${rowsHtml}</div>
        <div class="counts-total-row ${totals.match ? 'counts-row-ok' : 'counts-row-bad'}">
            <div class="counts-code">TOT</div>
            <div class="counts-name">
                <div class="counts-name-main">Totaal</div>
                ${totals.leftover > 0 ? `<div class="counts-sub">oplage ${totals.totalCirculation} − over ${totals.leftover}</div>` : ''}
            </div>
            <div class="counts-numbers">
                <span class="counts-actual">${totals.actual}</span>
                <span class="counts-sep">/</span>
                <span class="counts-expected">${totals.expected}</span>
            </div>
            <div class="counts-icon">${totalIcon}</div>
        </div>
    `;
}

function openCountsPanel() {
    renderCountsPanel();
    const overlay = document.getElementById('countsOverlay');
    const panel = document.getElementById('countsPanel');
    if (overlay) overlay.classList.add('show');
    if (panel) panel.classList.add('show');
}

function closeCountsPanel() {
    const overlay = document.getElementById('countsOverlay');
    const panel = document.getElementById('countsPanel');
    if (overlay) overlay.classList.remove('show');
    if (panel) panel.classList.remove('show');
}
