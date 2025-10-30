window.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('/api/top10');
  const rows = await res.json();

  const labels = rows.map(r => r.label);
  const values = rows.map(r => r.value);

  new Chart(document.getElementById('topChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Average Daily Volume', data: values }]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
});
