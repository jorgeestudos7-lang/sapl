const express = require('express');
const store = require('../data/store');

const router = express.Router();

function baseLocals(req, extra = {}) {
  return {
    casa: store.casaLegislativa,
    currentPath: req.path,
    title: 'SAPL - Sistema de Apoio ao Processo Legislativo',
    ...extra
  };
}

// Home
router.get('/', (req, res) => {
  res.render('index', baseLocals(req, {
    title: `${store.casaLegislativa.nome} — SAPL`
  }));
});

// Parlamentares (Vue 2 #app2 powered by /static/sapl/frontend/js/parlamentar.f63027a7.js)
router.get(['/parlamentar', '/parlamentar/', '/parlamentar/pesquisar-parlamentar', '/parlamentar/pesquisar-parlamentar/'], (req, res) => {
  res.render('parlamentares', baseLocals(req, {
    title: 'Parlamentares — SAPL'
  }));
});

router.get('/parlamentar/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const parlamentar = store.parlamentares.find(p => p.id === id);
  if (!parlamentar) return res.status(404).render('not_found', baseLocals(req, { message: 'Parlamentar não encontrado.' }));

  const materiasAutoria = store.materias.filter(m => m.autor_id === parlamentar.id);
  const comissoesMembro = store.comissoes
    .map(c => {
      const membro = c.membros.find(m => m.parlamentar_id === parlamentar.id);
      return membro ? { comissao: c, cargo: membro.cargo } : null;
    })
    .filter(Boolean);

  res.render('parlamentar_detail', baseLocals(req, {
    title: `${parlamentar.nome_parlamentar} — SAPL`,
    parlamentar,
    materiasAutoria,
    comissoesMembro
  }));
});

// Mesa Diretora
router.get(['/mesa-diretora', '/mesa-diretora/'], (req, res) => {
  const sessaoLegId = parseInt(req.query.sessao_legislativa, 10) || store.sessoesLegislativas[0].id;
  const sessaoLeg = store.sessoesLegislativas.find(s => s.id === sessaoLegId) || store.sessoesLegislativas[0];
  const composicao = store.mesaDiretora
    .filter(m => m.sessao_legislativa === sessaoLeg.id)
    .map(m => ({
      ...m,
      parlamentar: store.parlamentares.find(p => p.id === m.parlamentar_id)
    }));

  res.render('mesa_diretora', baseLocals(req, {
    title: 'Mesa Diretora — SAPL',
    sessoesLegislativas: store.sessoesLegislativas,
    sessaoLeg,
    composicao
  }));
});

// Comissões
router.get(['/comissao', '/comissao/'], (req, res) => {
  const natureza = req.query.natureza || '';
  const q = (req.query.q || '').toLowerCase().trim();
  const lista = store.comissoes.filter(c => {
    if (natureza && c.natureza !== natureza) return false;
    if (q && !c.nome.toLowerCase().includes(q) && !c.sigla.toLowerCase().includes(q)) return false;
    return true;
  });
  res.render('comissoes', baseLocals(req, {
    title: 'Comissões — SAPL',
    comissoes: lista,
    natureza,
    q: req.query.q || ''
  }));
});

router.get('/comissao/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const comissao = store.comissoes.find(c => c.id === id);
  if (!comissao) return res.status(404).render('not_found', baseLocals(req, { message: 'Comissão não encontrada.' }));
  const membros = comissao.membros.map(m => ({
    ...m,
    parlamentar: store.parlamentares.find(p => p.id === m.parlamentar_id)
  }));
  const materiasTramitacao = store.materias.filter(m => m.em_tramitacao);
  res.render('comissao_detail', baseLocals(req, {
    title: `${comissao.sigla} — ${comissao.nome} — SAPL`,
    comissao,
    membros,
    materiasTramitacao
  }));
});

