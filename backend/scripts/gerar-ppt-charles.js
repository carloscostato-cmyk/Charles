const PptxGenJS = require('pptxgenjs');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'apresentacao-charles');
const IMG_CHARLES = path.join(OUT_DIR, 'assets', 'charles.jpg');

const RED = 'E4002B';
const RED2 = 'FF2D55';
const INK = '0A0E17';
const TXT = 'F4F6FB';
const TXT2 = 'A8B3C7';
const TXT3 = '6B7688';
const OK = '10B981';
const WARN = 'F59E0B';
const BLUE = '3B82F6';

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'W169', width: 13.333, height: 7.5 });
pptx.layout = 'W169';
pptx.author = 'Departamento de Data Center - Claro Empresas';
pptx.company = 'Claro Empresas';
pptx.title = 'Charles - Assistente de IA do Data Center';

const temFoto = fs.existsSync(IMG_CHARLES);

function baseSlide(titulo, subtitulo) {
  const s = pptx.addSlide();
  s.background = { color: INK };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.09, fill: { color: RED } });
  s.addShape(pptx.ShapeType.ellipse, { x: -1.6, y: -1.9, w: 5.2, h: 5.2, fill: { color: RED, transparency: 88 } });
  s.addShape(pptx.ShapeType.ellipse, { x: 10.6, y: 4.6, w: 4.4, h: 4.4, fill: { color: BLUE, transparency: 90 } });
  if (titulo) s.addText(titulo, { x: 0.8, y: 0.62, w: 11.8, h: 0.62, fontSize: 32, bold: true, color: TXT, fontFace: 'Segoe UI' });
  if (subtitulo) s.addText(subtitulo, { x: 0.8, y: 1.26, w: 11.8, h: 0.42, fontSize: 14, color: TXT2, fontFace: 'Segoe UI' });
  return s;
}

function card(s, x, y, w, h, opts) {
  opts = opts || {};
  s.addShape(pptx.ShapeType.roundRect, {
    x: x, y: y, w: w, h: h, rectRadius: 0.06,
    fill: { color: opts.fill || '161D2E' },
    line: { color: opts.line || '263047', width: 1 }
  });
}

function metrica(s, x, y, w, valor, rotulo, cor) {
  card(s, x, y, w, 1.62);
  s.addText(valor, { x: x, y: y + 0.16, w: w, h: 0.72, fontSize: 34, bold: true, color: cor || RED2, align: 'center', fontFace: 'Segoe UI' });
  s.addText(rotulo, { x: x, y: y + 0.92, w: w, h: 0.34, fontSize: 11, bold: true, color: TXT3, align: 'center', fontFace: 'Segoe UI' });
}

function badge(s, x, y, w, texto, cor) {
  s.addShape(pptx.ShapeType.roundRect, {
    x: x, y: y, w: w, h: 0.34, rectRadius: 0.08,
    fill: { color: cor, transparency: 84 },
    line: { color: cor, width: 1 }
  });
  s.addText(texto, { x: x, y: y, w: w, h: 0.34, fontSize: 10, bold: true, color: cor, align: 'center', valign: 'middle', fontFace: 'Segoe UI' });
}

function rodape(s, n) {
  s.addText('Charles - Assistente de IA do Data Center - Claro Empresas', { x: 0.8, y: 7.02, w: 8, h: 0.3, fontSize: 9, color: TXT3, fontFace: 'Segoe UI' });
  s.addText(String(n), { x: 12.2, y: 7.02, w: 0.6, h: 0.3, fontSize: 10, bold: true, color: TXT3, align: 'right', fontFace: 'Segoe UI' });
}
// ==== SLIDE 1 - CAPA ====
{
  const s = pptx.addSlide();
  s.background = { color: INK };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.11, fill: { color: RED } });
  s.addShape(pptx.ShapeType.ellipse, { x: -2.2, y: -2.6, w: 7, h: 7, fill: { color: RED, transparency: 86 } });
  s.addShape(pptx.ShapeType.ellipse, { x: 9.8, y: 3.6, w: 6, h: 6, fill: { color: BLUE, transparency: 90 } });
  if (temFoto) s.addImage({ path: IMG_CHARLES, x: 5.17, y: 0.55, w: 3, h: 3 });
  s.addText('CLARO EMPRESAS - DEPARTAMENTO DE DATA CENTER', { x: 0, y: 3.72, w: 13.333, h: 0.34, fontSize: 11, bold: true, color: RED2, charSpacing: 2.6, align: 'center', fontFace: 'Segoe UI' });
  s.addText([{ text: 'Conheca o ', options: { color: TXT } }, { text: 'Charles', options: { color: RED2 } }], { x: 0, y: 4.06, w: 13.333, h: 0.92, fontSize: 48, bold: true, align: 'center', fontFace: 'Segoe UI' });
  s.addText('Nao e um chatbot generico. E um especialista em Data Center e Operacoes NOC\nque conhece a sua infraestrutura, cita a fonte de cada resposta e nunca inventa.', { x: 1.6, y: 5.02, w: 10.13, h: 0.72, fontSize: 14, color: 'D7DFEC', align: 'center', fontFace: 'Segoe UI' });
  badge(s, 2.32, 6.05, 2.0, '0% de alucinacao', OK);
  badge(s, 4.52, 6.05, 2.0, '100% com citacao', BLUE);
  badge(s, 6.72, 6.05, 1.7, 'ISO/IEC 42001', RED);
  badge(s, 8.62, 6.05, 2.4, '159 itens de FAQ', OK);
}

