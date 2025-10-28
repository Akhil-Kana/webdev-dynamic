// public/js/chart.js
window.addEventListener("DOMContentLoaded", async () => {
  const canvas = document.getElementById("trafficChart");
  if (!canvas) return console.error("No #trafficChart canvas found");
  const ctx = canvas.getContext("2d");

  try {
    const res = await fetch("/api/top10");
    const rows = await res.json();

    const labels = rows.map(r => r.location_name);
    const values = rows.map(r => Number(r.value));

    new Chart(ctx, {
      type: "bar",
      data: { labels, datasets: [{ label: "Avg Daily Volume", data: values, borderWidth: 2 }] },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  } catch (e) {
    console.error(e);
    canvas.insertAdjacentHTML("afterend", `<p style="color:red">${e.message}</p>`);
  }
});