// Matérias Legislativas
router.get(['/materia', '/materia/', '/materia/pesquisar-materia'], (req, res) => {
  const { tipo, numero, ano, ementa, em_tramitacao } = req.query;
  const lista = store.materias.filter(m => {
    if (tipo && String(m.tipo_id) !== String(tipo)) return false;
    if (numero && String(m.numero) !== String(numero).trim()) return false;
    if (ano && String(m.ano) !== String(ano).trim()) return false;
    if (ementa && !m.ementa.toLowerCase().includes(String(ementa).toLowerCase().trim())) return false;
    if (em_tramitacao === 'S' && !m.em_tramitacao) return false;
    if (em_tramitacao === 'N' && m.em_tramitacao) return false;
    return true;
  });

  res.render('materias', baseLocals(req, {
    title: 'Matérias Legislativas — SAPL',
    materias: lista,
    tiposMateria: store.tiposMateria,
    parlamentares: store.parlamentares,
    filters: { tipo: tipo || '', numero: numero || '', ano: ano || '', ementa: ementa || '', em_tramitacao: em_tramitacao || '' }
  }));
});

router.post('/materia/create', (req, res) => {
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
    ementa: String(req.body.ementa || '').trim() || 'Nova proposição legislativa.',
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
        texto: 'Matéria incluída via sistema SAPL.'
      }
    ]
  };
  store.materias.unshift(nova);
  res.redirect(`/materia/${nova.id}`);
});

router.get('/materia/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const materia = store.materias.find(m => m.id === id);
  if (!materia) return res.status(404).render('not_found', baseLocals(req, { message: 'Matéria legislativa não encontrada.' }));
  const autor = store.parlamentares.find(p => p.id === materia.autor_id);
  res.render('materia_detail', baseLocals(req, {
    title: `${materia.tipo_sigla} ${materia.numero}/${materia.ano} — SAPL`,
    materia,
    autor,
    statusList: store.statusTramitacao
  }));
});

router.post('/materia/:id/tramitacao', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const materia = store.materias.find(m => m.id === id);
  if (!materia) return res.status(404).render('not_found', baseLocals(req, { message: 'Matéria não encontrada.' }));

  const novaTram = {
    data: new Date().toISOString().slice(0, 10),
    origem: String(req.body.origem || materia.localizacao).trim(),
    destino: String(req.body.destino || 'Mesa Diretora').trim(),
    status: String(req.body.status || 'Em tramitação').trim(),
    texto: String(req.body.texto || 'Tramitação registrada.').trim()
  };
  materia.tramitacoes.push(novaTram);
  materia.localizacao = novaTram.destino;
  materia.status = novaTram.status;
  res.redirect(`/materia/${materia.id}`);
});

// Normas Jurídicas
router.get(['/norma', '/norma/', '/norma/pesquisar'], (req, res) => {
  const { tipo, numero, ano, ementa } = req.query;
  const lista = store.normas.filter(n => {
    if (tipo && String(n.tipo_id) !== String(tipo)) return false;
    if (numero && String(n.numero) !== String(numero).trim()) return false;
    if (ano && String(n.ano) !== String(ano).trim()) return false;
    if (ementa && !n.ementa.toLowerCase().includes(String(ementa).toLowerCase().trim())) return false;
    return true;
  });

  res.render('normas', baseLocals(req, {
    title: 'Normas Jurídicas — SAPL',
    normas: lista,
    tiposNorma: store.tiposNorma,
    filters: { tipo: tipo || '', numero: numero || '', ano: ano || '', ementa: ementa || '' }
  }));
});

