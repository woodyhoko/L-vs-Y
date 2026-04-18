// DOM Elements
const elements = {
    pension: document.getElementById('pension'),
    spending: document.getElementById('spending'),
    returnRate: document.getElementById('return'),
    volatility: document.getElementById('volatility'),
    years: document.getElementById('years'),
    
    pensionVal: document.getElementById('pensionVal'),
    spendingVal: document.getElementById('spendingVal'),
    returnVal: document.getElementById('returnVal'),
    volatilityVal: document.getElementById('volatilityVal'),
    yearsVal: document.getElementById('yearsVal'),
    
    btn: document.getElementById('runSimBtn'),
    status: document.getElementById('statusMessage'),
    
    statEndA: document.getElementById('statEndA'),
    survivalA: document.getElementById('survivalA'),
    statEndB: document.getElementById('statEndB'),
    survivalB: document.getElementById('survivalB'),

    inflation: document.getElementById('inflation'),
    inflationVal: document.getElementById('inflationVal'),
    showPaths: document.getElementById('showPaths'),
    showSurvival: document.getElementById('showSurvival'),
    spendRatio: document.getElementById('spendRatio')
};

// Chart Instance & State
let projectionChart = null;
let distributionChart = null;
let survivalChart = null;
let currentSimState = null;

// Helpers
const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
});

const formatCompact = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    compactDisplay: 'short'
});

// Update UI Values
function updateValueDisplays() {
    elements.spending.max = elements.pension.value * 1.2;
    if (Number(elements.spending.value) > Number(elements.pension.value) * 1.2) {
        elements.spending.value = elements.pension.value * 1.2;
    }

    elements.pensionVal.textContent = Number(elements.pension.value).toLocaleString();
    elements.spendingVal.textContent = Number(elements.spending.value).toLocaleString();
    elements.returnVal.textContent = Number(elements.returnRate.value).toFixed(1);
    if(elements.inflation) elements.inflationVal.textContent = Number(elements.inflation.value).toFixed(1);
    elements.volatilityVal.textContent = Number(elements.volatility.value).toFixed(1);
    elements.yearsVal.textContent = elements.years.value;

    if(elements.spendRatio) {
        let p = Number(elements.pension.value);
        let s = Number(elements.spending.value);
        let ratio = p > 0 ? ((s / p) * 100).toFixed(0) : 0;
        elements.spendRatio.textContent = `(${ratio}% of Pension)`;
    }
}

// Monte Carlo Math
// Box-Muller transform for normal distribution
function randomNormal(mean, stdDev) {
    let u1 = 0, u2 = 0;
    while (u1 === 0) u1 = Math.random();
    while (u2 === 0) u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
}

// Calculate Percentile
function getPercentile(dataArr, percentile) {
    const list = [...dataArr].sort((a, b) => a - b);
    const index = (percentile / 100) * (list.length - 1);
    if (Math.floor(index) === index) return list[index];
    const i = Math.floor(index);
    const fraction = index - i;
    return list[i] + (list[i + 1] - list[i]) * fraction;
}

