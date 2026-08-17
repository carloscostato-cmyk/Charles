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