// ==== SLIDE 2 - O PROBLEMA ====
{
  const s = baseSlide('Um chatbot generico nao sabe o que e um Data Center', 'O risco nao e ele errar - e errar parecendo estar certo.');
  s.addText('Coloque qualquer assistente de IA para responder uma pergunta operacional. Ele pode responder - mas sem garantir que esteja certo.', { x: 0.8, y: 1.82, w: 11.8, h: 0.42, fontSize: 13, color: TXT2, fontFace: 'Segoe UI' });
  const problemas = [
    ['Sem a sua base', 'Nao conhece seus procedimentos, seus runbooks, o historico da sua unidade nem a particularidade do seu ambiente.'],
    ['Sem citar a fonte', 'Responde com a mesma seguranca um fato confirmado e uma suposicao. Nao da para auditar o que ele disse.'],
    ['Inventa com confianca', 'Quando nao sabe, preenche a lacuna - com a mesma fluency de quando esta certo. Esse e o risco real.']
  ];
  problemas.forEach(function (pr, i) {
    const x = 0.8 + i * 4.03;
    card(s, x, 2.44, 3.75, 2.24);
    s.addShape(pptx.ShapeType.ellipse, { x: x + 0.28, y: 2.72, w: 0.22, h: 0.22, fill: { color: RED } });
    s.addText(pr[0], { x: x + 0.62, y: 2.66, w: 2.9, h: 0.34, fontSize: 14, bold: true, color: TXT, fontFace: 'Segoe UI' });
    s.addText(pr[1], { x: x + 0.28, y: 3.12, w: 3.2, h: 1.34, fontSize: 11, color: TXT2, fontFace: 'Segoe UI' });
  });
  card(s, 0.8, 5.02, 11.75, 1.34, { fill: '1C1119', line: RED });
  s.addText([{ text: 'Durante um incidente nao ha tempo de conferir. ', options: { color: TXT2 } }, { text: 'Um assistente errado e confiante custa mais do que um que admite nao saber.', options: { color: TXT, bold: true } }], { x: 1.15, y: 5.42, w: 11.05, h: 0.6, fontSize: 14, fontFace: 'Segoe UI' });
  rodape(s, 2);
}

