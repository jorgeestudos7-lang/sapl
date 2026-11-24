const path = require('path');
const express = require('express');

const apiRoutes = require('./src/routes/api');
const pageRoutes = require('./src/routes/pages');
const store = require('./src/data/store');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve compiled SAPL static assets (CSS, JS, images, fonts)
app.use('/static', express.static(path.join(__dirname, 'public', 'static')));

// Health endpoints
app.get(['/healthz', '/readyz', '/api/healthz', '/api/readyz'], (req, res) => {
  res.json({ status: 'ok', service: 'sapl', version: store.casaLegislativa.versao });
});

// Routes
app.use(apiRoutes);
app.use(pageRoutes);

// 404 fallback
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(501).json({ error: 'Not yet migrated', path: req.originalUrl });
  }
  res.status(404).render('not_found', {
    casa: store.casaLegislativa,
    currentPath: req.path,
    title: 'Página não encontrada — SAPL',
    message: `A rota "${req.originalUrl}" não foi encontrada ou ainda não foi migrada.`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[SAPL Server Error]', err);
  if (req.path.startsWith('/api')) {
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
  res.status(500).send('Erro interno no servidor.');
});

app.listen(PORT, HOST, () => {
  console.log(`SAPL server running at http://${HOST}:${PORT}`);
});
