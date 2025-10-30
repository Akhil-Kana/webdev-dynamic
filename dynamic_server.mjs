// imports
import * as fs from "node:fs";
import * as path from "node:path";
import express from "express";
import sqlite3 from "sqlite3";

// directories
const publicDir = path.resolve("public");
const templatesDir = path.resolve("templates");

const app = express();
app.use(express.static(publicDir));

// explicit home route for render
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: publicDir });
});

// Database connection
const db = new sqlite3.Database("data/traffic.sqlite3", (err) => {
  if (err) console.error("SQLite open error:", err.message);
  else console.log("Connected to traffic.sqlite3 database");
});

// List routes
app.get("/locations", (req, res) => {
  let count = 0;
  let template = "";
  let rows = [];

  function maybeSend() {
    if (count < 2) return;
    let items = "";
    for (let r of rows) {
      items += `<li><a href="/locations/${encodeURIComponent(r.name)}">${
        r.name
      }</a></li>`;
    }

    let html = template
      .replaceAll("$$$TITLE$$$", "Locations")
      .replaceAll("$$$NAV$$$", "")
      .replaceAll("$$$LIST_ITEMS$$$", items);

    res.status(200).type("html").send(html);
  }

  fs.readFile(path.join(templatesDir, "list.html"), "utf8", (err, data) => {
    if (err) return res.status(500).send(err.message);
    template = data;
    count++;
    maybeSend();
  });

  db.all(
    `SELECT DISTINCT location_name AS name
     FROM counts
     WHERE name IS NOT NULL
     ORDER BY name
     LIMIT 500;`,
    [],
    (err, r) => {
      if (err) return res.status(500).send(err.message);
      rows = r;
      count++;
      maybeSend();
    }
  );
});

app.get("/years", (req, res) => {
  let count = 0;
  let template = "";
  let rows = [];

  function maybeSend() {
    if (count < 2) return;

    let items = "";
    for (let r of rows) {
      items += `<li><a href="/years/${r.yr}">${r.yr}</a></li>`;
    }

    let html = template
      .replaceAll("$$$TITLE$$$", "Years")
      .replaceAll("$$$NAV$$$", "")
      .replaceAll("$$$LIST_ITEMS$$$", items);

    res.status(200).type("html").send(html);
  }

  fs.readFile(path.join(templatesDir, "list.html"), "utf8", (err, data) => {
    if (err) return res.status(500).send(err.message);
    template = data;
    count++;
    maybeSend();
  });

  db.all(
    `SELECT DISTINCT strftime('%Y', count_date_start) AS yr
     FROM counts
     WHERE yr IS NOT NULL
     ORDER BY yr DESC;`,
    [],
    (err, r) => {
      if (err) return res.status(500).send(err.message);
      rows = r;
      count++;
      maybeSend();
    }
  );
});

app.get("/types", (req, res) => {
  let count = 0;
  let template = "";
  let rows = [];

  function maybeSend() {
    if (count < 2) return;

    let items = "";
    for (let r of rows) {
      items += `<li><a href="/types/${encodeURIComponent(r.tp)}">${
        r.tp
      }</a></li>`;
    }

    let html = template
      .replaceAll("$$$TITLE$$$", "Types")
      .replaceAll("$$$NAV$$$", "")
      .replaceAll("$$$LIST_ITEMS$$$", items);

    res.status(200).type("html").send(html);
  }

  fs.readFile(path.join(templatesDir, "list.html"), "utf8", (err, data) => {
    if (err) return res.status(500).send(err.message);
    template = data;
    count++;
    maybeSend();
  });

  db.all(
    `SELECT DISTINCT count_type AS tp
     FROM counts
     WHERE tp IS NOT NULL
     ORDER BY tp;`,
    [],
    (err, r) => {
      if (err) return res.status(500).send(err.message);
      rows = r;
      count++;
      maybeSend();
    }
  );
});