// ==== SLIDE 3 - QUEM E CHARLES ====
{
  const s = baseSlide('Um assistente que conhece o seu ambiente', null);
  if (temFoto) {
    s.addShape(pptx.ShapeType.ellipse, { x: 1.22, y: 1.62, w: 3.5, h: 3.5, fill: { color: RED, transparency: 84 } });
    s.addImage({ path: IMG_CHARLES, x: 1.62, y: 2.02, w: 2.7, h: 2.7 });
  }
  s.addText('O que o Charles e', { x: 5.4, y: 1.82, w: 7.1, h: 0.34, fontSize: 16, bold: true, color: OK, fontFace: 'Segoe UI' });
  s.addText('Um especialista de Data Center e Operacoes NOC que trabalha com a documentacao real - e cita a fonte de tudo que responde.', { x: 5.4, y: 2.22, w: 7.1, h: 0.9, fontSize: 12.5, color: TXT2, fontFace: 'Segoe UI' });
  s.addText('O que ele nao e', { x: 5.4, y: 3.06, w: 7.1, h: 0.34, fontSize: 16, bold: true, color: RED, fontFace: 'Segoe UI' });
  s.addText('Nao e um modelo geral treinado na internet. Nao "sabe de tudo" - e e por isso que ele nao erra sobre o que nao tem.', { x: 5.4, y: 3.46, w: 7.1, h: 0.9, fontSize: 12.5, color: TXT2, fontFace: 'Segoe UI' });
  metrica(s, 5.4, 4.44, 2.2, '159', 'ITENS DE FAQ', RED2);
  metrica(s, 7.78, 4.44, 2.2, '11', 'DATA CENTERS', RED2);
  metrica(s, 10.16, 4.44, 2.2, '0%', 'ALUCINACAO', OK);
  rodape(s, 3);
}
// ==== SLIDE 4 - NUMEROS ====
{
  const s = baseSlide('Numeros que nao sao opiniao', 'Medidos automaticamente pelo agente de qualidade - 26 ciclos em 8 dias.');
  metrica(s, 0.8, 1.96, 2.86, '0%', 'ALUCINACAO - meta 5%', OK);
  metrica(s, 3.79, 1.96, 2.86, '100%', 'TAXA DE CITACAO', OK);
  metrica(s, 6.78, 1.96, 2.86, '100%', 'PRECISAO DO RETRIEVAL', RED2);
  metrica(s, 9.77, 1.96, 2.78, '100%', 'CONVERSA HUMANA', OK);
  metrica(s, 0.8, 3.82, 2.86, '159', 'ITENS DE FAQ', RED2);
  metrica(s, 3.79, 3.82, 2.86, '11', 'DATA CENTERS', RED2);
  metrica(s, 6.78, 3.82, 2.86, '211', 'INTERACOES AUDITADAS', RED2);
  metrica(s, 9.77, 3.82, 2.78, '302', 'TESTES AUTOMATIZADOS', RED2);
  card(s, 0.8, 5.72, 11.75, 0.92, { fill: '101B18', line: OK });
  s.addText('Todos esses numeros saem do sistema - nao de estimativa. O mesmo agente que mede e o que detecta regressoes antes de elas chegarem a voce.', { x: 1.15, y: 6.02, w: 11.05, h: 0.4, fontSize: 12, color: 'D7DFEC', fontFace: 'Segoe UI' });
  rodape(s, 4);
}