router.post('/norma/create', (req, res) => {
  const tipoId = parseInt(req.body.tipo_id || 1, 10);
  const tipoObj = store.tiposNorma.find(t => t.id === tipoId) || store.tiposNorma[0];
  const ano = parseInt(req.body.ano || new Date().getFullYear(), 10);
  const numero = String(req.body.numero || (1420 + store.normas.length)).trim();

  const nova = {
    id: store.getNextNormaId(),
    tipo_id: tipoObj.id,
    tipo_sigla: tipoObj.sigla,
    tipo_descricao: tipoObj.descricao,
    numero,
    ano,
    data: req.body.data || new Date().toISOString().slice(0, 10),
    data_publicacao: req.body.data_publicacao || new Date().toISOString().slice(0, 10),
    esfera_federacao: 'Municipal',
    ementa: String(req.body.ementa || '').trim() || 'Norma jurídica cadastrada.',
    materia_id: null,
    assuntos: String(req.body.assunto || 'Legislação Municipal').split(',').map(s => s.trim()).filter(Boolean),
    texto_compilado: [
      { artigo: 'Art. 1º', texto: String(req.body.texto || 'Esta norma entra em vigor na data de sua publicação.').trim() }
    ]
  };
  store.normas.unshift(nova);
  res.redirect(`/norma/${nova.id}`);
});

router.get('/norma/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const norma = store.normas.find(n => n.id === id);
  if (!norma) return res.status(404).render('not_found', baseLocals(req, { message: 'Norma jurídica não encontrada.' }));
  const materia = norma.materia_id ? store.materias.find(m => m.id === norma.materia_id) : null;
  res.render('norma_detail', baseLocals(req, {
    title: `${norma.tipo_descricao} nº ${norma.numero}/${norma.ano} — SAPL`,
    norma,
    materia
  }));
});

// Sessões Plenárias & Pautas
router.get(['/sessao', '/sessao/', '/sessao/pesquisar-sessao'], (req, res) => {
  const ano = req.query.ano || '';
  const tipo = req.query.tipo || '';
  const lista = store.sessoes.filter(s => {
    if (ano && !s.data_inicio.startsWith(String(ano))) return false;
    if (tipo && s.tipo !== tipo) return false;
    return true;
  });
  res.render('sessoes', baseLocals(req, {
    title: 'Sessões Plenárias — SAPL',
    sessoes: lista,
    filters: { ano, tipo }
  }));
});

router.get(['/sessao/pauta-sessao/pesquisar', '/pautas'], (req, res) => {
  const pautas = store.sessoes.map(s => ({
    sessao: s,
    ordem_dia: s.ordem_dia.map(o => ({ ...o, materia: store.materias.find(m => m.id === o.materia_id) })),
    expediente: s.expediente_materias.map(e => ({ ...e, materia: store.materias.find(m => m.id === e.materia_id) }))
  }));
  res.render('pautas', baseLocals(req, {
    title: 'Pautas das Sessões — SAPL',
    pautas
  }));
});

router.get('/sessao/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const sessao = store.sessoes.find(s => s.id === id);
  if (!sessao) return res.status(404).render('not_found', baseLocals(req, { message: 'Sessão plenária não encontrada.' }));
  const presentes = sessao.presentes_ids.map(pid => store.parlamentares.find(p => p.id === pid)).filter(Boolean);
  const ordemDia = sessao.ordem_dia.map(o => ({ ...o, materia: store.materias.find(m => m.id === o.materia_id) }));
  const expediente = sessao.expediente_materias.map(e => ({ ...e, materia: store.materias.find(m => m.id === e.materia_id) }));
  res.render('sessao_detail', baseLocals(req, {
    title: `${sessao.__str__} — SAPL`,
    sessao,
    presentes,
    ordemDia,
    expediente
  }));
});

// Painel Eletrônico
router.get(['/painel', '/painel/', '/painel-principal/:id'], (req, res) => {
  const id = parseInt(req.params.id || store.sessoes[0].id, 10);
  const sessao = store.sessoes.find(s => s.id === id) || store.sessoes[0];
  res.render('painel', baseLocals(req, {
    title: `Painel Plenário — ${sessao.__str__}`,
    sessao,
    parlamentares: store.parlamentares.filter(p => sessao.presentes_ids.includes(p.id))
  }));
});