// Simulation Core
async function runSimulation() {
    // Show Loading
    elements.status.textContent = "Simulating 10,000 paths...";
    elements.btn.disabled = true;
    elements.btn.style.opacity = '0.5';
    
    // Give UI time to update
    await new Promise(r => setTimeout(r, 10));

    // Gather Parameters
    const pension = Number(elements.pension.value);
    const spending = Number(elements.spending.value);
    const expReturn = Number(elements.returnRate.value) / 100;
    const vol = Number(elements.volatility.value) / 100;
    const inflationRate = elements.inflation ? Number(elements.inflation.value) / 100 : 0.025;
    const years = Number(elements.years.value);
    const passes = 10000;

    // Data structures for results
    // We only need to store per-year balance for each pass across years.
    // [Year][Pass_index]
    const aYearlyData = Array.from({length: years + 1}, () => new Float64Array(passes));
    const bYearlyData = Array.from({length: years + 1}, () => new Float64Array(passes));

    let aSuccess = 0;
    let bSuccess = 0;
    
    const lumpSumBase = pension * 7;

    for (let p = 0; p < passes; p++) {
        let balA = lumpSumBase;
        let balB = 0;
        
        aYearlyData[0][p] = balA;
        bYearlyData[0][p] = balB;
        
        for (let y = 1; y <= years; y++) {
            const actReturn = randomNormal(expReturn, vol);
            let currentSpending = spending * Math.pow(1 + inflationRate, y);
            
            // Strategy A: Starts with 7x Pension.
            // Balance grows, then subtract spending
            if (balA > 0) {
                balA = balA * (1 + actReturn) - currentSpending;
                if (balA < 0) balA = 0;
            }
            aYearlyData[y][p] = balA;
            
            // Strategy B: Yearly addition of Pension
            if (balB >= 0 || (balB + pension - currentSpending) > 0) {
                 // For B, invest current balance, then add/subtract flows
                 balB = (balB * (1 + actReturn)) + pension - currentSpending;
                 if (balB < 0) balB = 0;
            }
            bYearlyData[y][p] = balB;
        }

        if (balA > 0) aSuccess++;
        // Strategy B won't deplete if pension >= final inflated spending
        if (balB > 0 || (pension >= spending * Math.pow(1 + inflationRate, years))) bSuccess++; 
    }

    // Crunch percentiles
    const labels = [];
    const bandsPercentiles = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95];
    const aData = {};
    const bData = {};
    bandsPercentiles.forEach(p => { aData[p] = []; bData[p] = []; });

    for (let y = 0; y <= years; y++) {
        labels.push(`Year ${y}`);
        bandsPercentiles.forEach(p => {
             aData[p].push(getPercentile(aYearlyData[y], p));
             bData[p].push(getPercentile(bYearlyData[y], p));
        });
    }

    const aSurvivalRate = ((aSuccess / passes) * 100).toFixed(1);
    const bSurvivalRate = ((bSuccess / passes) * 100).toFixed(1);

    // Extract 100 sample paths
    const samplePathsA = [];
    const samplePathsB = [];
    for(let i=0; i < 100; i++) {
         let pA = []; let pB = [];
         for(let y=0; y <= years; y++) {
             pA.push(aYearlyData[y][i]);
             pB.push(bYearlyData[y][i]);
         }
         samplePathsA.push(pA);
         samplePathsB.push(pB);
    }

    currentSimState = {
        labels: labels,
        aData: aData,
        bData: bData,
        samplePathsA: samplePathsA,
        samplePathsB: samplePathsB,
        allA: aYearlyData,
        allB: bYearlyData
    };

    updateStats(aData[50][years], aSurvivalRate, bData[50][years], bSurvivalRate);
    renderChart();
    renderDistributionChart(years);
    if (elements.showSurvival && elements.showSurvival.checked) renderSurvivalChart();

    elements.status.textContent = "Simulation Complete";
    elements.btn.disabled = false;
    elements.btn.style.opacity = '1';
    
    setTimeout(() => { if(elements.status.textContent === "Simulation Complete") elements.status.textContent = "Ready" }, 2000);
}

function updateStats(endA, survA, endB, survB) {
    elements.statEndA.textContent = formatCompact.format(endA);
    elements.statEndB.textContent = formatCompact.format(endB);
    
    elements.survivalA.textContent = `${survA}% Survival`;
    elements.survivalB.textContent = `${survB}% Survival`;
    
    elements.survivalA.style.color = survA < 80 ? '#f87171' : '#22d3ee';
    elements.survivalB.style.color = survB < 80 ? '#f87171' : '#f472b6';
}