// ==== SLIDE 5 - EVOLUCAO ====
{
  const s = baseSlide('De 50% para 0% de alucinacao', 'Nao foi sorte. Foi medicao, correcao e nova medicao.');
  const pontos = [['Inicio', 50], ['Ciclo 2', 8], ['Ciclo 3', 0], ['Ciclo 4', 0], ['Ciclo 5', 0], ['Hoje', 0]];
  const gx = 1.5, gy = 2.2, gw = 10.4, gh = 2.5, maxV = 50;
  card(s, 0.8, 1.86, 11.75, 3.28);
  s.addShape(pptx.ShapeType.line, { x: gx, y: gy + gh - (5 / maxV) * gh, w: gw, h: 0, line: { color: WARN, width: 1, dashType: 'dash' } });
  s.addText('meta 5%', { x: gx + gw - 1.1, y: gy + gh - (5 / maxV) * gh - 0.26, w: 1.1, h: 0.22, fontSize: 9, color: WARN, align: 'right', fontFace: 'Segoe UI' });
  s.addShape(pptx.ShapeType.line, { x: gx, y: gy + gh, w: gw, h: 0, line: { color: '263047', width: 1 } });
  pontos.forEach(function (pt, i) {
    const px = gx + (i / (pontos.length - 1)) * gw;
    const py = gy + gh - (pt[1] / maxV) * gh;
    const cor = pt[1] === 0 ? OK : RED2;
    if (i < pontos.length - 1) {
      const proxX = gx + ((i + 1) / (pontos.length - 1)) * gw;
      const proxY = gy + gh - (pontos[i + 1][1] / maxV) * gh;
      s.addShape(pptx.ShapeType.line, { x: Math.min(px, proxX), y: Math.min(py, proxY), w: Math.abs(proxX - px), h: Math.abs(proxY - py), line: { color: RED2, width: 2.5 } });
    }
    s.addShape(pptx.ShapeType.ellipse, { x: px - 0.09, y: py - 0.09, w: 0.18, h: 0.18, fill: { color: cor }, line: { color: INK, width: 1.5 } });
    s.addText(pt[0], { x: px - 0.55, y: gy + gh + 0.1, w: 1.1, h: 0.24, fontSize: 9, color: TXT3, align: 'center', fontFace: 'Segoe UI' });
    if (i === 0 || pt[1] === 0) {
      s.addText(pt[1] + '%', { x: px - 0.5, y: py - 0.42, w: 1.0, h: 0.26, fontSize: 12, bold: true, color: cor, align: 'center', fontFace: 'Segoe UI' });
    }
  });
  const etapas = [
    ['Detectado', 'O agente de qualidade mediu 50% e sinalizou como risco critico.'],
    ['Corrigido', 'Prompt mestre desbloqueado - a personalidade nunca era enviada ao modelo.'],
    ['Comprovado', 'Tres medicoes seguidas em 0%. O resultado se mantem, nao foi acaso.']
  ];
  etapas.forEach(function (et, i) {
    const x = 0.8 + i * 4.03;
    card(s, x, 5.36, 3.75, 1.34);
    s.addText(et[0], { x: x + 0.26, y: 5.56, w: 3.2, h: 0.3, fontSize: 13, bold: true, color: RED2, fontFace: 'Segoe UI' });
    s.addText(et[1], { x: x + 0.26, y: 5.92, w: 3.24, h: 0.66, fontSize: 10.5, color: TXT2, fontFace: 'Segoe UI' });
  });
  rodape(s, 5);
}
// ==== SLIDE 6 - COMPARATIVO ====
{
  const s = baseSlide('Nao e ser "melhor que o ChatGPT"', 'E ser o certo para o seu contexto. Comparativo honesto:');
  const linhas = [
    ['Criterio', 'Generalista', 'Busca corporativa', 'Charles'],
    ['Conhece a base interna', 'Nao', 'Parcial', 'Sim - 159 itens'],
    ['Cita a fonte da resposta', 'Nao', 'Nao', 'Sempre'],
    ['Auditoria de conformidade', 'Nao', 'Nao', 'ISO 42001'],
    ['Dados dos Data Centers', 'Generico', 'Publicos', 'Internos'],
    ['Diz quando nao sabe', 'As vezes', 'Raramente', 'Sempre'],
    ['Rastro de evidencias', 'Nao', 'Nao', '100% auditavel'],
    ['Custo por conversa', '$$$', '$$', 'Gratuito'],
    ['Conhecimento geral', 'Excelente', 'Bom', 'Restrito ao DC']
  ];
  const y0 = 1.96, lh = 0.46, x0 = 0.8;
  const colW = [3.5, 2.55, 2.85, 2.85];
  function offset(i) { return x0 + colW.slice(0, i).reduce(function (a, b) { return a + b; }, 0); }
  colW.forEach(function (w, i) {
    s.addShape(pptx.ShapeType.rect, { x: offset(i), y: y0, w: w, h: 0.44, fill: { color: i === 3 ? '2A0E14' : '161D2E' }, line: { color: i === 3 ? RED : '263047', width: 1 } });
  });
  linhas[0].forEach(function (t, i) {
    s.addText(t, { x: offset(i) + 0.14, y: y0 + 0.06, w: colW[i] - 0.28, h: 0.32, fontSize: 10.5, bold: true, color: i === 3 ? RED2 : TXT3, fontFace: 'Segoe UI' });
  });
  const vermelho = ['Nao', 'Raramente', 'Generico', 'Restrito ao DC'];
  const amarelinho = ['Parcial', 'Bom', 'As vezes', '$$$', '$$'];
  linhas.slice(1).forEach(function (linha, r) {
    const y = y0 + 0.44 + r * lh;
    linha.forEach(function (t, i) {
      if (i > 0) {
        s.addShape(pptx.ShapeType.rect, { x: offset(i), y: y, w: colW[i], h: lh, fill: { color: i === 3 ? '150A0E' : (r % 2 ? '111827' : '0E1522') }, line: { color: '1F2839', width: 0.75 } });
      }
      var cor = TXT;
      if (i === 0) cor = TXT;
      else if (i === 3) cor = OK;
      else if (vermelho.indexOf(t) >= 0) cor = 'F87171';
      else if (amarelinho.indexOf(t) >= 0) cor = 'FBBF24';
      else cor = TXT2;
      s.addText(t, { x: offset(i) + 0.14, y: y + 0.09, w: colW[i] - 0.28, h: lh - 0.16, fontSize: 10.5, bold: i === 3 || i === 0, color: cor, fontFace: 'Segoe UI' });
    });
  });
  card(s, 0.8, 5.72, 11.75, 0.92, { fill: '101B18', line: OK });
  s.addText('A escolha nao e Charles ou o ChatGPT - sao camadas diferentes: o generalista para conhecimento amplo, o Charles para o que precisa de fonte e nao pode errar.', { x: 1.15, y: 6.02, w: 11.05, h: 0.4, fontSize: 12, color: 'D7DFEC', fontFace: 'Segoe UI' });
  rodape(s, 6);
}

