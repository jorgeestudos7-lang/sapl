const express = require('express');
const store = require('../data/store');

const router = express.Router();

function paginate(items, req) {
  if (req.query.get_all === 'true') {
    return items;
  }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(req.query.page_size, 10) || 10));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const results = items.slice(start, start + pageSize);
  return {
    pagination: {
      links: {
        next: page < totalPages ? `?page=${page + 1}` : null,
        previous: page > 1 ? `?page=${page - 1}` : null
      },
      total_pages: totalPages,
      total_entries: total,
      page,
      page_size: pageSize
    },
    results
  };
}

// Base endpoints
router.get('/api/base/casalegislativa/', (req, res) => {
  res.json(paginate([store.casaLegislativa], req));
});

router.get('/api/base/autor', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  const autores = store.parlamentares
    .map(p => ({ id: p.id, nome: p.nome_parlamentar, tipo: 'Parlamentar' }))
    .filter(a => !q || a.nome.toLowerCase().includes(q));
  res.json(paginate(autores, req));
});

// Parlamentares endpoints (used by Vue app in parlamentar.f63027a7.js)
router.get('/api/parlamentares/legislatura/', (req, res) => {
  res.json(paginate(store.legislaturas, req));
});

router.get('/api/parlamentares/legislatura/:id/parlamentares/', (req, res) => {
  const legId = parseInt(req.params.id, 10);
  const filtered = store.parlamentares.filter(p => p.legislaturas.includes(legId));
  res.json(paginate(filtered, req));
});

router.get('/api/parlamentares/parlamentar/search_parlamentares/', (req, res) => {
  const q = (req.query.nome_parlamentar || '').toLowerCase().trim();
  const filtered = store.parlamentares.filter(p =>
    !q ||
    p.nome_parlamentar.toLowerCase().includes(q) ||
    p.nome_completo.toLowerCase().includes(q)
  );
  res.json(filtered);
});

router.get('/api/parlamentares/parlamentar/', (req, res) => {
  res.json(paginate(store.parlamentares, req));
});

router.get('/api/parlamentares/parlamentar/:id/', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = store.parlamentares.find(p => p.id === id);
  if (!item) return res.status(404).json({ detail: 'Não encontrado.' });
  res.json(item);
});

router.get('/api/parlamentares/partido/', (req, res) => {
  res.json(paginate(store.partidos, req));
});

// Comissões endpoints
router.get('/api/comissoes/comissao/', (req, res) => {
  res.json(paginate(store.comissoes, req));
});

router.get('/api/comissoes/comissao/:id/', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = store.comissoes.find(c => c.id === id);
  if (!item) return res.status(404).json({ detail: 'Não encontrado.' });
  res.json(item);
});

// Matérias Legislativas endpoints
router.get('/api/materia/tipomaterialegislativa/', (req, res) => {
  res.json(paginate(store.tiposMateria, req));
});

router.get('/api/materia/materialegislativa/', (req, res) => {
  let items = [...store.materias];
  const { tipo, ano, numero, ementa, em_tramitacao } = req.query;
  if (tipo) items = items.filter(m => String(m.tipo_id) === String(tipo) || m.tipo_sigla === String(tipo).toUpperCase());
  if (ano) items = items.filter(m => String(m.ano) === String(ano));
  if (numero) items = items.filter(m => String(m.numero) === String(numero));
  if (ementa) items = items.filter(m => m.ementa.toLowerCase().includes(String(ementa).toLowerCase()));
  if (em_tramitacao === 'true') items = items.filter(m => m.em_tramitacao);
  if (em_tramitacao === 'false') items = items.filter(m => !m.em_tramitacao);
  res.json(paginate(items, req));
});

router.get('/api/materia/materialegislativa/:id/', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = store.materias.find(m => m.id === id);
  if (!item) return res.status(404).json({ detail: 'Não encontrado.' });
  res.json(item);
});

