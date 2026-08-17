// ==========================================
// SCRIPT DE ATENDIMENTO NATURAL - ELITE MODE
// Cenário: Suporte técnico - Problema de acesso
// ==========================================

const scriptAtendimento = {
  abertura: {
    texto: `Olá! [pausa curta]
Bom dia, tudo bem? [pausa curta]
Aqui é do suporte técnico da Claro. [pausa média]
Verifico que você entrou em contato sobre uma dificuldade de acesso ao sistema, é isso mesmo?`,
    tom: "acolhedor e calmo",
    velocidade: "normal"
  },

  reconhecimento: {
    texto: `Entendi. [pausa curta]
Pode deixar comigo. [pausa curta]
Vou resolver isso agora.`,
    tom: "seguro e confiante",
    velocidade: "normal"
  },

  investigacao: {
    texto: `Primeiro, preciso confirmar uma informação com você, tudo bem? [pausa média]

Quando você tenta acessar, o que aparece na tela exatamente? [pausa curta]

Ah, entendi... [pausa média]

E isso começou hoje, ou já faz algum tempo que está acontecendo? [pausa curta]

Perfeito. [pausa curta]
Isso me ajuda bastante.`,
    tom: "investigativo mas empático",
    velocidade: "devagar (assunto técnico)"
  },

  explicacao: {
    texto: `Vou explicar o que está acontecendo. [pausa média]

É provável que seja uma questão de atualização de permissões no servidor. [pausa curta]

Nada grave. [pausa curta]
Mas preciso que você faça um ajuste rápido para liberar o acesso.`,
    tom: "técnico mas tranquilizador",
    velocidade: "devagar"
  },

  resolucao: {
    texto: `Vamos lá. [pausa curta]

Primeiro: você vai clicar no ícone de configurações, no canto superior direito. [pausa média]

Depois: selecione "Conta e segurança". [pausa média]

Pronto? [pausa curta]

Ótimo. [pausa curta]
Agora, role a página até encontrar "Sessões ativas". [pausa média]

Certo? [pausa curta]

Perfeito! [pausa curta]
Clique em "Encerrar todas as sessões". [pausa média]

Depois, faça login novamente com seu usuário e senha.`,
    tom: "objetivo e claro",
    velocidade: "normal com pausas entre etapas"
  },

  confirmacao: {
    texto: `Conseguiu acessar agora? [pausa média]

Excelente! [tom animado, pausa curta]

Fico feliz que tenha funcionado.`,
    tom: "animado e positivo",
    velocidade: "normal"
  },

  encerramento: {
    texto: `Qualquer coisa, é só chamar a gente novamente, tudo bem? [pausa média]

Tenha um ótimo dia! [pausa curta]

Tchau!`,
    tom: "caloroso e despedida humana",
    velocidade: "normal"
  },

  // ==========================================
  // SITUAÇÕES ESPECÍFICAS
  // ==========================================

  situacoes: {
    problema_complexo: {
      texto: `Olha, essa questão é um pouco mais complexa. [pausa média]

Mas não se preocupe. [pausa curta]

Vou acompanhar você passo a passo, tá bom? [pausa curta]

Vamos com calma.`,
      tom: "empático e paciente",
      velocidade: "devagar"
    },

    urgencia: {
      texto: `Entendi a urgência. [pausa curta]

Vamos resolver isso agora. [pausa média]

Preciso que você faça exatamente o que vou dizer, rápido.`,
      tom: "firme e objetivo",
      velocidade: "rápida mas clara"
    },

    boa_noticia: {
      texto: `Que ótima notícia! [pausa curta, tom animado]

Fico muito feliz que tenha dado certo. [pausa média]

Muito obrigado pela paciência!`,
      tom: "animado e entusiasta",
      velocidade: "normal"
    },

    cliente_frustrado: {
      texto: `Nossa, eu realmente entendo sua frustração. [pausa média]

Isso é realmente chato, eu sei. [pausa curta]

Mas fique tranquilo, estou aqui agora para resolver. [pausa média]

Vamos resolver isso juntos.`,
      tom: "empático e solidário",
      velocidade: "devagar e acolhedor"
    },

    explicacao_tecnica: {
      texto: `Deixa eu explicar de forma bem simples. [pausa média]

Pense assim: [pausa curta]

seu acesso é como uma chave de casa. [pausa curta]

Às vezes, a chave precisa ser recriada. [pausa curta]

É exatamente o que vamos fazer agora. [pausa média]

Fácil, né?`,
      tom: "didático e tranquilo",
      velocidade: "devagar com analogias"
    }
  },

  // ==========================================
  // EXPRESSÕES NATURAIS PARA USAR
  // ==========================================
  
  expressoes: {
    escuta_ativa: [
      "Entendi.",
      "Perfeito.",
      "Faz sentido.",
      "Claro.",
      "Sem problema.",
      "Estou acompanhando.",
      "Pode deixar.",
      "Combinado.",
      "Certo."
    ],
    
    transicao: [
      "Olha,",
      "Sabe de uma coisa?",
      "Deixa eu ver...",
      "Vamos por partes.",
      "Primeiro,",
      "Agora,"
    ],
    
    confirmacao: [
      "Conseguiu?",
      "Está vendo?",
      "Fez certo?",
      "Tá bom assim?"
    ],
    
    encerramento_positivo: [
      "Qualquer coisa, estarei por aqui.",
      "Pode voltar quando quiser.",
      "Fico à disposição.",
      "Precisa, é só chamar."
    ]
  },

  // ==========================================
  // EXEMPLO DE ATENDIMENTO COMPLETO
  // ==========================================

  exemplo_completo: `
Olá! [pausa curta]
Bom dia! [pausa curta]
Aqui é do suporte técnico da Claro. [pausa média]
Verifico que você entrou em contato sobre uma dificuldade de acesso ao sistema. [pausa curta]
É isso mesmo?

[Cliente confirma]

Entendi. [pausa curta]
Pode deixar comigo. [pausa curta]
Vou resolver isso agora.

Primeiro, preciso confirmar uma informação com você, tudo bem? [pausa média]

Quando você tenta acessar, o que aparece na tela exatamente? [pausa curta]

Ah, entendi... [pausa média]

E isso começou hoje, ou já faz algum tempo que está acontecendo? [pausa curta]

Perfeito. [pausa curta]
Isso me ajuda bastante.

Vou explicar o que está acontecendo. [pausa média]

É provável que seja uma questão de atualização de permissões no servidor. [pausa curta]

Nada grave. [pausa curta]
Mas preciso que você faça um ajuste rápido para liberar o acesso.

Vamos lá. [pausa curta]

Primeiro: você vai clicar no ícone de configurações, no canto superior direito. [pausa média]

Depois: selecione "Conta e segurança". [pausa média]

Pronto? [pausa curta]

Ótimo. [pausa curta]
Agora, role a página até encontrar "Sessões ativas". [pausa média]

Certo? [pausa curta]

Perfeito! [pausa curta]
Clique em "Encerrar todas as sessões". [pausa média]

Depois, faça login novamente com seu usuário e senha.

Conseguiu acessar agora? [pausa média]

Excelente! [pausa curta, tom animado]

Fico feliz que tenha funcionado. [pausa média]

Qualquer coisa, é só chamar a gente novamente, tudo bem? [pausa média]

Tenha um ótimo dia! [pausa curta]

Tchau!
  `
};

module.exports = scriptAtendimento;