// ==== SLIDE 7 - ARQUITETURA ====
{
  const s = baseSlide('Cinco especialistas que nunca inventam endereco', 'Quando a resposta vem de dado estruturado, ela vem da planilha - nao de adivinhacao.');
  const esp = [
    ['Localizacao', 'Endereco, CEP, bairro e cidade das 11 unidades.'],
    ['Contato', 'Telefone e ramal de cada Data Center.'],
    ['Diretorio', 'Lista completa e atualizada das unidades.'],
    ['Regiao', 'Cobertura por regiao e estado.'],
    ['Disponibilidade', 'Encaminha para a fonte oficial - nunca inventa status.'],
    ['Rastreabilidade', '58% das conversas vieram de dado estruturado, onde alucinacao e impossivel.']
  ];
  esp.forEach(function (e, i) {
    const x = 0.8 + (i % 3) * 4.03;
    const y = 1.94 + Math.floor(i / 3) * 1.86;
    var dest = i === 5;
    card(s, x, y, 3.75, 1.62, dest ? { fill: '0F1A17', line: OK } : {});
    s.addText(e[0], { x: x + 0.26, y: y + 0.22, w: 3.24, h: 0.32, fontSize: 14, bold: true, color: dest ? OK : TXT, fontFace: 'Segoe UI' });
    s.addText(e[1], { x: x + 0.26, y: y + 0.62, w: 3.24, h: 0.86, fontSize: 11, color: TXT2, fontFace: 'Segoe UI' });
  });
  var bx = 0.8;
  ['RAG semantico', '4 ferramentas', 'Memoria de sessao', 'Qualidade automatica'].forEach(function (t) {
    badge(s, bx, 5.78, 2.55, t, BLUE);
    bx += 2.83;
  });
  rodape(s, 7);
}
// ==== SLIDE 8 - CONVERSA HUMANA ====
{
  const s = baseSlide('Especialista e pessoa', 'Um assistente que responde tudo com relatorio tecnico cansa.');
  card(s, 0.8, 1.94, 5.75, 3.34, { fill: '101B18', line: OK });
  badge(s, 1.1, 2.18, 1.5, 'CONVERSA', OK);
  s.addText('O que ele faz', { x: 1.1, y: 2.66, w: 5.15, h: 0.34, fontSize: 16, bold: true, color: TXT, fontFace: 'Segoe UI' });
  s.addText([
    { text: 'Reconhece o horario e cumprimenta corretamente.', options: { bullet: { code: '2022' }, breakLine: true } },
    { text: 'Sobre clima, diz com honestidade o que nao sabe - em vez de inventar.', options: { bullet: { code: '2022' }, breakLine: true } },
    { text: 'Para a execucao quando voce interrompe.', options: { bullet: { code: '2022' }, breakLine: true } },
    { text: 'Redireciona assunto fora de escopo sem ser grosseiro.', options: { bullet: { code: '2022' } } }
  ], { x: 1.1, y: 3.06, w: 5.15, h: 2.1, fontSize: 11.5, color: TXT2, fontFace: 'Segoe UI' });
  card(s, 6.83, 1.94, 5.72, 3.34, { fill: '1C1119', line: RED });
  badge(s, 7.13, 2.18, 2.0, 'TRABALHO TECNICO', RED);
  s.addText('O que ele nao faz', { x: 7.13, y: 2.66, w: 5.12, h: 0.34, fontSize: 16, bold: true, color: TXT, fontFace: 'Segoe UI' });
  s.addText([
    { text: 'Nao inventa previsao do tempo.', options: { bullet: { code: '2022' }, breakLine: true } },
    { text: 'Nao afirma que um DC esta operacional sem consultar a fonte.', options: { bullet: { code: '2022' }, breakLine: true } },
    { text: 'Nao usa formato de relatorio em conversa fiada.', options: { bullet: { code: '2022' }, breakLine: true } },
    { text: 'Nao substitui o judgement do Analista.', options: { bullet: { code: '2022' } } }
  ], { x: 7.13, y: 3.06, w: 5.12, h: 2.1, fontSize: 11.5, color: TXT2, fontFace: 'Segoe UI' });
  card(s, 0.8, 5.56, 11.75, 1.06, { fill: '1A0F14', line: RED });
  s.addText('Calor humano + rigor tecnico. Essa combinacao nao e oferecida por ferramenta generica - e o que sustenta uma decisao operacional.', { x: 1.15, y: 5.92, w: 11.05, h: 0.42, fontSize: 13, bold: true, color: TXT, fontFace: 'Segoe UI' });
  rodape(s, 8);
}