// Protocolo e Documentos Administrativos
router.get(['/protocoloadm', '/protocoloadm/', '/docadm/pesq-doc-adm'], (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  const protocolos = store.protocolos.filter(p =>
    !q || p.assunto.toLowerCase().includes(q) || p.interessado.toLowerCase().includes(q) || String(p.numero).includes(q)
  );
  const documentos = store.documentosAdministrativos.filter(d =>
    !q || d.assunto.toLowerCase().includes(q) || d.interessado.toLowerCase().includes(q) || String(d.numero).includes(q)
  );
  res.render('protocolo', baseLocals(req, {
    title: 'Protocolo e Documentos Administrativos — SAPL',
    protocolos,
    documentos,
    q: req.query.q || ''
  }));
});

router.post('/protocoloadm/create', (req, res) => {
  const ano = new Date().getFullYear();
  const novo = {
    id: store.getNextProtocoloId(),
    numero: 300 + store.protocolos.length + 1,
    ano,
    data: new Date().toISOString().slice(0, 10),
    hora: new Date().toTimeString().slice(0, 5),
    tipo_protocolo: req.body.tipo_protocolo || 'Administrativo',
    tipo_documento: req.body.tipo_documento || 'Ofício',
    assunto: String(req.body.assunto || '').trim() || 'Documento protocolado.',
    interessado: String(req.body.interessado || '').trim() || 'Cidadão / Externo',
    anulado: false
  };
  store.protocolos.unshift(novo);
  res.redirect('/protocoloadm/');
});

// Audiências Públicas
router.get(['/audiencia', '/audiencia/'], (req, res) => {
  const lista = store.audiencias.map(a => ({
    ...a,
    materia: a.materia_id ? store.materias.find(m => m.id === a.materia_id) : null
  }));
  res.render('audiencias', baseLocals(req, {
    title: 'Audiências Públicas — SAPL',
    audiencias: lista
  }));
});

// Relatórios
router.get(['/relatorios', '/relatorios/'], (req, res) => {
  const materiasPorTipo = store.tiposMateria.map(t => ({
    sigla: t.sigla,
    descricao: t.descricao,
    total: store.materias.filter(m => m.tipo_id === t.id).length
  })).filter(x => x.total > 0);

  const normasPorTipo = store.tiposNorma.map(t => ({
    sigla: t.sigla,
    descricao: t.descricao,
    total: store.normas.filter(n => n.tipo_id === t.id).length
  })).filter(x => x.total > 0);

  res.render('relatorios', baseLocals(req, {
    title: 'Relatórios Estatísticos — SAPL',
    materiasPorTipo,
    normasPorTipo,
    totais: {
      parlamentares: store.parlamentares.filter(p => p.ativo).length,
      comissoes: store.comissoes.filter(c => c.ativa).length,
      materias: store.materias.length,
      materiasEmTramitacao: store.materias.filter(m => m.em_tramitacao).length,
      normas: store.normas.length,
      sessoes: store.sessoes.length
    }
  }));
});

// Sistema / Casa Legislativa / Login
router.get(['/sistema', '/sistema/', '/sistema/casa-legislativa', '/sistema/casa-legislativa/'], (req, res) => {
  res.render('sistema', baseLocals(req, {
    title: 'Configurações do Sistema — SAPL',
    partidos: store.partidos,
    legislaturas: store.legislaturas,
    tiposMateria: store.tiposMateria,
    tiposNorma: store.tiposNorma
  }));
});

router.get(['/login', '/login/'], (req, res) => {
  res.render('login', baseLocals(req, {
    title: 'Entrar — SAPL',
    error: null,
    loggedInUser: null
  }));
});

router.post(['/login', '/login/'], (req, res) => {
  const username = (req.body.username || '').trim();
  if (!username) {
    return res.render('login', baseLocals(req, {
      title: 'Entrar — SAPL',
      error: 'Informe um nome de usuário.',
      loggedInUser: null
    }));
  }
  res.render('login', baseLocals(req, {
    title: 'Entrar — SAPL',
    error: null,
    loggedInUser: username
  }));
});

module.exports = router;