router.post('/api/materia/materialegislativa/', (req, res) => {
  const tipoId = parseInt(req.body.tipo_id || 1, 10);
  const tipoObj = store.tiposMateria.find(t => t.id === tipoId) || store.tiposMateria[0];
  const ano = parseInt(req.body.ano || new Date().getFullYear(), 10);
  const numero = parseInt(req.body.numero, 10) || (store.materias.filter(m => m.tipo_id === tipoObj.id && m.ano === ano).length + 1);
  const autorId = parseInt(req.body.autor_id || 1, 10);
  const autorObj = store.parlamentares.find(p => p.id === autorId) || store.parlamentares[0];
  const nova = {
    id: store.getNextMateriaId(),
    tipo_id: tipoObj.id,
    tipo_sigla: tipoObj.sigla,
    tipo_descricao: tipoObj.descricao,
    numero,
    ano,
    data_apresentacao: req.body.data_apresentacao || new Date().toISOString().slice(0, 10),
    ementa: String(req.body.ementa || '').trim() || 'Matéria legislativa protocolada.',
    autor_id: autorObj.id,
    autor_nome: autorObj.nome_parlamentar,
    em_tramitacao: true,
    regime_tramitacao: req.body.regime_tramitacao || 'Ordinária',
    status: 'Protocolada para leitura no Expediente',
    localizacao: 'Protocolo Legislativo',
    indexacao: String(req.body.indexacao || ''),
    tramitacoes: [
      {
        data: new Date().toISOString().slice(0, 10),
        origem: 'Protocolo Legislativo',
        destino: 'Secretaria Legislativa',
        status: 'Protocolada',
        texto: 'Matéria recebida no sistema.'
      }
    ]
  };
  store.materias.unshift(nova);
  res.status(201).json(nova);
});

// Normas Jurídicas endpoints
router.get('/api/norma/tiponormajuridica/', (req, res) => {
  res.json(paginate(store.tiposNorma, req));
});

router.get('/api/norma/normajuridica/', (req, res) => {
  let items = [...store.normas];
  const { tipo, ano, numero, ementa } = req.query;
  if (tipo) items = items.filter(n => String(n.tipo_id) === String(tipo) || n.tipo_sigla === String(tipo).toUpperCase());
  if (ano) items = items.filter(n => String(n.ano) === String(ano));
  if (numero) items = items.filter(n => String(n.numero) === String(numero));
  if (ementa) items = items.filter(n => n.ementa.toLowerCase().includes(String(ementa).toLowerCase()));
  res.json(paginate(items, req));
});

router.get('/api/norma/normajuridica/:id/', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = store.normas.find(n => n.id === id);
  if (!item) return res.status(404).json({ detail: 'Não encontrado.' });
  res.json(item);
});

// Sessões Plenárias endpoints
router.get('/api/sessao/sessaoplenaria/years/', (req, res) => {
  const years = [...new Set(store.sessoes.map(s => Number(s.data_inicio.slice(0, 4))))].sort((a, b) => b - a);
  res.json(years.map(y => ({ value: y, text: String(y) })));
});

router.get('/api/sessao/sessaoplenaria/', (req, res) => {
  res.json(paginate(store.sessoes, req));
});

router.get('/api/sessao/sessaoplenaria/:id/', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = store.sessoes.find(s => s.id === id);
  if (!item) return res.status(404).json({ detail: 'Não encontrado.' });
  res.json(item);
});