// ==== SLIDE 9 - GOVERNANCA ====
{
  const s = baseSlide('Conformidade ISO/IEC 42001:2023', 'O unico ativo com nota alta e o proprio Charles. Isto e o que sustenta.');
  metrica(s, 0.8, 1.9, 2.86, '17', 'DOCUMENTOS DE GOVERNANCA', RED2);
  metrica(s, 3.79, 1.9, 2.86, '33', 'TESTES DE CONFORMIDADE', OK);
  metrica(s, 6.78, 1.9, 2.86, '100%', 'RESPOSTAS COM FONTE', OK);
  metrica(s, 9.77, 1.9, 2.78, '302', 'TESTES NO TOTAL', RED2);
  const controles = [
    ['Protecao de dados (LGPD)', 'CPF, CNPJ, cartao, e-mail e telefone mascarados na entrada. Acesso por papeis via Entra ID.'],
    ['Rastreabilidade', 'Cada interacao registra fonte, agente usado e nota de qualidade - permitindo auditoria.'],
    ['Protecao contra prompt injection', 'Deteccao ativa de tentativas de extrair o prompt ou burlar regras.'],
    ['Limites explicitos', 'Documento que declara o que o Charles faz e nao faz, revisado pela gestao.']
  ];
  controles.forEach(function (c, i) {
    const x = 0.8 + (i % 2) * 6.03;
    const y = 3.86 + Math.floor(i / 2) * 1.42;
    card(s, x, y, 5.72, 1.24);
    s.addText(c[0], { x: x + 0.26, y: y + 0.2, w: 5.2, h: 0.3, fontSize: 13, bold: true, color: TXT, fontFace: 'Segoe UI' });
    s.addText(c[1], { x: x + 0.26, y: y + 0.56, w: 5.2, h: 0.6, fontSize: 10.5, color: TXT2, fontFace: 'Segoe UI' });
  });
  rodape(s, 9);
}
// ==== SLIDE 10 - O GAP (CTA) ====
{
  const s = baseSlide('O unico item que segura a nota do Charles e a FAQ', 'A maquina esta pronta. O conteudo e o que falta - e so voces tem.');
  card(s, 0.8, 1.94, 5.75, 2.5, { fill: '101B18', line: OK });
  badge(s, 1.1, 2.18, 1.3, 'PRONTO', OK);
  s.addText([{ text: '100%', options: { fontSize: 40, bold: true, color: OK } }, { text: '   alucinacao - citacao - retrieval', options: { fontSize: 12, color: TXT3 } }], { x: 1.1, y: 2.66, w: 5.15, h: 0.72, fontFace: 'Segoe UI' });
  s.addText('A maquina esta pronta. Medindo e corrigindo sozinha, 26 vezes.', { x: 1.1, y: 3.5, w: 5.15, h: 0.72, fontSize: 11.5, color: TXT2, fontFace: 'Segoe UI' });
  card(s, 6.83, 1.94, 5.72, 2.5, { fill: '1C1608', line: WARN });
  badge(s, 7.13, 2.18, 2.1, 'DEPENDE DE VOCES', WARN);
  s.addText([{ text: '14%', options: { fontSize: 40, bold: true, color: WARN } }, { text: '   cobertura das duvidas', options: { fontSize: 12, color: TXT3 } }], { x: 7.13, y: 2.66, w: 5.12, h: 0.72, fontFace: 'Segoe UI' });
  s.addText('86% das perguntas que chegam ele ainda nao sabe responder. Nao e limitacao da ferramenta - e conteudo que falta na base.', { x: 7.13, y: 3.5, w: 5.12, h: 0.72, fontSize: 11.5, color: TXT2, fontFace: 'Segoe UI' });
  card(s, 0.8, 4.7, 11.75, 1.94, { fill: '161D2E' });
  s.addText('Como cada area ajuda', { x: 1.1, y: 4.94, w: 11.15, h: 0.32, fontSize: 15, bold: true, color: RED2, fontFace: 'Segoe UI' });
  const passos = [
    ['1. Responde as duvidas', 'Cada pergunta que ele nao sabe gera um relatorio de lacuna. A resposta vira item de FAQ.'],
    ['2. Revisa o que ele responde', 'Se a resposta esta errada ou desatualizada, o item e corrigido e ele aprende com o dono.'],
    ['3. Assina como owner', 'Cada procedimento validado por quem e responsavel tecnico ganha peso e confianca.']
  ];
  passos.forEach(function (p, i) {
    const x = 1.1 + i * 3.78;
    s.addText(p[0], { x: x, y: 5.38, w: 3.5, h: 0.3, fontSize: 12, bold: true, color: TXT, fontFace: 'Segoe UI' });
    s.addText(p[1], { x: x, y: 5.72, w: 3.5, h: 0.78, fontSize: 10.5, color: TXT2, fontFace: 'Segoe UI' });
  });
  rodape(s, 10);
}