function renderChart(isToggle = false) {
    if (!currentSimState) return;
    const { labels, aData, bData, samplePathsA, samplePathsB } = currentSimState;

    const ctx = document.getElementById('projectionChart').getContext('2d');
    
    const datasets = [];

    function generateBands(data, rgb, isA) {
        const bandPairs = [
            { up: 95, down: 5, alpha: 0.02 },
            { up: 90, down: 10, alpha: 0.02 },
            { up: 85, down: 15, alpha: 0.03 },
            { up: 80, down: 20, alpha: 0.03 },
            { up: 75, down: 25, alpha: 0.04 },
            { up: 70, down: 30, alpha: 0.05 },
            { up: 65, down: 35, alpha: 0.06 },
            { up: 60, down: 40, alpha: 0.07 },
            { up: 55, down: 45, alpha: 0.10 }
        ];

        bandPairs.forEach((band) => {
            datasets.push({ label: (isA ? 'Lump Sum' : 'Yearly Payout') + ` [${band.up}th]`, data: data[band.up], borderColor: 'transparent', backgroundColor: 'transparent', borderWidth: 0, pointRadius: 0, fill: false });
            datasets.push({ label: (isA ? 'Lump Sum' : 'Yearly Payout') + ` [${band.down}th]`, data: data[band.down], borderColor: 'transparent', backgroundColor: `rgba(${rgb}, ${band.alpha})`, borderWidth: 0, pointRadius: 0, fill: '-1' });
        });

        datasets.push({ label: (isA ? 'Lump Sum' : 'Yearly Payout') + ' [Median]', data: data[50], borderColor: `rgba(${rgb}, 1)`, backgroundColor: 'transparent', borderWidth: 3, pointRadius: 0, tension: 0.3, fill: false });
    }

    generateBands(aData, '6, 182, 212', true);
    generateBands(bData, '236, 72, 153', false);

    const showSamplePaths = elements.showPaths && elements.showPaths.checked;
    if (showSamplePaths && samplePathsA && samplePathsB) {
        for(let i=0; i<samplePathsA.length; i++) {
            datasets.push({
                data: samplePathsA[i], borderColor: 'rgba(6, 182, 212, 0.15)', borderWidth: 1, pointRadius: 0, fill: false, tension: 0.1, hitRadius: 0, hoverRadius: 0
            });
            datasets.push({
                data: samplePathsB[i], borderColor: 'rgba(236, 72, 153, 0.15)', borderWidth: 1, pointRadius: 0, fill: false, tension: 0.1, hitRadius: 0, hoverRadius: 0
            });
        }
    }

    let maxProjA = Math.max(...aData[90]);
    let maxProjB = Math.max(...bData[90]);
    let chartMaxY = Math.max(maxProjA, maxProjB) * 1.05;

    if (projectionChart) {
        if (isToggle) {
            projectionChart.data.datasets = datasets;
            projectionChart.options.animation = false;
            projectionChart.update('none');
            return;
        } else {
            projectionChart.destroy();
            projectionChart = null;
        }
    }

    projectionChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: showSamplePaths ? false : true,
            interaction: { mode: 'index', intersect: false },
            onHover: (event, activeElements) => {
                if (activeElements.length > 0) {
                    const idx = activeElements[0].index;
                    if (!projectionChart || projectionChart.$lastHoveredYear !== idx) {
                        if (projectionChart) projectionChart.$lastHoveredYear = idx;
                        renderDistributionChart(idx);
                        document.getElementById('distTitle').textContent = `Outcome Distribution (Year ${idx})`;
                    }
                } else {
                    const finalYear = Number(elements.years.value);
                    if (projectionChart && projectionChart.$lastHoveredYear !== finalYear && projectionChart.$lastHoveredYear !== -1) {
                        projectionChart.$lastHoveredYear = finalYear;
                        renderDistributionChart(finalYear);
                        document.getElementById('distTitle').textContent = `Outcome Distribution (Final Year)`;
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(24, 24, 27, 0.95)', titleFont: { family: 'Inter', size: 14 }, bodyFont: { family: 'Inter', size: 13 }, padding: 12, borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
                    filter: function(item) { 
                        const l = item.dataset.label || ''; 
                        return l.includes('[Median]') || l.includes('[95th]') || l.includes('[75th]') || l.includes('[25th]') || l.includes('[5th]'); 
                    },
                    itemSort: function(a, b) {
                        const aIsLump = (a.dataset.label || '').includes('Lump Sum');
                        const bIsLump = (b.dataset.label || '').includes('Lump Sum');
                        if (aIsLump !== bIsLump) {
                            return aIsLump ? -1 : 1; // Group by Strategy
                        }
                        return b.parsed.y - a.parsed.y; // Then sort descending by value
                    },
                    callbacks: { 
                        label: function(context) { 
                            let l = context.dataset.label || ''; 
                            let val = formatCompact.format(context.parsed.y);
                            l = l.replace('[95th]', '(Top 5%)')
                                 .replace('[75th]', '(Top 25%)')
                                 .replace('[Median]', '(Expected Median)')
                                 .replace('[25th]', '(Bottom 25%)')
                                 .replace('[5th]', '(Bottom 5%)');
                            return ' ' + l + ': ' + val; 
                        } 
                    }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }, ticks: { color: 'rgba(255,255,255,0.5)', font: { family: 'Inter' }, maxTicksLimit: 10 } },
                y: { max: chartMaxY, border: { display: false }, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)', font: { family: 'Inter' }, callback: function(value) { return formatCompact.format(value); } } }
            }
        }
    });
}

