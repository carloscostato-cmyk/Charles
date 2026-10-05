const path = require('path');
const { getRouterAgent, INTENT_CATEGORIES } = require('../agents/router-agent');
const { getDataCenterLoader } = require('../rag/datacenter-loader');
const { getSpecialistLocator } = require('../agents/specialist-locator');

describe('Data Center location routing', () => {
  beforeAll(() => {
    const loader = getDataCenterLoader();
    const excelPath = path.join(__dirname, '..', '..', 'sites_data_center.xlsx');
    loader.loadFromExcel(excelPath);
  });

  it('routes address queries to the locator specialist', () => {
    const router = getRouterAgent();
    const intent = router.classifyIntent('Endereços do data center de São Paulo');

    expect(intent.category).toBe(INTENT_CATEGORIES.DATACENTER_LOCATION);
  });

  it('returns location details for plural address queries', () => {
    const specialist = getSpecialistLocator();
    const response = specialist.responder('Endereços do data center de São Paulo');

    expect(response).toContain('HENRI DUNAT - SP');
    expect(response).toContain('SÃO PAULO');
  });

  it('narrows the response to the requested city instead of returning unrelated data centers', () => {
    const specialist = getSpecialistLocator();
    const response = specialist.responder('Me passa o endereço do data center de São Paulo?');

    expect(response).toContain('HENRI DUNAT - SP');
    expect(response).toContain('DC LAPA - SP');
    expect(response).toContain('DC INGLESES - SP');
    expect(response).not.toContain('ESPÍRITO SANTO');
    expect(response).not.toContain('RIO DE JANEIRO');
    expect(response).not.toMatch(/Encontrei 7 resultado/);
  });
});

describe('isLocationQuery - guarda contra sequestro de perguntas técnicas', () => {
  let specialist;
  beforeAll(() => {
    const loader = getDataCenterLoader();
    loader.loadFromExcel(path.join(__dirname, '..', '..', 'sites_data_center.xlsx'));
    specialist = getSpecialistLocator();
  });

  it('NÃO trata pergunta de senha como localização', () => {
    expect(specialist.isLocationQuery('Qual é a senha do servidor de produção?')).toBe(false);
  });

  it('NÃO trata pergunta de configuração como localização, mesmo citando cidade', () => {
    expect(
      specialist.isLocationQuery(
        'Como faço para configurar um balanceador F5 Big-IP no datacenter de Manaus?'
      )
    ).toBe(false);
  });

  it('UF só como palavra isolada ("produção" não casa "pr")', () => {
    expect(specialist.isLocationQuery('Qual o horário do ambiente de produção?')).toBe(false);
    expect(specialist.isLocationQuery('Preciso de ajuda com o log de produção')).toBe(false);
  });

  it('ainda detecta perguntas legítimas de endereço/localização', () => {
    expect(specialist.isLocationQuery('Endereços do data center de São Paulo')).toBe(true);
    expect(specialist.isLocationQuery('Me passa o endereço do data center de São Paulo?')).toBe(true);
    expect(specialist.isLocationQuery('Onde fica o data center de Brasília?')).toBe(true);
    expect(specialist.isLocationQuery('Qual o data center mais próximo de SP?')).toBe(true);
    expect(specialist.isLocationQuery('Telefone do data center de Manaus')).toBe(true);
    expect(specialist.isLocationQuery('Data center em Recife')).toBe(true);
  });
});