// ==== SLIDE 11 - ENCERRAMENTO ====
{
  const s = pptx.addSlide();
  s.background = { color: INK };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.11, fill: { color: RED } });
  s.addShape(pptx.ShapeType.ellipse, { x: -2.6, y: 2.2, w: 7.4, h: 7.4, fill: { color: RED, transparency: 88 } });
  s.addShape(pptx.ShapeType.ellipse, { x: 9.6, y: -2.8, w: 6.6, h: 6.6, fill: { color: OK, transparency: 93 } });
  if (temFoto) {
    s.addShape(pptx.ShapeType.ellipse, { x: 5.47, y: 0.62, w: 2.4, h: 2.4, fill: { color: RED, transparency: 85 } });
    s.addImage({ path: IMG_CHARLES, x: 5.87, y: 1.02, w: 1.6, h: 1.6 });
  }
  s.addText([{ text: 'O Charles so e tao bom quanto o', options: { color: TXT, breakLine: true } }, { text: 'conhecimento que voces alimentam', options: { color: RED2 } }], { x: 1, y: 2.72, w: 11.333, h: 1.24, fontSize: 32, bold: true, align: 'center', fontFace: 'Segoe UI' });
  s.addText('A ferramenta esta pronta, auditada e medindo o proprio desempenho.\nFalta o conteudo de voces - que so voces tem.', { x: 1.8, y: 4.12, w: 9.73, h: 0.72, fontSize: 14, color: 'D7DFEC', align: 'center', fontFace: 'Segoe UI' });
  badge(s, 3.62, 5.1, 2.0, '0% alucinacao', OK);
  badge(s, 5.82, 5.1, 2.0, '100% rastreavel', BLUE);
  badge(s, 8.02, 5.1, 1.7, 'ISO 42001', RED);
  s.addText('Charles - Especialista em Data Center e Operacoes NOC', { x: 0, y: 6.16, w: 13.333, h: 0.3, fontSize: 12, bold: true, color: TXT3, align: 'center', fontFace: 'Segoe UI' });
  s.addText('Claro Empresas - Departamento de Data Center', { x: 0, y: 6.46, w: 13.333, h: 0.28, fontSize: 10, color: TXT3, align: 'center', fontFace: 'Segoe UI' });
}

// ==== GRAVAR ====
const destino = path.join(OUT_DIR, 'Charles-Apresentacao.pptx');
pptx.writeFile({ fileName: destino }).then(function () {
  console.log('[PPT] Arquivo: ' + destino);
  console.log('[PPT] Tamanho: ' + (fs.statSync(destino).size / 1024).toFixed(1) + ' KB');
  console.log('[PPT] Slides: 11');
  console.log('[PPT] Foto do Charles: ' + (temFoto ? 'INCLUIDA' : 'NAO ENCONTRADA'));
}).catch(function (err) {
  console.error('[PPT] Erro ao gerar: ' + err.message);
  process.exit(1);
});