// Painel Eletrônico JSON endpoints (matches sapl/painel/views.py)
function buildPainelData(sessao) {
  const materiaItem =
    sessao.ordem_dia.find(o => o.votacao_aberta) ||
    sessao.expediente_materias.find(e => e.votacao_aberta) ||
    sessao.ordem_dia[0] ||
    sessao.expediente_materias[0] ||
    null;

  const presentes = sessao.presentes_ids
    .map(pid => store.parlamentares.find(p => p.id === pid))
    .filter(Boolean)
    .map(p => ({
      id: p.id,
      parlamentar_id: p.id,
      nome: p.nome_parlamentar,
      partido: p.partido,
      voto: materiaItem && materiaItem.votos ? (materiaItem.votos[p.id] || '') : ''
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  let votosSim = 0;
  let votosNao = 0;
  let abstencoes = 0;
  let materiaTexto = '';
  let materiaEmenta = '';
  let tipoVotacao = '';
  let tipoResultado = 'Ainda não foi votada.';
  let observacao = '';

  if (materiaItem) {
    const mat = store.materias.find(m => m.id === materiaItem.materia_id);
    materiaTexto = mat ? `${mat.tipo_sigla} nº ${mat.numero}/${mat.ano}` : `Matéria #${materiaItem.materia_id}`;
    materiaEmenta = mat ? mat.ementa : '';
    tipoVotacao = materiaItem.tipo_votacao === 2 ? 'Nominal' : materiaItem.tipo_votacao === 1 ? 'Simbólica' : 'Leitura';
    observacao = materiaItem.observacao || '';
    tipoResultado = materiaItem.votacao_aberta ? 'Votação em andamento' : (materiaItem.resultado || 'Encerrada');
    Object.values(materiaItem.votos || {}).forEach(v => {
      if (v === 'Sim') votosSim += 1;
      else if (v === 'Não') votosNao += 1;
      else if (v === 'Abstenção') abstencoes += 1;
    });
  }

  return {
    sessao_plenaria: sessao.__str__,
    sessao_plenaria_data: sessao.data_inicio.split('-').reverse().join('/'),
    sessao_plenaria_hora_inicio: sessao.hora_inicio,
    sessao_solene: sessao.tipo === 'Solene',
    sessao_finalizada: sessao.finalizada,
    tema_solene: sessao.tema_solene,
    cronometro_aparte: sessao.cronometros.aparte,
    cronometro_discurso: sessao.cronometros.discurso,
    cronometro_ordem: sessao.cronometros.ordem,
    cronometro_consideracoes: sessao.cronometros.consideracoes,
    status_painel: sessao.painel_aberto,
    brasao: '/static/sapl/frontend/img/brasao_transp.gif',
    mostrar_voto: true,
    presentes,
    num_presentes: presentes.length,
    oradores: sessao.oradores,
    msg_painel: materiaItem ? (materiaItem.votacao_aberta ? 'Votação aberta!' : 'Resultado registrado') : 'Nenhuma matéria disponível para votação.',
    materia_legislativa_texto: materiaTexto,
    materia_legislativa_ementa: materiaEmenta,
    observacao_materia: observacao,
    tipo_votacao: tipoVotacao,
    tipo_resultado: tipoResultado,
    numero_votos_sim: votosSim,
    numero_votos_nao: votosNao,
    numero_abstencoes: abstencoes,
    total_votos: votosSim + votosNao + abstencoes,
    registro: materiaItem ? !materiaItem.votacao_aberta : null
  };
}

router.get('/painel/:id/dados', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const sessao = store.sessoes.find(s => s.id === id);
  if (!sessao) return res.status(404).json({ error: 'Sessão não encontrada' });
  res.json(buildPainelData(sessao));
});

router.post('/painel/:id/votar', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const sessao = store.sessoes.find(s => s.id === id);
  if (!sessao) return res.status(404).json({ error: 'Sessão não encontrada' });
  const parlamentarId = parseInt(req.body.parlamentar_id, 10);
  const voto = req.body.voto;
  if (!['Sim', 'Não', 'Abstenção'].includes(voto)) {
    return res.status(400).json({ error: 'Voto inválido' });
  }
  const materiaItem = sessao.ordem_dia.find(o => o.votacao_aberta) || sessao.ordem_dia[0];
  if (!materiaItem) return res.status(400).json({ error: 'Nenhuma matéria aberta na Ordem do Dia' });
  materiaItem.votos[parlamentarId] = voto;
  res.json(buildPainelData(sessao));
});

router.post('/painel/switch-painel', (req, res) => {
  const id = parseInt(req.body.pk_sessao, 10);
  const sessao = store.sessoes.find(s => s.id === id);
  if (!sessao) return res.status(404).json({ error: 'Sessão não encontrada' });
  sessao.painel_aberto = Boolean(req.body.aberto === true || req.body.aberto === 'true');
  res.json({ status_painel: sessao.painel_aberto });
});

router.get('/painel/cronometro', (req, res) => {
  const id = parseInt(req.query.pk_sessao || 1, 10);
  const sessao = store.sessoes.find(s => s.id === id);
  if (sessao && req.query.tipo && req.query.action && Object.prototype.hasOwnProperty.call(sessao.cronometros, req.query.tipo)) {
    sessao.cronometros[req.query.tipo] = String(req.query.action);
  }
  res.json(sessao ? sessao.cronometros : {});
});

// Protocolo / Documento Administrativo API
router.get('/api/protocoloadm/protocolo/', (req, res) => {
  res.json(paginate(store.protocolos, req));
});

router.get('/api/protocoloadm/documentoadministrativo/', (req, res) => {
  res.json(paginate(store.documentosAdministrativos, req));
});

// Audiências Públicas API
router.get('/api/audiencia/audienciapublica/', (req, res) => {
  res.json(paginate(store.audiencias, req));
});

// Stub remaining un-migrated /api/* routes per migration guidelines
router.use('/api', (req, res) => {
  res.status(501).json({ error: 'Not yet migrated', path: req.originalUrl });
});

module.exports = router;