// Event Listeners
function renderDistributionChart(yearIdx) {
    if (!currentSimState) return;
    const { allA, allB } = currentSimState;
    if (yearIdx == null) yearIdx = Number(elements.years.value);

    // Provide valid array references
    const finalA = allA[yearIdx];
    const finalB = allB[yearIdx];

    // Use 98th percentile as max and 1st as min to avoid crazy outlier skew in histogram!
    let minVal = Math.min(getPercentile(finalA, 1), getPercentile(finalB, 1));
    let maxVal = Math.max(getPercentile(finalA, 98), getPercentile(finalB, 98));
    
    // Safety check if parameters zero out variables completely
    if (minVal === maxVal) { maxVal = minVal + 10000; minVal = minVal - 10000; }

    const numBins = 40;
    let step = (maxVal - minVal) / numBins;
    if (step <= 0) step = 1000;

    const binsA = new Array(numBins).fill(0);
    const binsB = new Array(numBins).fill(0);
    const binLabels = [];

    for(let i=0; i<numBins; i++) {
        let bStart = minVal + (i * step);
        let bEnd = bStart + step;
        let suffix = (i === numBins - 1) ? '+' : ''; // top bin collects all overflows
        binLabels.push(`${formatCompact.format(bStart)} - ${formatCompact.format(bEnd)}${suffix}`);
    }

    for(let i=0; i<finalA.length; i++) {
        let valA = finalA[i] > maxVal ? maxVal : finalA[i];
        if (valA < minVal) valA = minVal;
        let idxA = Math.floor((valA - minVal) / step);
        if (idxA >= numBins) idxA = numBins - 1;
        if (idxA < 0) idxA = 0;
        binsA[idxA]++;

        let valB = finalB[i] > maxVal ? maxVal : finalB[i];
        if (valB < minVal) valB = minVal;
        let idxB = Math.floor((valB - minVal) / step);
        if (idxB >= numBins) idxB = numBins - 1;
        if (idxB < 0) idxB = 0;
        binsB[idxB]++;
    }

    if (distributionChart) {
        distributionChart.data.labels = binLabels;
        distributionChart.data.datasets[0].data = binsA;
        distributionChart.data.datasets[1].data = binsB;
        distributionChart.update('none'); // Hot update, avoiding DOM destroy freezes
    } else {
        const ctx = document.getElementById('distributionChart').getContext('2d');
        distributionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: binLabels,
                datasets: [
                    {
                        label: 'Lump Sum Frequency',
                        data: binsA,
                        backgroundColor: 'rgba(6, 182, 212, 0.4)',
                        borderColor: 'rgba(6, 182, 212, 1)',
                        borderWidth: 1,
                        barPercentage: 1.0,
                        categoryPercentage: 0.5
                    },
                    {
                        label: 'Yearly Frequency',
                        data: binsB,
                        backgroundColor: 'rgba(236, 72, 153, 0.4)',
                        borderColor: 'rgba(236, 72, 153, 1)',
                        borderWidth: 1,
                        barPercentage: 1.0,
                        categoryPercentage: 0.5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: { backgroundColor: 'rgba(24, 24, 27, 0.95)', titleFont: { family: 'Inter', size: 14 }, bodyFont: { family: 'Inter', size: 13 }, padding: 12, borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                        ticks: { color: 'rgba(255,255,255,0.5)', font: { family: 'Inter' }, maxTicksLimit: 8 }
                    },
                    y: {
                        border: { display: false },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: 'rgba(255,255,255,0.5)', font: { family: 'Inter' } },
                        title: { display: true, text: 'Number of Occurrences (Out of 10,000)', color: 'rgba(255,255,255,0.5)', font: { family: 'Inter' } }
                    }
                }
            }
        });
    }
}

