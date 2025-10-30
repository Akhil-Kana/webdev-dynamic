// public/js/chart-page.js
let chart;

const el = (id) => document.getElementById(id);

async function fetchYears() {
  const res = await fetch('/api/years');
  if (!res.ok) throw new Error('Failed to load years');
  return res.json(); // ["2025","2024",...]
}

async function loadChart(year = '') {
  const q = year ? `?year=${encodeURIComponent(year)}` : '';
  const res = await fetch(`/api/top10${q}`);
  if (!res.ok) throw new Error('Failed to load chart data');
  const rows = await res.json(); // [{label, value}, ...]

  const labels = rows.map(r => r.label);
  const values = rows.map(r => r.value);

  const ctx = el('topChart').getContext('2d');
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Average Daily Volume',
        data: values,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: { ticks: { autoSkip: true, maxRotation: 0 } },
        y: { beginAtZero: true }
      }
    }
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  // populate year dropdown
  try {
    const years = await fetchYears(); // newest → oldest
    const sel = el('yearSel');
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      sel.appendChild(opt);
    });

    // initial load (all years)
    await loadChart('');

    // reload chart when year changes
    sel.addEventListener('change', e => {
      loadChart(e.target.value || '');
    });
  } catch (err) {
    console.error(err);
    // optional: show a small inline error
  }
});
