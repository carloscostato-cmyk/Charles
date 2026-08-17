const { lerFAQ } = require('./faq-reader');

console.log('\n=== VERIFICANDO FAQ ===\n');

const faq = lerFAQ();
console.log(`Total de perguntas: ${faq.length}\n`);

console.log('Primeiros 5 itens:\n');
faq.slice(0, 5).forEach((item, i) => {
  console.log(`${i+1}. PERGUNTA: ${item.pergunta.substring(0, 60)}...`);
  console.log(`   RESPOSTA: ${item.resposta.substring(0, 60)}...\n`);
});

console.log('\n=== FIM DEBUG ===\n');
