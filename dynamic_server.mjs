import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

import { default as express } from 'express';
import { default as sqlite3 } from 'sqlite3';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const port = 8080;
const root = path.join(__dirname, 'public');
const template = path.join(__dirname, 'templates');

const dbPath = path.join(__dirname, 'data', 'traffic.sqlite3');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('SQLite open error:', err.message);
  else console.log('Connected to traffic.sqlite3 database');
});

let app = express();
app.use(express.static(root));
app.get('/api/top10', (req, res) => {
  const sql = `
    SELECT
      location_name,
      /* pick ONE of these and keep it: */
      -- MAX(avg_daily_vol) AS value   -- peak observed average volume
      AVG(avg_daily_vol) AS value     -- typical average across observations
      -- SUM(avg_daily_vol) AS value  -- total if rows represent disjoint counts

    FROM counts
    WHERE avg_daily_vol IS NOT NULL
    GROUP BY location_name
    ORDER BY value DESC
    LIMIT 10;
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
