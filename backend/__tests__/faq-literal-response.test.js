const { selecionarRespostaFAQLiteral } = require('../llm-client');

describe('FAQ literal response handling', () => {
  it('returns the exact FAQ answer for a strong match without rewriting it', () => {
    const resposta = selecionarRespostaFAQLiteral('como dar acesso a novas pessoas no portal', [
      {
        pergunta: 'Como dar acesso a novas pessoas no portal?',
        resposta: 'Acesso deve ser concedido pelo administrador do portal, com perfil e permissão específicos.',
        score: 0.91
      }
    ]);

    expect(resposta).toBe('Acesso deve ser concedido pelo administrador do portal, com perfil e permissão específicos.');
  });

  it('returns null when the FAQ match is too weak to be used literally', () => {
    const resposta = selecionarRespostaFAQLiteral('me diga algo sobre data center', [
      {
        pergunta: 'Qual é a importância da segregação de acesso no Data Center?',
        resposta: 'A segregação de acesso reduz riscos de exposição indevida.',
        score: 0.24
      }
    ]);

    expect(resposta).toBeNull();
  });
});