// detaile route
app.get("/locations/:name", (req, res) => {
  const name = req.params.name;

  let count = 0;
  let template = "";
  let weekly = [];
  let dow = [];

  function maybeSend() {
    if (count < 3) return;

    // If no data then custom 404
    if ((!weekly || weekly.length === 0) && (!dow || dow.length === 0)) {
      let html = template
        .replaceAll("$$$TITLE$$$", "404 — Not Found")
        .replaceAll("$$$SUBTITLE$$$", "")
        .replaceAll("$$$MEDIA$$$", "")
        .replaceAll("$$$BODY$$$", `Error: no data for location ${name}`)
        .replaceAll("$$$NAV$$$", `<a href="/locations">Back to Locations</a>`);
      return res.status(404).type("html").send(html);
    }

    // Build charts HTML (two canvases): weekly + day-of-week
    const charts = `
      <div style="display:grid; gap:24px;">
        <section>
          <h4>Weekly Average Volume</h4>
          <canvas id="chartWeekly" width="700" height="320"></canvas>
        </section>

        <section>
          <h4>Average by Day of Week</h4>
          <canvas id="chartDOW" width="700" height="240"></canvas>
        </section>
      </div>

      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script>
        // Server data:
        const weekly = ${JSON.stringify(
          weekly
        )}; // [{label:'YYYY-WW', value:...}]
        const dow    = ${JSON.stringify(
          dow
        )};    // [{dow:'0', value:...}] 0=Sun

        // --- Weekly line or bar depending on density ---
        (function(){
          if (!weekly || weekly.length === 0) return;

          const ctx = document.getElementById('chartWeekly');
          const labels = weekly.map(r => r.label); // 'YYYY-WW'
          const data   = weekly.map(r => r.value);
          const type   = weekly.length >= 6 ? 'line' : (weekly.length >= 3 ? 'bar' : 'bar');

          new Chart(ctx, {
            type,
            data: {
              labels,
              datasets: [{
                label: 'Avg Daily Volume (weekly)',
                data,
                borderWidth: 2,
                pointRadius: 3
              }]
            }
          });
        })();

        // --- Day-of-Week bar chart (Sun..Sat) ---
        (function(){
          if (!dow || dow.length === 0) return;

          // Map 0..6 to Sun..Sat, put in canonical order
          const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          const map = Object.fromEntries(dow.map(r => [String(r.dow), r.value]));
          const labels = names;
          const data   = [0,1,2,3,4,5,6].map(i => map[String(i)] ?? 0);

          const ctx = document.getElementById('chartDOW');
          new Chart(ctx, {
            type: 'bar',
            data: {
              labels,
              datasets: [{
                label: 'Avg Daily Volume (by weekday)',
                data
              }]
            }
          });
        })();
      </script>
    `;

    let html = template
      .replaceAll("$$$TITLE$$$", name)
      .replaceAll("$$$SUBTITLE$$$", "Weekly averages + weekday pattern")
      .replaceAll("$$$MEDIA$$$", charts)
      .replaceAll("$$$BODY$$$", "")
      .replaceAll("$$$NAV$$$", `<a href="/locations">Back to Locations</a>`);

    res.status(200).type("html").send(html);
  }

  // template
  fs.readFile(path.join(templatesDir, "detail.html"), "utf8", (err, data) => {
    if (err) return res.status(500).send(err.message);
    template = data;
    count++;
    maybeSend();
  });

  // weekly series: group by week label YYYY-WW
  db.all(
    `SELECT strftime('%Y-%W', count_date_start) AS label,
            AVG(avg_daily_vol) AS value
     FROM counts
     WHERE location_name = ?
       AND avg_daily_vol IS NOT NULL
     GROUP BY label
     ORDER BY label;`,
    [name],
    (err, r) => {
      if (err) return res.status(500).send(err.message);
      weekly = r;
      count++;
      maybeSend();
    }
  );

  // day-of-week average: 0=Sun .. 6=Sat
  db.all(
    `SELECT strftime('%w', count_date_start) AS dow,
            AVG(avg_daily_vol) AS value
     FROM counts
     WHERE location_name = ?
       AND avg_daily_vol IS NOT NULL
     GROUP BY dow
     ORDER BY dow;`,
    [name],
    (err, r) => {
      if (err) return res.status(500).send(err.message);
      dow = r;
      count++;
      maybeSend();
    }
  );
});

