/**
 * Teste rápido de verificação da harmonização humanizer + voice-specialist
 * Executar: node backend/test-naturalidade.js
 */

const humanizer = require('./agents/humanizer');
const { getVoiceSpecialist } = require('./agents/voice-specialist');

let passou = 0;
let falhou = 0;

function testar(nome, condicao, detalhe = '') {
  if (condicao) {
    passou++;
    console.log(`  ✅ ${nome}`);
  } else {
    falhou++;
    console.log(`  ❌ ${nome} ${detalhe}`);
  }
}

console.log('\n=== HUMANIZER ===\n');

// 1. Resposta curta ganha toque humano + pontuação
const curta = humanizer.humanizar('Sim', {});
testar('Resposta curta ganha toque humano', curta.length > 4, `(resultado: "${curta}")`);
testar('Resposta curta tem pontuação final', /[.!?]$/.test(curta), `(resultado: "${curta}")`);

// 2. Resposta longa NÃO ganha prefixo artificial
const longa = humanizer.humanizar('O Data Center Henri Dunat está localizado na Avenida Henri Dunat, número 5000, no bairro Chácara Santo Antônio, em São Paulo.', {});
testar('Resposta longa não ganha prefixo artificial', !longa.startsWith('Vamos') && !longa.startsWith('Essa é') && !longa.startsWith('Certo') && !longa.startsWith('Deixa'), `(resultado: "${longa.substring(0, 60)}...")`);
testar('Resposta longa capitaliza primeira letra', longa[0] === longa[0].toUpperCase());
testar('Resposta longa tem pontuação final', /[.!?]$/.test(longa.trim()));

// 3. Continuação de conversa não ganha expressão
const continuacao = humanizer.humanizar('ok', { isContinuacao: true });
testar('Continuação não recebe toque humano', continuacao.trim() === 'Ok.', `(resultado: "${continuacao}")`);

// 4. Capitalização é aplicada
const minuscula = humanizer.humanizar('temos 11 data centers no brasil');
testar('Primeira letra é capitalizada', minuscula.startsWith('Temos'), `(resultado: "${minuscula.substring(0, 30)}")`);

console.log('\n=== VOICE SPECIALIST ===\n');

// 5. Estilo técnico não duplica termos
const voice = getVoiceSpecialist();
voice.setVoz('tecnico');
const respostaTecnica = voice.aplicarVoz('O data center possui redundância em energia e monitoramento contínuo.');
testar('Técnico não duplica "redundância N+1 N+1"', !respostaTecnica.includes('redundância N+1 N+1'), `(resultado: "${respostaTecnica}")`);
testar('Técnico enriquece termos presentes', respostaTecnica.includes('redundância N+1'), `(resultado: "${respostaTecnica}")`);

// 6. Estilo executivo não troca "Data Centers" por jargão
voice.setVoz('executivo');
const respostaExecutiva = voice.aplicarVoz('Temos 11 Data Centers no Brasil.');
testar('Executivo preserva "Data Centers"', respostaExecutiva.includes('Data Centers'), `(resultado: "${respostaExecutiva}")`);
testar('Executivo ajusta "temos" para "oferecemos"', respostaExecutiva.includes('oferecemos'), `(resultado: "${respostaExecutiva}")`);

// 7. Detecção de voz
testar('Detecta voz técnica para SLA', voice.detectarVozIdeal('Qual o SLA do data center?') === 'tecnico');
testar('Detecta voz executiva para ROI', voice.detectarVozIdeal('Qual o ROI do investimento?') === 'executivo');
testar('Detecta voz amigável para "o que é"', voice.detectarVozIdeal('O que é colocation?') === 'amigavel');
testar('Default é profissional', voice.detectarVozIdeal('Qual o telefone do data center?') === 'profissional');

// 8. Fluxo integrado: humanizar + voice (ordem real no router)
voice.setVoz(voice.detectarVozIdeal('Qual o endereço do data center Henri Dunat?'));
const fluxoIntegrado = voice.aplicarVoz(humanizer.humanizar('O Data Center Henri Dunat fica na Avenida Henri Dunat, 5000, São Paulo.', {}));
testar('Fluxo integrado preserva conteúdo', fluxoIntegrado.includes('Avenida Henri Dunat'), `(resultado: "${fluxoIntegrado.substring(0, 60)}...")`);
testar('Fluxo integrado sem prefixos robóticos', !fluxoIntegrado.startsWith('Olha,') && !fluxoIntegrado.startsWith('Na minha experiência'), `(resultado: "${fluxoIntegrado.substring(0, 60)}...")`);

console.log(`\n========================`);
console.log(`  RESULTADO: ${passou} passaram, ${falhou} falharam`);
console.log(`========================\n`);

process.exit(falhou > 0 ? 1 : 0);