function renderSurvivalChart() {
    if (!currentSimState) return;
    const { allA, allB, labels } = currentSimState;
    const ctx = document.getElementById('survivalChart').getContext('2d');
    
    // Array length bounds check
    if (!allA || allA.length === 0) return;
    const passes = allA[0].length;
    const years = allA.length;
    let aRates = [];
    let bRates = [];

    // Check if Strategy B is perpetually safe
    const pension = Number(elements.pension.value);
    const spending = Number(elements.spending.value);
    const inflationRate = elements.inflation ? Number(elements.inflation.value) / 100 : 0.025;

    for (let y = 0; y < years; y++) {
        let aCount = 0;
        let bCount = 0;
        let bSafeInf = spending * Math.pow(1 + inflationRate, y);

        for (let p = 0; p < passes; p++) {
            if (allA[y][p] > 0) aCount++;
            if (allB[y][p] > 0 || pension >= bSafeInf) bCount++;
        }
        aRates.push((aCount / passes) * 100);
        bRates.push((bCount / passes) * 100);
    }

    if (survivalChart) {
        survivalChart.data.labels = labels;
        survivalChart.data.datasets[0].data = aRates;
        survivalChart.data.datasets[1].data = bRates;
        survivalChart.update();
    } else {
        survivalChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Lump Sum Survival', data: aRates, borderColor: 'rgba(6, 182, 212, 1)', backgroundColor: 'transparent', borderWidth: 3, pointRadius: 0, tension: 0.1 },
                    { label: 'Yearly Payout Survival', data: bRates, borderColor: 'rgba(236, 72, 153, 1)', backgroundColor: 'transparent', borderWidth: 3, pointRadius: 0, tension: 0.1 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: { 
                        backgroundColor: 'rgba(24, 24, 27, 0.95)', titleFont: { family: 'Inter', size: 14 }, bodyFont: { family: 'Inter', size: 13 }, padding: 12, borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
                        callbacks: { label: function(context) { return ' ' + context.dataset.label + ': ' + context.parsed.y.toFixed(2) + '%'; } }
                    }
                },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }, ticks: { color: 'rgba(255,255,255,0.5)', font: { family: 'Inter' }, maxTicksLimit: 10 } },
                    y: { max: 100, min: 0, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { callback: function(v){ return v + '%'; }, color: 'rgba(255,255,255,0.5)', font: { family: 'Inter' }, stepSize: 20 } }
                }
            }
        });
    }
}

['input', 'change'].forEach(evt => {
    document.querySelectorAll('input[type="range"]').forEach(input => {
        input.addEventListener(evt, () => {
            updateValueDisplays();
        });
    });
});

elements.showPaths.addEventListener('change', () => renderChart(true));
if (elements.showSurvival) {
    elements.showSurvival.addEventListener('change', (e) => {
        const wrapper = document.getElementById('survivalWrapper');
        if (e.target.checked) {
            wrapper.style.maxHeight = '600px';
            wrapper.style.opacity = '1';
            renderSurvivalChart();
            // Scroll to it smoothly for good UX
            setTimeout(() => { wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
        } else {
            wrapper.style.maxHeight = '0';
            wrapper.style.opacity = '0';
        }
    });
}
elements.btn.addEventListener('click', runSimulation);

// Initialize
updateValueDisplays();
// Add a small delay for load animation then run initial sim
setTimeout(runSimulation, 500);