app.get("/years/:yr", (req, res) => {
  const yr = req.params.yr;
  let count = 0;
  let template = "";
  let series = [];

  function maybeSend() {
    if (count < 2) return;

    if (!series || series.length === 0) {
      let html = template
        .replaceAll("$$$TITLE$$$", "404 — Not Found")
        .replaceAll("$$$SUBTITLE$$$", "")
        .replaceAll("$$$MEDIA$$$", "")
        .replaceAll("$$$BODY$$$", `Error: no data for year ${yr}`)
        .replaceAll("$$$NAV$$$", `<a href="/years">Back to Years</a>`);
      return res.status(404).type("html").send(html);
    }

    const chart = `
      <canvas id="chart" width="600" height="300"></canvas>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script>
        const data = ${JSON.stringify(series)};
        if (data.length) {
          new Chart(document.getElementById('chart'), {
            type: 'line',
            data: {
              labels: data.map(r => r.label),
              datasets: [{
                label: 'Avg Daily Volume',
                data: data.map(r => r.value),
                borderWidth: 2
              }]
            }
          });
        }
      </script>
    `;

    let html = template
      .replaceAll("$$$TITLE$$$", yr)
      .replaceAll("$$$SUBTITLE$$$", "Average Daily Volume Over Time")
      .replaceAll("$$$MEDIA$$$", chart)
      .replaceAll("$$$BODY$$$", "")
      .replaceAll("$$$NAV$$$", `<a href="/years">Back to Years</a>`);
    res.status(200).type("html").send(html);
  }

  fs.readFile(path.join(templatesDir, "detail.html"), "utf8", (err, data) => {
    if (err) return res.status(500).send(err.message);
    template = data;
    count++;
    maybeSend();
  });

  db.all(
    `SELECT count_date_start AS label, avg_daily_vol AS value
     FROM counts
     WHERE strftime('%Y', count_date_start) = ?
       AND avg_daily_vol IS NOT NULL
     ORDER BY count_date_start;`,
    [yr],
    (err, r) => {
      if (err) return res.status(500).send(err.message);
      series = r;
      count++;
      maybeSend();
    }
  );
});

app.get("/types/:tp", (req, res) => {
  const tp = req.params.tp;
  let count = 0;
  let template = "";
  let series = [];

  function maybeSend() {
    if (count < 2) return;

    if (!series || series.length === 0) {
      let html = template
        .replaceAll("$$$TITLE$$$", "404 — Not Found")
        .replaceAll("$$$SUBTITLE$$$", "")
        .replaceAll("$$$MEDIA$$$", "")
        .replaceAll("$$$BODY$$$", `Error: no data for type ${tp}`)
        .replaceAll("$$$NAV$$$", `<a href="/types">Back to Types</a>`);
      return res.status(404).type("html").send(html);
    }

    const chart = `
      <canvas id="chart" width="600" height="300"></canvas>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script>
        const data = ${JSON.stringify(series)};
        if (data.length) {
          new Chart(document.getElementById('chart'), {
            type: 'line',
            data: {
              labels: data.map(r => r.label),
              datasets: [{
                label: 'Avg Daily Volume',
                data: data.map(r => r.value),
                borderWidth: 2
              }]
            }
          });
        }
      </script>
    `;

    let html = template
      .replaceAll("$$$TITLE$$$", tp)
      .replaceAll("$$$SUBTITLE$$$", "Average Daily Volume Over Time")
      .replaceAll("$$$MEDIA$$$", chart)
      .replaceAll("$$$BODY$$$", "")
      .replaceAll("$$$NAV$$$", `<a href="/types">Back to Types</a>`);
    res.status(200).type("html").send(html);
  }

  fs.readFile(path.join(templatesDir, "detail.html"), "utf8", (err, data) => {
    if (err) return res.status(500).send(err.message);
    template = data;
    count++;
    maybeSend();
  });

  db.all(
    `SELECT count_date_start AS label, avg_daily_vol AS value
     FROM counts
     WHERE count_type = ?
       AND avg_daily_vol IS NOT NULL
     ORDER BY count_date_start;`,
    [tp],
    (err, r) => {
      if (err) return res.status(500).send(err.message);
      series = r;
      count++;
      maybeSend();
    }
  );
});

// Generic 404 for bad routes
app.use((req, res) => {
  res.status(404).sendFile("404.html", { root: publicDir });
});

// Start the server
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
