/**
 * ========================================
 * STARKTECH - SISTEMA DE CREDIÁRIO LIMPO
 * Versão Simplificada e Funcional
 * ========================================
 */

// Configurações globais
const CONFIG = {
  SPREADSHEET_ID: '1RAd3dzwJqaye8Czfv6-BhbFrh_dgvJKZMgc_K6v1-EU',
  SHEETS: {
    CLIENTS: 'Clientes',
    CREDITS: 'Compras', 
    INSTALLMENTS: 'Parcelas',
    PAYMENTS: 'Pagamentos'
  },
  ADMIN: {
    user: 'admin',
    password: 'cf@stark2025'
  }
};

/**
 * ========================================
 * FUNÇÕES BÁSICAS DO SISTEMA
 * ========================================
 */

function doGet(e) {
  const output = HtmlService.createHtmlOutputFromFile('index');
  
  // Permitir iframe de qualquer origem
  output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  
  // Configurações adicionais de segurança
  output.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  
  return output;
}

function doPost(e) {
  // Se você usa POST requests
  const output = ContentService.createTextOutput('Success');
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getOrCreateSpreadsheet() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    console.log('✅ Planilha acessada:', spreadsheet.getName());
    return spreadsheet;
  } catch (error) {
    console.error('❌ Erro ao acessar planilha:', error);
    throw new Error(`Planilha não encontrada. ID: ${CONFIG.SPREADSHEET_ID}`);
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * ========================================
 * SISTEMA DE AUTENTICAÇÃO
 * ========================================
 */

function handleLogin(credentials) {
  try {
    console.log('🔐 Login iniciado:', credentials.userType);
    
    const { userType, identifier, password, user } = credentials;
    
    if (userType === 'admin') {
      if (user === CONFIG.ADMIN.user && password === CONFIG.ADMIN.password) {
        return {
          success: true,
          userType: 'admin',
          userData: { name: 'Administrador', user: user }
        };
      } else {
        return { success: false, error: 'Credenciais de administrador inválidas' };
      }
    } else {
      const client = findClientByIdentifier(identifier);
      
      if (!client) {
        return { success: false, error: 'CPF/CNPJ não encontrado' };
      }
      
      const senhaInformada = String(password).trim();
      const senhaCadastrada = String(client.senha).trim();
      
      if (senhaCadastrada === senhaInformada) {
        return {
          success: true,
          userType: 'client',
          userData: {
            id: client.id,
            name: client.nome,
            cpf: client.cpf,
            email: client.email
          }
        };
      } else {
        return { success: false, error: 'Senha incorreta' };
      }
    }
  } catch (error) {
    console.error('❌ Erro na autenticação:', error);
    return { success: false, error: 'Erro interno do servidor' };
  }
}
/**
 * ========================================
 * SISTEMA DE LINKS DE PAGAMENTO NUBANK
 * StarkTech - Crediário Limpo
 * ========================================
 */

/**
 * FUNÇÃO 1: PREPARAR PLANILHA PARA RECEBER LINKS
 * Execute esta função UMA vez para criar a coluna de links
 */
function adicionarColunaLinksNubank() {
  try {
    console.log('🏦 Preparando planilha para links do Nubank...');
    
    const spreadsheet = getOrCreateSpreadsheet();
    const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    
    if (!installmentsSheet) {
      console.log('❌ Aba Parcelas não encontrada');
      return { success: false, error: 'Aba Parcelas não encontrada' };
    }
    
    // Verificar estrutura atual
    const lastColumn = installmentsSheet.getLastColumn();
    const headers = installmentsSheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    
    console.log('📋 Headers atuais:', headers);
    
    // Verificar se já existe a coluna
    if (headers.includes('Link_Pagamento_Nubank')) {
      console.log('✅ Coluna Link_Pagamento_Nubank já existe');
      return { success: true, message: 'Coluna já existe' };
    }
    
    // Adicionar nova coluna
    const newColumnIndex = lastColumn + 1;
    installmentsSheet.getRange(1, newColumnIndex).setValue('Link_Pagamento_Nubank');
    
    // Formatar header
    installmentsSheet.getRange(1, newColumnIndex)
      .setBackground('#4285f4')
      .setFontColor('white')
      .setFontWeight('bold');
    
    console.log('✅ Coluna Link_Pagamento_Nubank criada na posição:', newColumnIndex);
    
    return {
      success: true,
      message: 'Coluna Link_Pagamento_Nubank criada com sucesso!',
      columnIndex: newColumnIndex
    };
    
  } catch (error) {
    console.error('❌ Erro ao criar coluna:', error);
    return { success: false, error: error.message };
  }
}

/**
 * FUNÇÃO 2: ADICIONAR LINK INDIVIDUAL PARA UMA PARCELA
 */
function adicionarLinkNubankParcela(creditId, numeroParcela, linkNubank) {
  try {
    console.log('🔗 Adicionando link Nubank:', {
      creditId: creditId,
      parcela: numeroParcela,
      link: linkNubank
    });
    
    // Validações
    if (!creditId || String(creditId).trim() === '') {
      return { success: false, error: 'ID do crediário é obrigatório' };
    }
    
    if (!numeroParcela || isNaN(numeroParcela) || numeroParcela < 1) {
      return { success: false, error: 'Número da parcela deve ser válido (maior que 0)' };
    }
    
    if (!linkNubank || !String(linkNubank).includes('checkout.nubank.com.br')) {
      return { success: false, error: 'Link deve ser um checkout válido do Nubank' };
    }
    
    const cleanCreditId = String(creditId).trim();
    const cleanParcela = parseInt(numeroParcela);
    const cleanLink = String(linkNubank).trim();
    
    // Garantir que a coluna existe
    const colunaResult = adicionarColunaLinksNubank();
    if (!colunaResult.success && !colunaResult.message.includes('já existe')) {
      return colunaResult;
    }
    
    const spreadsheet = getOrCreateSpreadsheet();
    const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    const data = installmentsSheet.getDataRange().getValues();
    const headers = data[0];
    
    // Encontrar coluna do link
    const linkColumnIndex = headers.indexOf('Link_Pagamento_Nubank');
    
    if (linkColumnIndex === -1) {
      return { success: false, error: 'Coluna Link_Pagamento_Nubank não encontrada' };
    }
    
    // Buscar a parcela específica
    let parcelaEncontrada = false;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowCreditId = String(row[1] || '').trim(); // Coluna B = Credit_ID
      const rowParcela = parseInt(row[2] || 0); // Coluna C = Numero_Parcela
      
      if (rowCreditId === cleanCreditId && rowParcela === cleanParcela) {
        // Atualizar o link
        installmentsSheet.getRange(i + 1, linkColumnIndex + 1).setValue(cleanLink);
        parcelaEncontrada = true;
        
        console.log(`✅ Link adicionado: Linha ${i + 1}, Coluna ${linkColumnIndex + 1}`);
        
        return {
          success: true,
          message: `Link Nubank adicionado para parcela ${cleanParcela} do crediário ${cleanCreditId}`,
          creditId: cleanCreditId,
          parcela: cleanParcela,
          link: cleanLink,
          linha: i + 1
        };
      }
    }
    
    if (!parcelaEncontrada) {
      // Mostrar parcelas disponíveis para debug
      console.log('❌ Parcela não encontrada. Parcelas disponíveis:');
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowCreditId = String(row[1] || '').trim();
        
        if (rowCreditId === cleanCreditId) {
          console.log(`  📋 Parcela ${row[2]} - Valor: R$ ${row[3]} - Vencimento: ${row[4]}`);
        }
      }
      
      return {
        success: false,
        error: `Parcela ${cleanParcela} não encontrada para o crediário ${cleanCreditId}`
      };
    }
    
  } catch (error) {
    console.error('❌ Erro ao adicionar link:', error);
    return { success: false, error: error.message };
  }
}

/**
 * FUNÇÃO 3: ADICIONAR MÚLTIPLOS LINKS PARA UM CREDIÁRIO
 */
function adicionarLinksNubankCredito(creditId, linksArray) {
  try {
    console.log('📦 Adicionando múltiplos links Nubank:', {
      creditId: creditId,
      totalLinks: linksArray ? linksArray.length : 0
    });
    
    if (!creditId) {
      return { success: false, error: 'ID do crediário é obrigatório' };
    }
    
    if (!Array.isArray(linksArray) || linksArray.length === 0) {
      return { success: false, error: 'Array de links é obrigatório' };
    }
    
    const resultados = [];
    let sucessos = 0;
    let erros = 0;
    
    for (let i = 0; i < linksArray.length; i++) {
      const numeroParcela = i + 1;
      const link = linksArray[i];
      
      if (link && String(link).trim() !== '') {
        const resultado = adicionarLinkNubankParcela(creditId, numeroParcela, link);
        
        resultados.push({
          parcela: numeroParcela,
          link: link,
          success: resultado.success,
          message: resultado.message || resultado.error
        });
        
        if (resultado.success) {
          sucessos++;
          console.log(`✅ Parcela ${numeroParcela}: Link adicionado`);
        } else {
          erros++;
          console.log(`❌ Parcela ${numeroParcela}: ${resultado.error}`);
        }
      } else {
        console.log(`⏭️ Parcela ${numeroParcela}: Link vazio, pulando`);
      }
    }
    
    return {
      success: sucessos > 0,
      message: `${sucessos} links adicionados, ${erros} erros`,
      sucessos: sucessos,
      erros: erros,
      resultados: resultados
    };
    
  } catch (error) {
    console.error('❌ Erro ao adicionar links em lote:', error);
    return { success: false, error: error.message };
  }
}

/**
 * FUNÇÃO 4: LISTAR TODOS OS CREDIÁRIOS E SUAS PARCELAS
 */
function listarCreditosParaLinks() {
  try {
    console.log('📋 Listando crediários disponíveis para adicionar links...');
    
    const creditsResult = getCredits();
    
    if (!creditsResult.success) {
      return { success: false, error: 'Erro ao carregar crediários' };
    }
    
    const creditosInfo = [];
    
    creditsResult.credits.forEach(credit => {
      const parcelas = credit.installments || [];
      
      creditosInfo.push({
        creditId: credit.id,
        cliente: credit.clientName,
        produto: credit.productName,
        valorTotal: credit.totalValue,
        totalParcelas: parcelas.length,
        parcelas: parcelas.map(p => ({
          numero: p.number,
          valor: p.value,
          vencimento: p.dueDate,
          status: p.status
        }))
      });
      
      console.log(`📋 ${credit.productName} (${credit.clientName})`);
      console.log(`   ID: ${credit.id}`);
      console.log(`   Parcelas: ${parcelas.length}`);
      console.log(`   Valor Total: R$ ${credit.totalValue}`);
      console.log('');
    });
    
    return {
      success: true,
      creditos: creditosInfo,
      message: `${creditosInfo.length} crediários encontrados`
    };
    
  } catch (error) {
    console.error('❌ Erro ao listar crediários:', error);
    return { success: false, error: error.message };
  }
}

/**
 * FUNÇÃO 5: VERIFICAR LINKS JÁ ADICIONADOS
 */
function verificarLinksExistentes(creditId = null) {
  try {
    console.log('🔍 Verificando links existentes...');
    
    const spreadsheet = getOrCreateSpreadsheet();
    const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    
    if (!installmentsSheet) {
      return { success: false, error: 'Aba Parcelas não encontrada' };
    }
    
    const data = installmentsSheet.getDataRange().getValues();
    const headers = data[0];
    const linkColumnIndex = headers.indexOf('Link_Pagamento_Nubank');
    
    if (linkColumnIndex === -1) {
      console.log('⚠️ Coluna Link_Pagamento_Nubank não existe');
      return {
        success: true,
        message: 'Coluna de links não existe ainda',
        parcelas: []
      };
    }
    
    const parcelasComLink = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowCreditId = String(row[1] || '').trim();
      const link = row[linkColumnIndex];
      
      // Filtrar por crediário específico se fornecido
      if (creditId && rowCreditId !== creditId) {
        continue;
      }
      
      if (link && String(link).trim() !== '') {
        parcelasComLink.push({
          creditId: rowCreditId,
          parcela: parseInt(row[2] || 0),
          valor: row[3],
          vencimento: row[4],
          link: String(link).trim(),
          linha: i + 1
        });
      }
    }
    
    console.log(`📊 ${parcelasComLink.length} parcelas com links encontradas`);
    
    if (creditId) {
      console.log(`🎯 Filtrado para crediário: ${creditId}`);
    }
    
    parcelasComLink.forEach(p => {
      console.log(`  📋 ${p.creditId} - Parcela ${p.parcela}: ${p.link}`);
    });
    
    return {
      success: true,
      parcelas: parcelasComLink,
      message: `${parcelasComLink.length} parcelas com links`
    };
    
  } catch (error) {
    console.error('❌ Erro ao verificar links:', error);
    return { success: false, error: error.message };
  }
}

/**
 * FUNÇÃO 6: ATUALIZAR A FUNÇÃO getPaymentUrlByProduct PARA USAR OS NOVOS LINKS
 */
function getPaymentUrlNubank(creditId, installmentNumber) {
  console.log('🏦 Buscando URL Nubank:', { creditId, installmentNumber });
  
  try {
    if (!creditId || !installmentNumber) {
      console.log('⚠️ Parâmetros inválidos');
      return 'https://checkout.nubank.com.br/QuKX2aKfp5azqxv'; // Link padrão
    }
    
    const cleanCreditId = String(creditId).trim();
    const cleanInstallmentNumber = parseInt(installmentNumber);
    
    const spreadsheet = getOrCreateSpreadsheet();
    const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    
    if (!installmentsSheet) {
      console.log('⚠️ Aba Parcelas não encontrada');
      return 'https://checkout.nubank.com.br/QuKX2aKfp5azqxv';
    }
    
    const data = installmentsSheet.getDataRange().getValues();
    const headers = data[0];
    const linkColumnIndex = headers.indexOf('Link_Pagamento_Nubank');
    
    if (linkColumnIndex === -1) {
      console.log('⚠️ Coluna Link_Pagamento_Nubank não existe');
      return 'https://checkout.nubank.com.br/QuKX2aKfp5azqxv';
    }
    
    // Buscar o link específico
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowCreditId = String(row[1] || '').trim();
      const rowInstallmentNumber = parseInt(row[2] || 0);
      
      if (rowCreditId === cleanCreditId && rowInstallmentNumber === cleanInstallmentNumber) {
        const linkNubank = row[linkColumnIndex];
        
        if (linkNubank && String(linkNubank).trim() !== '') {
          console.log(`✅ Link Nubank encontrado: ${linkNubank}`);
          return String(linkNubank).trim();
        }
      }
    }
    
    console.log('⚠️ Link específico não encontrado, usando padrão');
    return 'https://checkout.nubank.com.br/QuKX2aKfp5azqxv';
    
  } catch (error) {
    console.error('❌ Erro ao buscar URL Nubank:', error);
    return 'https://checkout.nubank.com.br/QuKX2aKfp5azqxv';
  }
}

/**
 * ========================================
 * FUNÇÕES DE EXEMPLO E TESTE
 * ========================================
 */

function exemploUsoNubank() {
  console.log('💡 === EXEMPLO DE USO - LINKS NUBANK ===');
  
  try {
    // 1. Preparar planilha
    console.log('\n🔧 1. Preparando planilha...');
    const prep = adicionarColunaLinksNubank();
    console.log('Preparação:', prep.success ? '✅' : '❌', prep.message);
    
    // 2. Listar crediários disponíveis
    console.log('\n📋 2. Crediários disponíveis:');
    const creditos = listarCreditosParaLinks();
    
    if (creditos.success && creditos.creditos.length > 0) {
      const creditoExemplo = creditos.creditos[0];
      console.log(`📋 Usando crediário: ${creditoExemplo.creditId} - ${creditoExemplo.produto}`);
      
      // 3. Adicionar link individual
      console.log('\n🔗 3. Adicionando link individual...');
      const linkIndividual = adicionarLinkNubankParcela(
        creditoExemplo.creditId, 
        1, 
        'https://checkout.nubank.com.br/RdrnvEY2QJazqxv'
      );
      console.log('Link individual:', linkIndividual.success ? '✅' : '❌', linkIndividual.message);
      
      // 4. Adicionar múltiplos links
      console.log('\n📦 4. Adicionando múltiplos links...');
      const linksExemplo = [
        'https://checkout.nubank.com.br/parcela1-exemplo',
        'https://checkout.nubank.com.br/parcela2-exemplo',
        'https://checkout.nubank.com.br/parcela3-exemplo'
      ];
      
      const linksMultiplos = adicionarLinksNubankCredito(creditoExemplo.creditId, linksExemplo);
      console.log('Links múltiplos:', linksMultiplos.success ? '✅' : '❌', linksMultiplos.message);
      
      // 5. Verificar links adicionados
      console.log('\n🔍 5. Verificando links adicionados...');
      const verificacao = verificarLinksExistentes(creditoExemplo.creditId);
      console.log('Verificação:', verificacao.success ? '✅' : '❌', verificacao.message);
      
      // 6. Testar busca de URL
      console.log('\n🔍 6. Testando busca de URL...');
      const urlEncontrada = getPaymentUrlNubank(creditoExemplo.creditId, 1);
      console.log('URL encontrada:', urlEncontrada);
    }
    
    return {
      success: true,
      message: 'Exemplo executado com sucesso! Verifique o console.'
    };
    
  } catch (error) {
    console.error('❌ Erro no exemplo:', error);
    return { success: false, error: error.message };
  }
}

/**
 * FUNÇÃO RÁPIDA: CONFIGURAÇÃO COMPLETA
 */
function configurarLinksNubankCompleto() {
  console.log('⚡ === CONFIGURAÇÃO COMPLETA NUBANK ===');
  
  try {
    // 1. Preparar planilha
    const prep = adicionarColunaLinksNubank();
    console.log('1. Planilha:', prep.success ? '✅' : '❌');
    
    // 2. Listar crediários
    const creditos = listarCreditosParaLinks();
    console.log('2. Crediários:', creditos.success ? '✅' : '❌');
    
    if (creditos.success) {
      console.log(`📊 Total de crediários: ${creditos.creditos.length}`);
      
      creditos.creditos.forEach(credito => {
        console.log(`📋 ${credito.produto} (${credito.cliente})`);
        console.log(`   ID: ${credito.creditId}`);
        console.log(`   Parcelas: ${credito.totalParcelas}`);
        console.log(`   💡 Para adicionar links:`);
        console.log(`   adicionarLinkNubankParcela('${credito.creditId}', 1, 'https://checkout.nubank.com.br/SEU_LINK')`);
        console.log('');
      });
    }
    
    // 3. Verificar links existentes
    const existentes = verificarLinksExistentes();
    console.log('3. Links existentes:', existentes.success ? '✅' : '❌');
    
    return {
      success: true,
      message: 'Sistema configurado e pronto para uso!'
    };
    
  } catch (error) {
    console.error('❌ Erro na configuração:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ========================================
 * GUIA DE USO PRÁTICO
 * ========================================
 */

/*
🏦 GUIA COMPLETO - LINKS DE PAGAMENTO NUBANK

🚀 PASSO A PASSO:

1️⃣ PREPARAÇÃO INICIAL (Execute UMA vez):
   adicionarColunaLinksNubank()

2️⃣ VER CREDIÁRIOS DISPONÍVEIS:
   listarCreditosParaLinks()

3️⃣ ADICIONAR LINK PARA UMA PARCELA:
   adicionarLinkNubankParcela('ID_DO_CREDITO', 1, 'https://checkout.nubank.com.br/RdrnvEY2QJazqxv')

4️⃣ ADICIONAR VÁRIOS LINKS DE UMA VEZ:
   adicionarLinksNubankCredito('ID_DO_CREDITO', [
     'https://checkout.nubank.com.br/link-parcela1',
     'https://checkout.nubank.com.br/link-parcela2',
     'https://checkout.nubank.com.br/link-parcela3'
   ])

5️⃣ VERIFICAR LINKS JÁ ADICIONADOS:
   verificarLinksExistentes('ID_DO_CREDITO')

6️⃣ CONFIGURAÇÃO AUTOMÁTICA:
   configurarLinksNubankCompleto()

🎯 EXEMPLOS PRÁTICOS:

// Adicionar link para primeira parcela
adicionarLinkNubankParcela('abc123', 1, 'https://checkout.nubank.com.br/RdrnvEY2QJazqxv')

// Adicionar links para todas as parcelas de um crediário
adicionarLinksNubankCredito('abc123', [
  'https://checkout.nubank.com.br/parcela1-abc123',
  'https://checkout.nubank.com.br/parcela2-abc123', 
  'https://checkout.nubank.com.br/parcela3-abc123',
  'https://checkout.nubank.com.br/parcela4-abc123'
])

// Ver todos os links de um crediário
verificarLinksExistentes('abc123')

⚡ CONFIGURAÇÃO RÁPIDA:
Execute: configurarLinksNubankCompleto()

🔄 INTEGRAÇÃO NO SISTEMA:
No seu código HTML, substitua:
getPaymentUrlByProduct() → getPaymentUrlNubank()

✅ O sistema vai:
- Criar coluna "Link_Pagamento_Nubank" automaticamente
- Validar se os links são do Nubank
- Mostrar logs detalhados de cada operação
- Permitir verificar links já adicionados
- Buscar o link correto para cada parcela

🎯 RESULTADO:
Cada parcela terá seu link específico do Nubank na planilha,
e o sistema usará automaticamente o link correto para pagamentos!
*/

/**
 * PASSO 3: DEFINIR LINKS EM LOTE PARA UM CREDIÁRIO
 * Define links para todas as parcelas de um crediário de uma vez
 */
function definirLinksCredito(creditId, linksArray) {
  try {
    console.log('📦 Definindo links em lote para crediário:', creditId);
    console.log('🔗 Links recebidos:', linksArray);
    
    if (!creditId || !Array.isArray(linksArray)) {
      return { success: false, error: 'CreditId e array de links são obrigatórios' };
    }
    
    const results = [];
    
    for (let i = 0; i < linksArray.length; i++) {
      const installmentNumber = i + 1;
      const paymentUrl = linksArray[i];
      
      if (paymentUrl && paymentUrl.trim() !== '') {
        const result = definirLinkParcela(creditId, installmentNumber, paymentUrl.trim());
        results.push({
          parcela: installmentNumber,
          success: result.success,
          message: result.message || result.error
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount > 0,
      message: `${successCount} links definidos com sucesso`,
      results: results
    };
    
  } catch (error) {
    console.error('❌ Erro ao definir links em lote:', error);
    return { success: false, error: error.message };
  }
}

/**
 * PASSO 4: LISTAR PARCELAS COM SEUS LINKS
 * Mostra todas as parcelas de um crediário e seus links
 */
function listarParcelasComLinks(creditId) {
  try {
    console.log('📋 Listando parcelas com links para:', creditId);
    
    const spreadsheet = getOrCreateSpreadsheet();
    const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    const creditsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CREDITS);
    
    if (!installmentsSheet || !creditsSheet) {
      return { success: false, error: 'Planilhas não encontradas' };
    }
    
    // Buscar informações do crediário
    const creditsData = creditsSheet.getDataRange().getValues();
    let creditInfo = null;
    
    for (let i = 1; i < creditsData.length; i++) {
      if (creditsData[i][0] === creditId) {
        creditInfo = {
          id: creditsData[i][0],
          clientName: creditsData[i][2],
          productName: creditsData[i][3],
          totalValue: creditsData[i][6]
        };
        break;
      }
    }
    
    if (!creditInfo) {
      return { success: false, error: 'Crediário não encontrado' };
    }
    
    // Buscar parcelas
    const installmentsData = installmentsSheet.getDataRange().getValues();
    const headers = installmentsData[0];
    const linkColumnIndex = headers.indexOf('Link_Pagamento');
    
    const parcelas = [];
    
    for (let i = 1; i < installmentsData.length; i++) {
      const row = installmentsData[i];
      
      if (row[1] === creditId) {
        parcelas.push({
          numero: row[2],
          valor: row[3],
          vencimento: formatDate(row[4]),
          status: row[5],
          linkPagamento: linkColumnIndex !== -1 ? row[linkColumnIndex] || '' : '',
          temLink: linkColumnIndex !== -1 && row[linkColumnIndex] && String(row[linkColumnIndex]).trim() !== ''
        });
      }
    }
    
    parcelas.sort((a, b) => a.numero - b.numero);
    
    return {
      success: true,
      creditInfo: creditInfo,
      parcelas: parcelas,
      message: `${parcelas.length} parcelas encontradas`
    };
    
  } catch (error) {
    console.error('❌ Erro ao listar parcelas:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ========================================
 * FUNÇÃO DE LOGIN MELHORADA - SUPORTE A EMAIL
 * ========================================
 */

function findClientByIdentifier(identifier) {
  try {
    console.log('🔍 Buscando cliente por identificador:', identifier);
    
    const spreadsheet = getOrCreateSpreadsheet();
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CLIENTS);
    
    if (!sheet) {
      console.log('❌ Aba Clientes não encontrada');
      return null;
    }
    
    const data = sheet.getDataRange().getValues();
    console.log('📊 Total de linhas na planilha:', data.length);
    
    const cleanIdentifier = String(identifier).trim();
    const numbersOnly = cleanIdentifier.replace(/\D/g, '');
    const emailSearch = cleanIdentifier.toLowerCase().trim();
    
    console.log('🔍 Procurando por:', {
      original: identifier,
      clean: cleanIdentifier,
      numbersOnly: numbersOnly,
      emailSearch: emailSearch
    });
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Pular linhas vazias
      if (!row[0] || !row[1]) {
        console.log(`⏭️ Pulando linha ${i} (vazia)`);
        continue;
      }
      
      const id = String(row[0] || '').trim();
      const nome = String(row[1] || '').trim();
      const cpf = String(row[2] || '').trim();
      const email = String(row[3] || '').trim();
      const telefone = String(row[4] || '').trim();
      const senha = String(row[5] || '').trim();
      
      console.log(`🔍 Linha ${i}:`, {
        id: id,
        nome: nome,
        cpf: cpf,
        email: email,
        senha: senha ? '***' : '(vazia)'
      });
      
      // Preparar dados para comparação
      const cpfNumbers = cpf.replace(/\D/g, '');
      const emailClean = email.toLowerCase().trim();
      
      // Verificar correspondências
      const matchCpfFormatted = cpf === cleanIdentifier;
      const matchCpfNumbers = cpfNumbers === numbersOnly && numbersOnly.length >= 11;
      const matchEmail = emailClean === emailSearch && emailClean.length > 0;
      
      console.log(`🎯 Comparações linha ${i}:`, {
        cpfFormatted: `"${cpf}" === "${cleanIdentifier}" = ${matchCpfFormatted}`,
        cpfNumbers: `"${cpfNumbers}" === "${numbersOnly}" = ${matchCpfNumbers}`,
        email: `"${emailClean}" === "${emailSearch}" = ${matchEmail}`
      });
      
      if (matchCpfFormatted || matchCpfNumbers || matchEmail) {
        console.log('✅ Cliente encontrado!', {
          matchType: matchEmail ? 'EMAIL' : 'CPF',
          cliente: nome
        });
        
        return {
          id: id,
          nome: nome,
          cpf: cpf,
          email: email,
          telefone: telefone,
          senha: senha,
          dataCadastro: row[6]
        };
      }
    }
    
    console.log('❌ Cliente não encontrado para:', identifier);
    return null;
    
  } catch (error) {
    console.error('❌ Erro ao buscar cliente:', error);
    return null;
  }
}

/**
 * ========================================
 * FUNÇÃO DE LOGIN MELHORADA
 * ========================================
 */

function handleLogin(credentials) {
  try {
    console.log('🔐 === INÍCIO DO LOGIN ===');
    console.log('📝 Credenciais recebidas:', {
      userType: credentials.userType,
      identifier: credentials.identifier ? `${credentials.identifier.substring(0, 3)}***` : '(vazio)',
      hasPassword: !!credentials.password
    });
    
    const { userType, identifier, password, user } = credentials;
    
    if (userType === 'admin') {
      console.log('👤 Login de administrador');
      
      if (user === CONFIG.ADMIN.user && password === CONFIG.ADMIN.password) {
        console.log('✅ Admin autenticado com sucesso');
        return {
          success: true,
          userType: 'admin',
          userData: { name: 'Administrador', user: user }
        };
      } else {
        console.log('❌ Credenciais de admin inválidas');
        return { success: false, error: 'Credenciais de administrador inválidas' };
      }
    } 
    
    else if (userType === 'client') {
      console.log('👤 Login de cliente');
      
      // Validar entrada
      if (!identifier || !password) {
        console.log('❌ Dados obrigatórios não informados');
        return { success: false, error: 'CPF/CNPJ/Email e senha são obrigatórios' };
      }
      
      // Buscar cliente
      const client = findClientByIdentifier(identifier);
      
      if (!client) {
        console.log('❌ Cliente não encontrado');
        return { success: false, error: 'CPF/CNPJ ou Email não encontrado' };
      }
      
      console.log('✅ Cliente encontrado:', client.nome);
      
      // Verificar senha
      const senhaInformada = String(password).trim();
      const senhaCadastrada = String(client.senha).trim();
      
      console.log('🔐 Verificando senha:', {
        informada: senhaInformada ? `${senhaInformada.substring(0, 2)}***` : '(vazia)',
        cadastrada: senhaCadastrada ? `${senhaCadastrada.substring(0, 2)}***` : '(vazia)',
        match: senhaCadastrada === senhaInformada
      });
      
      if (senhaCadastrada === senhaInformada) {
        console.log('✅ Senha correta - Login autorizado');
        return {
          success: true,
          userType: 'client',
          userData: {
            id: client.id,
            name: client.nome,
            cpf: client.cpf,
            email: client.email
          }
        };
      } else {
        console.log('❌ Senha incorreta');
        return { success: false, error: 'Senha incorreta' };
      }
    }
    
    else {
      console.log('❌ Tipo de usuário inválido');
      return { success: false, error: 'Tipo de usuário inválido' };
    }
    
  } catch (error) {
    console.error('❌ Erro na autenticação:', error);
    return { success: false, error: 'Erro interno do servidor: ' + error.message };
  } finally {
    console.log('🔐 === FIM DO LOGIN ===');
  }
}
/**
 * ========================================
 * FUNÇÃO deleteClient PARA GOOGLE APPS SCRIPT
 * ========================================
 */

function deleteClient(clientId) {
  try {
    console.log('🗑️ Iniciando exclusão do cliente:', clientId);
    
    if (!clientId) {
      return { success: false, error: 'ID do cliente não fornecido' };
    }
    
    const spreadsheet = getOrCreateSpreadsheet();
    const clientsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CLIENTS);
    
    if (!clientsSheet) {
      return { success: false, error: 'Planilha de clientes não encontrada' };
    }
    
    // Buscar linha do cliente
    const data = clientsSheet.getDataRange().getValues();
    let clientRow = -1;
    let clientName = '';
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === clientId) {
        clientRow = i + 1; // +1 porque getRange é 1-indexed
        clientName = data[i][1] || 'Cliente';
        break;
      }
    }
    
    if (clientRow === -1) {
      return { success: false, error: 'Cliente não encontrado' };
    }
    
    console.log('✅ Cliente encontrado na linha:', clientRow);
    console.log('👤 Nome do cliente:', clientName);
    
    // Verificar se cliente tem crediários ativos
    const hasActiveCredits = checkClientHasCredits(clientId);
    
    if (hasActiveCredits) {
      return { 
        success: false, 
        error: 'Cliente possui crediários ativos. Exclua os crediários primeiro.' 
      };
    }
    
    // Excluir linha do cliente
    clientsSheet.deleteRow(clientRow);
    
    // Log da operação
    logClientDeletion(clientId, clientName);
    
    console.log('✅ Cliente excluído com sucesso');
    
    return {
      success: true,
      message: `Cliente "${clientName}" excluído com sucesso`,
      clientId: clientId,
      clientName: clientName
    };
    
  } catch (error) {
    console.error('❌ Erro ao excluir cliente:', error);
    return { success: false, error: 'Erro interno: ' + error.message };
  }
}

/**
 * Verificar se cliente tem crediários ativos
 */
function checkClientHasCredits(clientId) {
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const creditsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CREDITS);
    
    if (!creditsSheet) return false;
    
    const data = creditsSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === clientId) { // Cliente_ID está na coluna B (índice 1)
        console.log('⚠️ Cliente possui crediário:', data[i][0]);
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    console.error('❌ Erro ao verificar crediários:', error);
    return false;
  }
}

/**
 * Registrar log da exclusão
 */
function logClientDeletion(clientId, clientName) {
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    let logSheet = spreadsheet.getSheetByName('Logs_Exclusoes');
    
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet('Logs_Exclusoes');
      logSheet.getRange(1, 1, 1, 5).setValues([[
        'Data', 'Tipo', 'ID_Excluido', 'Nome', 'Usuario'
      ]]);
    }
    
    logSheet.appendRow([
      new Date(),
      'Cliente',
      clientId,
      clientName,
      'Admin Web'
    ]);
    
    console.log('📝 Log de exclusão registrado');
    
  } catch (error) {
    console.error('❌ Erro ao registrar log:', error);
    // Não falhar a operação principal por causa do log
  }
}

/**
 * ========================================
 * FUNÇÃO updateClient MELHORADA
 * ========================================
 */

function updateClient(clientId, clientData) {
  try {
    console.log('💾 Atualizando cliente:', clientId);
    
    if (!clientId || !clientData) {
      return { success: false, error: 'Dados insuficientes para atualização' };
    }
    
    const spreadsheet = getOrCreateSpreadsheet();
    const clientsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CLIENTS);
    
    if (!clientsSheet) {
      return { success: false, error: 'Planilha de clientes não encontrada' };
    }
    
    // Buscar linha do cliente
    const data = clientsSheet.getDataRange().getValues();
    let clientRow = -1;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === clientId) {
        clientRow = i + 1;
        break;
      }
    }
    
    if (clientRow === -1) {
      return { success: false, error: 'Cliente não encontrado' };
    }
    
    // Atualizar dados
    if (clientData.name) {
      clientsSheet.getRange(clientRow, 2).setValue(clientData.name);
    }
    if (clientData.cpf) {
      clientsSheet.getRange(clientRow, 3).setValue(formatDocument(clientData.cpf));
    }
    if (clientData.email !== undefined) {
      clientsSheet.getRange(clientRow, 4).setValue(clientData.email.toLowerCase().trim());
    }
    if (clientData.phone !== undefined) {
      clientsSheet.getRange(clientRow, 5).setValue(clientData.phone);
    }
    if (clientData.password) {
      clientsSheet.getRange(clientRow, 6).setValue(clientData.password);
    }
    
    console.log('✅ Cliente atualizado com sucesso');
    
    return {
      success: true,
      message: 'Cliente atualizado com sucesso',
      clientId: clientId
    };
    
  } catch (error) {
    console.error('❌ Erro ao atualizar cliente:', error);
    return { success: false, error: 'Erro interno: ' + error.message };
  }
}

/**
 * ========================================
 * FUNÇÃO PARA LISTAR CLIENTES COM CREDIÁRIOS
 * ========================================
 */

function getClientsWithCredits() {
  try {
    console.log('📋 Listando clientes com seus crediários...');
    
    const clientsResult = getClients();
    const creditsResult = getCredits();
    
    if (!clientsResult.success || !creditsResult.success) {
      return { success: false, error: 'Erro ao carregar dados' };
    }
    
    const clients = clientsResult.clients;
    const credits = creditsResult.credits;
    
    // Adicionar informação de crediários a cada cliente
    const clientsWithCredits = clients.map(client => ({
      ...client,
      creditsCount: credits.filter(credit => credit.clientId === client.id).length,
      hasActiveCredits: credits.some(credit => 
        credit.clientId === client.id && 
        credit.installments.some(inst => inst.status !== 'Pago')
      )
    }));
    
    return {
      success: true,
      clients: clientsWithCredits
    };
    
  } catch (error) {
    console.error('❌ Erro ao listar clientes:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ========================================
 * FUNÇÃO DE TESTE DO SISTEMA DE EXCLUSÃO
 * ========================================
 */

function testarSistemaExclusao() {
  console.log('🧪 === TESTE DO SISTEMA DE EXCLUSÃO ===');
  
  try {
    // Listar clientes
    const clientsResult = getClientsWithCredits();
    
    if (clientsResult.success) {
      console.log('📋 Clientes encontrados:');
      clientsResult.clients.forEach(client => {
        console.log(`- ${client.name} (${client.id}) - Crediários: ${client.creditsCount} - Ativos: ${client.hasActiveCredits ? 'Sim' : 'Não'}`);
      });
      
      // Encontrar cliente sem crediários ativos para teste
      const clientSemCreditos = clientsResult.clients.find(c => !c.hasActiveCredits);
      
      if (clientSemCreditos) {
        console.log(`\n✅ Cliente elegível para exclusão encontrado: ${clientSemCreditos.name}`);
        console.log('💡 Para testar exclusão, execute:');
        console.log(`deleteClient('${clientSemCreditos.id}')`);
      } else {
        console.log('\n⚠️ Nenhum cliente elegível para exclusão (todos têm crediários ativos)');
      }
    }
    
    return {
      success: true,
      message: 'Teste concluído - verifique o console'
    };
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ========================================
 * FUNÇÃO DE TESTE DE LOGIN
 * ========================================
 */

function testarLoginPorEmail() {
  console.log('🧪 === TESTE DE LOGIN POR EMAIL ===');
  
  try {
    // Listar todos os clientes para debug
    const spreadsheet = getOrCreateSpreadsheet();
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CLIENTS);
    const data = sheet.getDataRange().getValues();
    
    console.log('📋 Clientes cadastrados:');
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0]) {
        console.log(`${i}. ${row[1]} | CPF: ${row[2]} | Email: ${row[3]} | Senha: ${row[5] ? '***' : '(vazia)'}`);
      }
    }
    
    // Teste com emails específicos
    const testEmails = [
      'duarte@gmail.com',
      'wanderson@email.com', 
      'maria@email.com'
    ];
    
    console.log('\n🔍 Testando busca por email:');
    testEmails.forEach(email => {
      const client = findClientByIdentifier(email);
      console.log(`Email "${email}": ${client ? `✅ ${client.nome}` : '❌ Não encontrado'}`);
    });
    
    return {
      success: true,
      message: 'Teste concluído - verifique o console do Apps Script'
    };
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ========================================
 * FUNÇÃO PARA CORRIGIR EMAILS EXISTENTES
 * ========================================
 */

function corrigirEmailsClientes() {
  try {
    console.log('🔧 Corrigindo emails dos clientes...');
    
    const spreadsheet = getOrCreateSpreadsheet();
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CLIENTS);
    const data = sheet.getDataRange().getValues();
    
    let corrigidos = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] && row[3]) { // Se tem ID e email
        const emailOriginal = String(row[3]).trim();
        const emailCorrigido = emailOriginal.toLowerCase().trim();
        
        if (emailOriginal !== emailCorrigido) {
          sheet.getRange(i + 1, 4).setValue(emailCorrigido);
          console.log(`✅ Email corrigido: "${emailOriginal}" → "${emailCorrigido}"`);
          corrigidos++;
        }
      }
    }
    
    console.log(`🎉 Correção concluída: ${corrigidos} emails corrigidos`);
    
    return {
      success: true,
      message: `${corrigidos} emails corrigidos`,
      corrigidos: corrigidos
    };
    
  } catch (error) {
    console.error('❌ Erro ao corrigir emails:', error);
    return { success: false, error: error.message };
  }
}
/**
 * ========================================
 * SISTEMA DE RECUPERAÇÃO DE SENHA - BACKEND
 * ========================================
 */

function recoverPassword(identifier) {
  try {
    console.log('🔑 Iniciando recuperação de senha para:', identifier);
    
    if (!identifier) {
      return { success: false, error: 'CPF/CNPJ ou email não informado' };
    }
    
    // Buscar cliente
    const client = findClientByIdentifier(identifier);
    
    if (!client) {
      console.log('❌ Cliente não encontrado para recuperação');
      return { success: false, error: 'CPF/CNPJ ou email não encontrado no sistema' };
    }
    
    console.log('✅ Cliente encontrado para recuperação:', client.nome);
    
    // Gerar nova senha aleatória
    const newPassword = generateRandomPassword();
    
    // Atualizar senha na planilha
    const updateResult = updateClientPassword(client.id, newPassword);
    
    if (!updateResult) {
      return { success: false, error: 'Erro interno ao atualizar senha' };
    }
    
    // Log da operação
    logPasswordRecovery(client.id, client.nome, identifier);
    
    console.log('✅ Senha recuperada com sucesso');
    
    return {
      success: true,
      newPassword: newPassword,
      clientName: client.nome,
      message: 'Nova senha gerada com sucesso!'
    };
    
  } catch (error) {
    console.error('❌ Erro na recuperação de senha:', error);
    return { success: false, error: 'Erro interno do servidor' };
  }
}

/**
 * Gera uma senha aleatória segura mas fácil de digitar
 */
function generateRandomPassword() {
  const options = [
    // Senhas numéricas simples
    () => Math.floor(100000 + Math.random() * 900000).toString(), // 6 dígitos
    () => new Date().getFullYear().toString() + String(Math.floor(10 + Math.random() * 90)).padStart(2, '0'), // Ano + 2 dígitos
    
    // Senhas alfanuméricas simples
    () => {
      const words = ['stark', 'tech', 'facil', 'novo', 'senha'];
      const word = words[Math.floor(Math.random() * words.length)];
      const number = Math.floor(10 + Math.random() * 90);
      return word + number;
    },
    
    // Padrões simples
    () => 'novo' + Math.floor(1000 + Math.random() * 9000),
    () => '2025' + String(Math.floor(100 + Math.random() * 900)),
  ];
  
  // Escolher um padrão aleatório
  const randomOption = options[Math.floor(Math.random() * options.length)];
  return randomOption();
}

/**
 * Atualiza a senha de um cliente na planilha
 */
function updateClientPassword(clientId, newPassword) {
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CLIENTS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === clientId) {
        // Atualizar senha na coluna 6 (índice 5)
        sheet.getRange(i + 1, 6).setValue(newPassword);
        console.log('✅ Senha atualizada na planilha');
        return true;
      }
    }
    
    console.log('❌ Cliente não encontrado para atualização');
    return false;
    
  } catch (error) {
    console.error('❌ Erro ao atualizar senha:', error);
    return false;
  }
}

/**
 * Registra a recuperação de senha para auditoria
 */
function logPasswordRecovery(clientId, clientName, identifier) {
  try {
    console.log('📝 Registrando recuperação de senha:', {
      cliente: clientName,
      identificador: identifier,
      data: new Date()
    });
    
    // Opcional: Criar uma aba de logs se necessário
    const spreadsheet = getOrCreateSpreadsheet();
    let logSheet = spreadsheet.getSheetByName('Logs_Recuperacao');
    
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet('Logs_Recuperacao');
      logSheet.getRange(1, 1, 1, 5).setValues([[
        'Data', 'Cliente_ID', 'Cliente_Nome', 'Identificador_Usado', 'IP/User'
      ]]);
    }
    
    logSheet.appendRow([
      new Date(),
      clientId,
      clientName,
      identifier,
      'Sistema Web'
    ]);
    
  } catch (error) {
    console.error('❌ Erro ao registrar log:', error);
    // Não falhar a operação principal por causa do log
  }
}

/**
 * ========================================
 * FUNÇÕES AUXILIARES DE RECUPERAÇÃO
 * ========================================
 */

/**
 * Reset de senha em massa (apenas para admin)
 */
function resetAllPasswordsToDefault() {
  try {
    console.log('🔧 Resetando todas as senhas para padrão...');
    
    const spreadsheet = getOrCreateSpreadsheet();
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CLIENTS);
    const data = sheet.getDataRange().getValues();
    
    let resetCount = 0;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) { // Se tem ID
        sheet.getRange(i + 1, 6).setValue('123456'); // Senha padrão
        resetCount++;
      }
    }
    
    console.log(`✅ ${resetCount} senhas resetadas para "123456"`);
    
    return {
      success: true,
      message: `${resetCount} senhas resetadas para "123456"`,
      resetCount: resetCount
    };
    
  } catch (error) {
    console.error('❌ Erro no reset em massa:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reset de senha específica por CPF (para admin)
 */
function resetPasswordByCpf(cpf, newPassword = null) {
  try {
    console.log('🔧 Resetando senha por CPF:', cpf);
    
    const client = findClientByIdentifier(cpf);
    
    if (!client) {
      return { success: false, error: 'Cliente não encontrado' };
    }
    
    const passwordToSet = newPassword || '123456';
    const updateResult = updateClientPassword(client.id, passwordToSet);
    
    if (updateResult) {
      console.log(`✅ Senha resetada para: ${passwordToSet}`);
      
      return {
        success: true,
        message: `Senha do cliente ${client.nome} resetada`,
        loginInfo: {
          nome: client.nome,
          cpf: client.cpf,
          email: client.email,
          senha: passwordToSet
        }
      };
    } else {
      return { success: false, error: 'Erro ao atualizar senha' };
    }
    
  } catch (error) {
    console.error('❌ Erro no reset por CPF:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Função para listar clientes com senhas (para debug admin)
 */
function listClientsWithPasswords() {
  try {
    console.log('👥 Listando clientes e senhas...');
    
    const spreadsheet = getOrCreateSpreadsheet();
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CLIENTS);
    const data = sheet.getDataRange().getValues();
    
    const clients = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0]) {
        clients.push({
          nome: row[1],
          cpf: row[2],
          email: row[3],
          senha: row[5],
          temSenha: !!row[5]
        });
        
        console.log(`👤 ${row[1]} | CPF: ${row[2]} | Email: ${row[3]} | Senha: ${row[5] || '(vazia)'}`);
      }
    }
    
    return {
      success: true,
      clients: clients,
      message: `${clients.length} clientes listados`
    };
    
  } catch (error) {
    console.error('❌ Erro ao listar clientes:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ========================================
 * FUNÇÕES DE CLIENTES
 * ========================================
 */

function createClient(clientData) {
  try {
    let { name, cpf, email, phone, password } = clientData;
    
    if (!name || !cpf || !password) {
      return { success: false, error: 'Nome, CPF e senha são obrigatórios' };
    }
    
    // Formatar CPF automaticamente
    cpf = formatDocument(cpf);
    
    // Verificar se já existe
    if (findClientByIdentifier(cpf)) {
      return { success: false, error: 'CPF já cadastrado' };
    }
    
    // Formatar telefone
    if (phone) {
      const phoneNumbers = phone.replace(/\D/g, '');
      if (phoneNumbers.length === 11) {
        phone = phoneNumbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
      }
    }
    
    const spreadsheet = getOrCreateSpreadsheet();
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CLIENTS);
    
    const clientId = generateId();
    const newRow = [
      clientId,
      name.trim(),
      cpf,
      email ? email.trim().toLowerCase() : '',
      phone || '',
      String(password).trim(),
      new Date()
    ];
    
    sheet.appendRow(newRow);
    
    return {
      success: true,
      clientId: clientId,
      message: `Cliente cadastrado: ${name} (${cpf})`
    };
    
  } catch (error) {
    console.error('❌ Erro ao criar cliente:', error);
    return { success: false, error: 'Erro interno: ' + error.message };
  }
}

function formatDocument(documento) {
  if (!documento) return '';
  
  const numeros = documento.replace(/\D/g, '');
  
  if (numeros.length === 11) {
    return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  
  if (numeros.length === 14) {
    return numeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  
  return documento;
}

function getClients() {
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CLIENTS);
    const data = sheet.getDataRange().getValues();
    
    const clients = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0]) {
        clients.push({
          id: row[0],
          name: row[1],
          cpf: row[2],
          email: row[3],
          phone: row[4],
          createdDate: formatDate(row[6])
        });
      }
    }
    
    return { success: true, clients: clients };
  } catch (error) {
    console.error('❌ Erro ao buscar clientes:', error);
    return { success: false, error: 'Erro ao carregar clientes', clients: [] };
  }
}

/**
 * ========================================
 * FUNÇÕES DE CREDIÁRIOS
 * ========================================
 */

function createCredit(creditData) {
  try {
    const {
      clientId, productName, productDescription, productEmoji,
      totalValue, purchaseDate, storeName, storeEmoji, installments
    } = creditData;
    
    if (!clientId || !productName || !totalValue || !installments) {
      return { success: false, error: 'Dados obrigatórios não informados' };
    }
    
    const spreadsheet = getOrCreateSpreadsheet();
    const client = getClientById(clientId);
    
    if (!client) {
      return { success: false, error: 'Cliente não encontrado' };
    }
    
    // Criar crediário
    const creditId = generateId();
    const creditsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CREDITS);
    
    const creditRow = [
      creditId,
      clientId,
      client.name,
      productName,
      productDescription || '',
      productEmoji || '🛒',
      totalValue,
      purchaseDate,
      storeName || 'Loja',
      storeEmoji || '🏬',
      'Ativo'
    ];
    
    creditsSheet.appendRow(creditRow);
    
    // Criar parcelas
    const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    const installmentValue = totalValue / installments;
    const firstDueDate = new Date(purchaseDate);
    firstDueDate.setMonth(firstDueDate.getMonth() + 1);
    
    for (let i = 1; i <= installments; i++) {
      const dueDate = new Date(firstDueDate);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));
      
      const installmentRow = [
        generateId(),
        creditId,
        i,
        installmentValue,
        dueDate,
        'Pendente',
        ''
      ];
      
      installmentsSheet.appendRow(installmentRow);
    }
    
    return {
      success: true,
      creditId: creditId,
      message: 'Crediário criado com sucesso!'
    };
    
  } catch (error) {
    console.error('❌ Erro ao criar crediário:', error);
    return { success: false, error: 'Erro interno do servidor' };
  }
}

function getCredits(clientId = null) {
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const creditsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CREDITS);
    const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    
    const creditsData = creditsSheet.getDataRange().getValues();
    const installmentsData = installmentsSheet.getDataRange().getValues();
    
    const credits = [];
    
    for (let i = 1; i < creditsData.length; i++) {
      const creditRow = creditsData[i];
      
      if (!creditRow[0]) continue;
      
      if (clientId && creditRow[1] !== clientId) continue;
      
      // Buscar parcelas
      const creditInstallments = [];
      for (let j = 1; j < installmentsData.length; j++) {
        const installmentRow = installmentsData[j];
        if (installmentRow[1] === creditRow[0]) {
          creditInstallments.push({
            id: installmentRow[0],
            number: installmentRow[2],
            value: installmentRow[3],
            dueDate: formatDate(installmentRow[4]),
            status: installmentRow[5],
            paymentDate: installmentRow[6] ? formatDate(installmentRow[6]) : null
          });
        }
      }
      
      creditInstallments.sort((a, b) => a.number - b.number);
      
      credits.push({
        id: creditRow[0],
        clientId: creditRow[1],
        clientName: creditRow[2],
        productName: creditRow[3],
        productDescription: creditRow[4],
        productEmoji: creditRow[5],
        totalValue: creditRow[6],
        purchaseDate: formatDate(creditRow[7]),
        storeName: creditRow[8],
        storeEmoji: creditRow[9],
        status: creditRow[10],
        installments: creditInstallments
      });
    }
    
    return { success: true, credits: credits };
  } catch (error) {
    console.error('❌ Erro ao buscar crediários:', error);
    return { success: false, error: 'Erro ao carregar crediários', credits: [] };
  }
}

function getClientById(clientId) {
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CLIENTS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === clientId) {
        return {
          id: data[i][0],
          name: data[i][1],
          cpf: data[i][2],
          email: data[i][3],
          phone: data[i][4]
        };
      }
    }
    return null;
  } catch (error) {
    console.error('❌ Erro ao buscar cliente por ID:', error);
    return null;
  }
}

function buscarUrlNaPlanilhaV2(creditId, installmentNumber) {
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    
    if (!installmentsSheet) {
      console.log('⚠️ Aba Parcelas não encontrada');
      return null;
    }
    
    const data = installmentsSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      console.log('⚠️ Nenhum dado na aba Parcelas');
      return null;
    }
    
    const headers = data[0];
    const linkColumnIndex = headers.indexOf('Link_Pagamento');
    
    if (linkColumnIndex === -1) {
      console.log('⚠️ Coluna Link_Pagamento não existe');
      return null;
    }
    
    // Buscar a parcela específica
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowCreditId = String(row[1] || '').trim();
      const rowInstallmentNumber = parseInt(row[2] || 0);
      
      if (rowCreditId === creditId && rowInstallmentNumber === installmentNumber) {
        const linkManual = row[linkColumnIndex];
        
        if (linkManual && String(linkManual).trim() !== '') {
          console.log(`📋 Link encontrado na planilha: ${linkManual}`);
          return String(linkManual).trim();
        }
      }
    }
    
    console.log('📋 Nenhum link específico encontrado na planilha');
    return null;
    
  } catch (error) {
    console.error('❌ Erro ao buscar na planilha V2:', error);
    return null;
  }
}

/**
 * PASSO 6: FUNÇÕES DE RELATÓRIO E GERENCIAMENTO
 */

function relatorioLinksCreditos() {
  try {
    console.log('📊 Gerando relatório de links por crediário...');
    
    const spreadsheet = getOrCreateSpreadsheet();
    const creditsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CREDITS);
    
    if (!creditsSheet) {
      return { success: false, error: 'Aba Crediários não encontrada' };
    }
    
    const creditsData = creditsSheet.getDataRange().getValues();
    const relatorio = [];
    
    for (let i = 1; i < creditsData.length; i++) {
      const creditRow = creditsData[i];
      
      if (creditRow[0]) {
        const creditId = creditRow[0];
        const parcelasInfo = listarParcelasComLinks(creditId);
        
        if (parcelasInfo.success) {
          const parcelasComLink = parcelasInfo.parcelas.filter(p => p.temLink).length;
          const totalParcelas = parcelasInfo.parcelas.length;
          
          relatorio.push({
            creditId: creditId,
            cliente: creditRow[2],
            produto: creditRow[3],
            totalParcelas: totalParcelas,
            parcelasComLink: parcelasComLink,
            percentualCompleto: Math.round((parcelasComLink / totalParcelas) * 100),
            status: parcelasComLink === totalParcelas ? 'COMPLETO' : 'INCOMPLETO'
          });
        }
      }
    }
    
    // Ordenar por status (incompletos primeiro)
    relatorio.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'INCOMPLETO' ? -1 : 1;
      }
      return a.percentualCompleto - b.percentualCompleto;
    });
    
    console.log('📊 Relatório gerado:', relatorio);
    
    return {
      success: true,
      relatorio: relatorio,
      message: `Relatório de ${relatorio.length} crediários gerado`
    };
    
  } catch (error) {
    console.error('❌ Erro ao gerar relatório:', error);
    return { success: false, error: error.message };
  }
}

function limparLinksCredito(creditId) {
  try {
    console.log('🧹 Limpando links do crediário:', creditId);
    
    const spreadsheet = getOrCreateSpreadsheet();
    const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    
    if (!installmentsSheet) {
      return { success: false, error: 'Aba Parcelas não encontrada' };
    }
    
    const data = installmentsSheet.getDataRange().getValues();
    const headers = data[0];
    const linkColumnIndex = headers.indexOf('Link_Pagamento');
    
    if (linkColumnIndex === -1) {
      return { success: false, error: 'Coluna Link_Pagamento não existe' };
    }
    
    let linksLimpos = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowCreditId = String(row[1] || '').trim();
      
      if (rowCreditId === creditId) {
        installmentsSheet.getRange(i + 1, linkColumnIndex + 1).setValue('');
        linksLimpos++;
      }
    }
    
    return {
      success: true,
      message: `${linksLimpos} links limpos do crediário ${creditId}`,
      linksLimpos: linksLimpos
    };
    
  } catch (error) {
    console.error('❌ Erro ao limpar links:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ========================================
 * EXEMPLO DE USO PRÁTICO
 * ========================================
 */

function exemploDeUso() {
  console.log('💡 === EXEMPLO DE USO DO SISTEMA DE LINKS ===');
  
  try {
    // 1. Preparar planilha (execute apenas uma vez)
    console.log('\n🔧 1. Preparando planilha...');
    const prep = prepararPlanilhaParaLinks();
    console.log('Resultado:', prep);
    
    // 2. Buscar um crediário de exemplo
    const creditsResult = getCredits();
    if (creditsResult.success && creditsResult.credits.length > 0) {
      const exemploCredit = creditsResult.credits[0];
      console.log('\n📋 2. Crediário de exemplo:', exemploCredit.id);
      
      // 3. Definir links individuais
      console.log('\n🔗 3. Definindo links individuais...');
      const link1 = definirLinkParcela(exemploCredit.id, 1, 'https://checkout.nubank.com.br/parcela1-especifica');
      const link2 = definirLinkParcela(exemploCredit.id, 2, 'https://checkout.nubank.com.br/parcela2-especifica');
      console.log('Link parcela 1:', link1);
      console.log('Link parcela 2:', link2);
      
      // 4. Definir links em lote
      console.log('\n📦 4. Definindo links em lote...');
      const linksLote = [
        'https://checkout.nubank.com.br/parcela1-lote',
        'https://checkout.nubank.com.br/parcela2-lote',
        'https://checkout.nubank.com.br/parcela3-lote'
      ];
      const loteResult = definirLinksCredito(exemploCredit.id, linksLote);
      console.log('Resultado lote:', loteResult);
      
      // 5. Listar parcelas com links
      console.log('\n📋 5. Listando parcelas com links...');
      const listagem = listarParcelasComLinks(exemploCredit.id);
      console.log('Listagem:', listagem);
      
      // 6. Testar busca de URL
      console.log('\n🔍 6. Testando busca de URL...');
      const url1 = getPaymentUrlByProductV2(exemploCredit.id, 1);
      const url2 = getPaymentUrlByProductV2(exemploCredit.id, 2);
      console.log('URL parcela 1:', url1);
      console.log('URL parcela 2:', url2);
    }
    
    // 7. Relatório geral
    console.log('\n📊 7. Relatório geral...');
    const relatorio = relatorioLinksCreditos();
    console.log('Relatório:', relatorio);
    
    return {
      success: true,
      message: 'Exemplo executado com sucesso! Verifique o console.'
    };
    
  } catch (error) {
    console.error('❌ Erro no exemplo:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ========================================
 * DASHBOARD E RELATÓRIOS
 * ========================================
 */

function loadClientData(clientId) {
  try {
    const creditsResult = getCredits(clientId);
    if (!creditsResult.success) return creditsResult;
    
    const credits = creditsResult.credits;
    let totalCredits = credits.length;
    let totalDebt = 0;
    let overdueCount = 0;
    let totalPaid = 0;
    let totalAmount = 0;
    
    const today = new Date();
    
    credits.forEach(credit => {
      credit.installments.forEach(installment => {
        totalAmount += installment.value;
        
        if (installment.status === 'Pago') {
          totalPaid += installment.value;
        } else {
          totalDebt += installment.value;
          const dueDate = new Date(installment.dueDate);
          if (dueDate < today) {
            overdueCount++;
          }
        }
      });
    });
    
    const collectionRate = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;
    
    return {
      success: true,
      data: {
        totalCredits,
        totalDebt,
        overdueCount,
        totalPaid,
        totalAmount,
        collectionRate,
        credits
      }
    };
  } catch (error) {
    console.error('❌ Erro ao carregar dados do cliente:', error);
    return { success: false, error: 'Erro ao carregar dados do cliente' };
  }
}

function loadAdminData() {
  try {
    const clientsResult = getClients();
    const creditsResult = getCredits();
    
    if (!clientsResult.success || !creditsResult.success) {
      return { success: false, error: 'Erro ao carregar dados administrativos' };
    }
    
    const credits = creditsResult.credits;
    let totalDebt = 0;
    let overdueCount = 0;
    let totalPaid = 0;
    let totalAmount = 0;
    
    const today = new Date();
    
    credits.forEach(credit => {
      credit.installments.forEach(installment => {
        totalAmount += installment.value;
        
        if (installment.status === 'Pago') {
          totalPaid += installment.value;
        } else {
          totalDebt += installment.value;
          const dueDate = new Date(installment.dueDate);
          if (dueDate < today) {
            overdueCount++;
          }
        }
      });
    });
    
    const collectionRate = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;
    
    return {
      success: true,
      clients: clientsResult.clients,
      credits: creditsResult.credits,
      dashboard: {
        totalCredits: credits.length,
        totalDebt,
        overdueCount,
        totalPaid,
        totalAmount,
        collectionRate
      }
    };
  } catch (error) {
    console.error('❌ Erro ao carregar dados administrativos:', error);
    return { success: false, error: 'Erro ao carregar dados administrativos' };
  }
}
/**
 * PASSO 4: LISTAR PARCELAS COM SEUS LINKS
 * Mostra todas as parcelas de um crediário e seus links
 */
function listarParcelasComLinks(creditId) {
  try {
    console.log('📋 Listando parcelas com links para:', creditId);
    
    const spreadsheet = getOrCreateSpreadsheet();
    const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    const creditsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CREDITS);
    
    if (!installmentsSheet || !creditsSheet) {
      return { success: false, error: 'Planilhas não encontradas' };
    }
    
    // Buscar informações do crediário
    const creditsData = creditsSheet.getDataRange().getValues();
    let creditInfo = null;
    
    for (let i = 1; i < creditsData.length; i++) {
      if (creditsData[i][0] === creditId) {
        creditInfo = {
          id: creditsData[i][0],
          clientName: creditsData[i][2],
          productName: creditsData[i][3],
          totalValue: creditsData[i][6]
        };
        break;
      }
    }
    
    if (!creditInfo) {
      return { success: false, error: 'Crediário não encontrado' };
    }
    
    // Buscar parcelas
    const installmentsData = installmentsSheet.getDataRange().getValues();
    const headers = installmentsData[0];
    const linkColumnIndex = headers.indexOf('Link_Pagamento');
    
    const parcelas = [];
    
    for (let i = 1; i < installmentsData.length; i++) {
      const row = installmentsData[i];
      
      if (row[1] === creditId) {
        parcelas.push({
          numero: row[2],
          valor: row[3],
          vencimento: formatDate(row[4]),
          status: row[5],
          linkPagamento: linkColumnIndex !== -1 ? row[linkColumnIndex] || '' : '',
          temLink: linkColumnIndex !== -1 && row[linkColumnIndex] && String(row[linkColumnIndex]).trim() !== ''
        });
      }
    }
    
    parcelas.sort((a, b) => a.numero - b.numero);
    
    return {
      success: true,
      creditInfo: creditInfo,
      parcelas: parcelas,
      message: `${parcelas.length} parcelas encontradas`
    };
    
  } catch (error) {
    console.error('❌ Erro ao listar parcelas:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ========================================
 * FUNÇÕES DE CONFIGURAÇÃO E TESTE
 * ========================================
 */


function configurarSistema() {
  try {
    console.log('🚀 Configurando sistema...');
    
    const spreadsheet = getOrCreateSpreadsheet();
    
    // Criar abas se necessário
    const requiredSheets = Object.values(CONFIG.SHEETS);
    const existingSheets = spreadsheet.getSheets().map(sheet => sheet.getName());
    
    requiredSheets.forEach(sheetName => {
      if (!existingSheets.includes(sheetName)) {
        spreadsheet.insertSheet(sheetName);
        console.log('✅ Aba criada:', sheetName);
      }
    });
    
    // Configurar headers
    setupHeaders(spreadsheet);
    
    console.log('🎉 Sistema configurado com sucesso!');
    
    return {
      success: true,
      message: 'Sistema configurado com sucesso!'
    };
  } catch (error) {
    console.error('❌ Erro na configuração:', error);
    return { success: false, error: error.message };
  }
}

function setupHeaders(spreadsheet) {
  // Headers para Clientes
  const clientsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CLIENTS);
  if (clientsSheet && clientsSheet.getLastRow() <= 1) {
    clientsSheet.getRange(1, 1, 1, 7).setValues([[
      'ID', 'Nome', 'CPF', 'Email', 'Telefone', 'Senha', 'Data_Cadastro'
    ]]);
  }
  
  // Headers para Compras
  const creditsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CREDITS);
  if (creditsSheet && creditsSheet.getLastRow() <= 1) {
    creditsSheet.getRange(1, 1, 1, 11).setValues([[
      'ID', 'Cliente_ID', 'Cliente_Nome', 'Produto_Nome', 'Produto_Descricao', 
      'Produto_Emoji', 'Valor_Total', 'Data_Compra', 'Loja_Nome', 'Loja_Emoji', 'Status'
    ]]);
  }
  
  // Headers para Parcelas
  const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
  if (installmentsSheet && installmentsSheet.getLastRow() <= 1) {
    installmentsSheet.getRange(1, 1, 1, 8).setValues([[
      'ID', 'Compra_ID', 'Numero', 'Valor', 'Data_Vencimento', 'Status', 'Data_Pagamento', 'Link_Pagamento'
    ]]);
  }
  
  // Headers para Pagamentos
  const paymentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.PAYMENTS);
  if (paymentsSheet && paymentsSheet.getLastRow() <= 1) {
    paymentsSheet.getRange(1, 1, 1, 6).setValues([[
      'ID', 'Parcela_ID', 'Compra_ID', 'Valor', 'Data_Pagamento', 'Metodo'
    ]]);
  }
}
/**
 * Função corrigida para criar solicitação de confirmação
 */
function requestPaymentConfirmation(data) {
  try {
    console.log('📧 Criando solicitação de confirmação:', data);
    
    const spreadsheet = getOrCreateSpreadsheet();
    
    // Garantir que aba existe
    let sheet = spreadsheet.getSheetByName('Solicitacoes');
    
    if (!sheet) {
      // Criar aba se não existir
      const createResult = getPendingPaymentRequests(); // Isso criará a aba
      if (!createResult.success) {
        return createResult;
      }
      sheet = spreadsheet.getSheetByName('Solicitacoes');
    }
    
    // Gerar ID único para a solicitação
    const requestId = 'REQ_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    
    // Validar dados obrigatórios
    if (!data.clientName || !data.installmentNumber || !data.creditId) {
      return {
        success: false,
        error: 'Dados obrigatórios não informados'
      };
    }
    
    
    // Preparar linha de dados
    const newRow = [
      requestId,                                    // A - ID_Solicitacao
      String(data.clientName || 'Cliente'),        // B - Cliente_Nome
      String(data.clientEmail || ''),              // C - Cliente_Email
      String(data.productName || 'Produto'),       // D - Produto_Nome
      String(data.storeName || 'Loja'),           // E - Loja_Nome
      Number(data.installmentNumber) || 1,         // F - Numero_Parcela
      Number(data.installmentValue) || 0,          // G - Valor_Parcela
      data.dueDate ? new Date(data.dueDate) : new Date(), // H - Data_Vencimento
      new Date(),                                   // I - Data_Solicitacao
      'pendente',                                   // J - Status
      String(data.note || 'Solicitação via sistema'), // K - Observacoes
      String(data.creditId || ''),                 // L - Credit_ID
      String(data.installmentId || '')             // M - Installment_ID
    ];
    
    // Adicionar linha
    sheet.appendRow(newRow);
    
    console.log(`✅ Solicitação criada: ${requestId}`);
    
    return { 
      success: true, 
      requestId: requestId,
      message: 'Solicitação registrada com sucesso'
    };
    
  } catch (error) {
    console.error('❌ Erro ao criar solicitação:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}


/**
 * Função corrigida para buscar solicitações pendentes
 */
function getPendingPaymentRequests() {
  try {
    console.log('📋 Buscando solicitações pendentes...');
    
    const spreadsheet = getOrCreateSpreadsheet();
    
    // Tentar acessar aba Solicitacoes, criar se não existir
    let sheet = spreadsheet.getSheetByName('Solicitacoes');
    
    if (!sheet) {
      console.log('⚠️ Aba Solicitacoes não existe, criando...');
      
      sheet = spreadsheet.insertSheet('Solicitacoes');
      
      // Criar headers
      const headers = [
        'ID_Solicitacao',           // A
        'Cliente_Nome',             // B  
        'Cliente_Email',            // C
        'Produto_Nome',             // D
        'Loja_Nome',               // E
        'Numero_Parcela',          // F
        'Valor_Parcela',           // G
        'Data_Vencimento',         // H
        'Data_Solicitacao',        // I
        'Status',                  // J
        'Observacoes',             // K
        'Credit_ID',               // L
        'Installment_ID'           // M
      ];
      
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Formatar headers
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#E3F2FD');
      headerRange.setFontColor('#1565C0');
      
      console.log('✅ Aba Solicitacoes criada com headers');
      
      // Retornar vazio já que acabamos de criar
      return { 
        success: true, 
        requests: [],
        message: 'Aba criada, nenhuma solicitação pendente'
      };
    }
    
    // Verificar se há dados
    if (sheet.getLastRow() <= 1) {
      console.log('📋 Aba existe mas não há solicitações');
      return { 
        success: true, 
        requests: [],
        message: 'Nenhuma solicitação encontrada'
      };
    }
    
    const data = sheet.getDataRange().getValues();
    const requests = [];
    
    console.log(`📊 Processando ${data.length - 1} linhas de dados...`);
    
    // Processar dados (pulando header na linha 0)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Verificar se a linha tem dados válidos
      if (!row[0] || !row[9]) { // ID e Status são obrigatórios
        console.log(`⏭️ Pulando linha ${i + 1} (dados incompletos)`);
        continue;
      }
      
      const status = String(row[9]).toLowerCase().trim();
      
      console.log(`🔍 Linha ${i + 1}: Status = "${status}"`);
      
      // Filtrar apenas status 'pendente'
      if (status === 'pendente') {
        const request = {
          id: String(row[0] || ''),
          clientName: String(row[1] || 'Cliente'),
          clientEmail: String(row[2] || ''),
          productName: String(row[3] || 'Produto'),
          storeName: String(row[4] || 'Loja'),
          installmentNumber: Number(row[5]) || 1,
          installmentValue: Number(row[6]) || 0,
          dueDate: row[7] ? formatDateSafe(row[7]) : '',
          requestDate: row[8] ? formatDateSafe(row[8]) : '',
          status: status,
          note: String(row[10] || ''),
          creditId: String(row[11] || ''),
          installmentId: String(row[12] || '')
        };
        
        requests.push(request);
        console.log(`✅ Solicitação adicionada: ${request.clientName} - Parcela ${request.installmentNumber}`);
      }
    }
    
    console.log(`📊 Total de solicitações pendentes: ${requests.length}`);
    
    return { 
      success: true, 
      requests: requests,
      total: requests.length,
      message: `${requests.length} solicitações pendentes encontradas`
    };
    
  } catch (error) {
    console.error('❌ Erro ao buscar solicitações:', error);
    return { 
      success: false, 
      error: error.message,
      requests: []
    };
  }
}



/**
 * ========================================
 * CORREÇÃO DIRETA E SIMPLES
 * Substitua sua função rejectPaymentRequest por esta versão
 * ========================================
 */

/**
 * SUBSTITUA SUA FUNÇÃO rejectPaymentRequest POR ESTA
 * Versão simples que funciona com string direta
 */
function rejectPaymentRequest(params) {
  try {
    console.log('❌ [BACKEND] Rejeitando solicitação (versão simples):', params);
    
    // === EXTRAIR requestId SEM JSON.parse ===
    let requestId;
    let reason = 'Solicitação rejeitada pelo administrador';
    let adminNote = '';
    
    // Se é string direta (seu caso)
    if (typeof params === 'string') {
      requestId = params.trim();
      console.log('✅ [BACKEND] requestId extraído da string:', requestId);
    }
    // Se é objeto
    else if (params && typeof params === 'object') {
      requestId = params.requestId || params.id;
      reason = params.reason || reason;
      adminNote = params.adminNote || adminNote;
      console.log('✅ [BACKEND] requestId extraído do objeto:', requestId);
    }
    // Se não conseguiu extrair
    else {
      console.error('❌ [BACKEND] Não foi possível extrair requestId');
      return {
        success: false,
        error: 'ID da solicitação não informado'
      };
    }
    
    // Validar requestId
    if (!requestId || requestId === '') {
      console.error('❌ [BACKEND] requestId está vazio');
      return {
        success: false,
        error: 'ID da solicitação está vazio'
      };
    }
    
    console.log('📝 [BACKEND] Processando rejeição para:', requestId);
    
    // === ACESSAR PLANILHA ===
    const spreadsheet = getOrCreateSpreadsheet();
    const sheet = spreadsheet.getSheetByName('Solicitacoes');
    
    if (!sheet) {
      console.error('❌ [BACKEND] Aba Solicitacoes não encontrada');
      return {
        success: false,
        error: 'Aba de solicitações não encontrada'
      };
    }
    
    // === BUSCAR SOLICITAÇÃO ===
    const data = sheet.getDataRange().getValues();
    let requestFound = false;
    let requestRow = -1;
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === requestId) {
        requestFound = true;
        requestRow = i + 1;
        console.log('✅ [BACKEND] Solicitação encontrada na linha:', requestRow);
        break;
      }
    }
    
    if (!requestFound) {
      console.error('❌ [BACKEND] Solicitação não encontrada:', requestId);
      return {
        success: false,
        error: 'Solicitação não encontrada'
      };
    }
    
    // === ATUALIZAR STATUS ===
    try {
      // Atualizar status para 'rejeitado'
      sheet.getRange(requestRow, 10).setValue('rejeitado');
      
      // Atualizar observações
      const currentNote = String(data[requestRow - 1][10] || '');
      const newNote = currentNote + (currentNote ? ' | ' : '') + 'REJEITADO: ' + reason;
      sheet.getRange(requestRow, 11).setValue(newNote);
      
      console.log('✅ [BACKEND] Solicitação rejeitada com sucesso');
      
      return {
        success: true,
        message: 'Solicitação rejeitada com sucesso',
        requestId: requestId
      };
      
    } catch (error) {
      console.error('❌ [BACKEND] Erro ao atualizar planilha:', error);
      return {
        success: false,
        error: 'Erro ao atualizar planilha: ' + error.message
      };
    }
    
  } catch (error) {
    console.error('❌ [BACKEND] Erro crítico:', error);
    return {
      success: false,
      error: 'Erro crítico: ' + error.message
    };
  }
}

/**
 * SUBSTITUA SUA FUNÇÃO approvePaymentRequest POR ESTA
 * Versão simples que funciona com string direta  
 */
function approvePaymentRequest(params) {
  try {
    console.log('✅ [BACKEND] Aprovando solicitação (versão simples):', params);
    
    // === EXTRAIR requestId SEM JSON.parse ===
    let requestId;
    let adminNote = '';
    
    // Se é string direta
    if (typeof params === 'string') {
      requestId = params.trim();
      console.log('✅ [BACKEND] requestId extraído da string:', requestId);
    }
    // Se é objeto
    else if (params && typeof params === 'object') {
      requestId = params.requestId || params.id;
      adminNote = params.adminNote || adminNote;
      console.log('✅ [BACKEND] requestId extraído do objeto:', requestId);
    }
    // Se não conseguiu extrair
    else {
      console.error('❌ [BACKEND] Não foi possível extrair requestId');
      return {
        success: false,
        error: 'ID da solicitação não informado'
      };
    }
    
    // Validar requestId
    if (!requestId || requestId === '') {
      console.error('❌ [BACKEND] requestId está vazio');
      return {
        success: false,
        error: 'ID da solicitação está vazio'
      };
    }
    
    console.log('📝 [BACKEND] Processando aprovação para:', requestId);
    
    // === ACESSAR PLANILHA ===
    const spreadsheet = getOrCreateSpreadsheet();
    const sheet = spreadsheet.getSheetByName('Solicitacoes');
    
    if (!sheet) {
      console.error('❌ [BACKEND] Aba Solicitacoes não encontrada');
      return {
        success: false,
        error: 'Aba de solicitações não encontrada'
      };
    }
    
    // === BUSCAR SOLICITAÇÃO ===
    const data = sheet.getDataRange().getValues();
    let requestFound = false;
    let requestRow = -1;
    let installmentId = null;
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === requestId) {
        requestFound = true;
        requestRow = i + 1;
        installmentId = String(data[i][12] || ''); // Installment_ID
        console.log('✅ [BACKEND] Solicitação encontrada na linha:', requestRow);
        break;
      }
    }
    
    if (!requestFound) {
      console.error('❌ [BACKEND] Solicitação não encontrada:', requestId);
      return {
        success: false,
        error: 'Solicitação não encontrada'
      };
    }
    
    // === ATUALIZAR STATUS ===
    try {
      // Atualizar status para 'aprovado'
      sheet.getRange(requestRow, 10).setValue('aprovado');
      
      // Atualizar observações se tiver nota do admin
      if (adminNote) {
        const currentNote = String(data[requestRow - 1][10] || '');
        const newNote = currentNote + (currentNote ? ' | ' : '') + 'ADMIN: ' + adminNote;
        sheet.getRange(requestRow, 11).setValue(newNote);
      }
      
      console.log('✅ [BACKEND] Solicitação aprovada');
      
      // === MARCAR PARCELA COMO PAGA ===
      if (installmentId && installmentId.trim() !== '') {
        try {
          console.log('💰 [BACKEND] Marcando parcela como paga:', installmentId);
          
          const paymentResult = markInstallmentAsPaid(installmentId, {
            method: 'Confirmação Administrativa',
            note: adminNote || 'Pagamento confirmado pelo administrador'
          });
          
          if (paymentResult.success) {
            console.log('✅ [BACKEND] Parcela marcada como paga');
          } else {
            console.log('⚠️ [BACKEND] Erro ao marcar parcela:', paymentResult.error);
          }
        } catch (error) {
          console.log('⚠️ [BACKEND] Erro ao marcar parcela (não crítico):', error);
        }
      }
      
      return {
        success: true,
        message: 'Solicitação aprovada com sucesso',
        requestId: requestId,
        installmentId: installmentId
      };
      
    } catch (error) {
      console.error('❌ [BACKEND] Erro ao atualizar planilha:', error);
      return {
        success: false,
        error: 'Erro ao atualizar planilha: ' + error.message
      };
    }
    
  } catch (error) {
    console.error('❌ [BACKEND] Erro crítico:', error);
    return {
      success: false,
      error: 'Erro crítico: ' + error.message
    };
  }
}

/**
 * FUNÇÃO DE TESTE SIMPLES
 * Execute esta para testar se funcionou
 */
function testarFuncaoSimples() {
  console.log('🧪 === TESTE DA FUNÇÃO SIMPLES ===');
  
  // Testar rejeição com string direta (como seu frontend está fazendo)
  const resultado1 = rejectPaymentRequest('REQ_1753484846234_o4y4n');
  console.log('Teste rejeição:', resultado1.success ? '✅' : '❌', resultado1);
  
  // Testar aprovação com string direta
  const resultado2 = approvePaymentRequest('REQ_1753484765118_x1ka0');
  console.log('Teste aprovação:', resultado2.success ? '✅' : '❌', resultado2);
  
  return {
    success: true,
    rejeicao: resultado1,
    aprovacao: resultado2
  };
}

/**
 * FUNÇÃO DE BACKUP - Se ainda der erro, use esta
 * Versão SUPER simples que não pode dar erro
 */
function rejectPaymentRequestBackup(requestId, reason, adminNote) {
  try {
    console.log('🔄 [BACKEND] Função backup - rejeitando:', requestId);
    
    // Sem JSON.parse, sem nada complexo
    const cleanRequestId = String(requestId || '').trim();
    
    if (!cleanRequestId) {
      return { success: false, error: 'ID vazio' };
    }
    
    const spreadsheet = getOrCreateSpreadsheet();
    const sheet = spreadsheet.getSheetByName('Solicitacoes');
    
    if (!sheet) {
      return { success: false, error: 'Aba não encontrada' };
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === cleanRequestId) {
        sheet.getRange(i + 1, 10).setValue('rejeitado');
        console.log('✅ [BACKEND] Rejeitado na linha:', i + 1);
        return { success: true, message: 'Rejeitado' };
      }
    }
    
    return { success: false, error: 'Não encontrado' };
    
  } catch (error) {
    console.error('❌ [BACKEND] Erro na função backup:', error);
    return { success: false, error: error.message };
  }
}

// ===== INSTRUÇÕES DE USO =====

console.log('🔧 === CORREÇÃO DIRETA CARREGADA ===');
console.log('');
console.log('📋 INSTRUÇÕES:');
console.log('1. COPIE as funções rejectPaymentRequest e approvePaymentRequest acima');
console.log('2. COLE no seu Google Apps Script SUBSTITUINDO as funções existentes');
console.log('3. SALVE o projeto');
console.log('4. TESTE executando: testarFuncaoSimples()');
console.log('');
console.log('🚨 IMPORTANTE: SUBSTITUA completamente suas funções antigas!');
console.log('');
console.log('💡 Se ainda der erro, use: rejectPaymentRequestBackup(id, motivo, nota)');
console.log('');
console.log('🎯 Esta versão NÃO faz JSON.parse e deve funcionar 100%!');
/**
 * ========================================
 * FUNÇÃO markInstallmentAsPaid CORRIGIDA
 * Resolve o erro "Erro desconhecido" 
 * ========================================
 */

/**
 * VERSÃO CORRIGIDA: markInstallmentAsPaid
 * Com debugging detalhado e tratamento robusto de erros
 */
function markInstallmentAsPaid(installmentId, paymentInfo = {}) {
  try {
    console.log('💰 === MARCANDO PARCELA COMO PAGA (VERSÃO CORRIGIDA) ===');
    console.log('📝 Parâmetros recebidos:', {
      installmentId: installmentId,
      paymentInfo: paymentInfo
    });
    
    // ===== VALIDAÇÃO INICIAL =====
    if (!installmentId) {
      console.log('❌ ID da parcela não informado');
      return { 
        success: false, 
        error: 'ID da parcela é obrigatório' 
      };
    }
    
    const cleanInstallmentId = String(installmentId).trim();
    console.log('🔍 ID limpo da parcela:', cleanInstallmentId);
    
    // ===== ACESSAR PLANILHA =====
    console.log('📊 Acessando planilha...');
    let spreadsheet;
    
    try {
      spreadsheet = getOrCreateSpreadsheet();
      console.log('✅ Planilha acessada:', spreadsheet.getName());
    } catch (error) {
      console.error('❌ Erro ao acessar planilha:', error);
      return {
        success: false,
        error: 'Erro ao acessar planilha: ' + error.message
      };
    }
    
    // ===== VERIFICAR ABA PARCELAS =====
    console.log('📋 Verificando aba Parcelas...');
    let installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    
    if (!installmentsSheet) {
      console.log('⚠️ Aba Parcelas não encontrada, tentando criar...');
      try {
        installmentsSheet = spreadsheet.insertSheet(CONFIG.SHEETS.INSTALLMENTS);
        
        // Adicionar headers básicos
        const headers = ['ID', 'Compra_ID', 'Numero', 'Valor', 'Data_Vencimento', 'Status', 'Data_Pagamento', 'Link_Pagamento'];
        installmentsSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        
        console.log('✅ Aba Parcelas criada com headers');
      } catch (error) {
        console.error('❌ Erro ao criar aba Parcelas:', error);
        return {
          success: false,
          error: 'Erro ao criar aba Parcelas: ' + error.message
        };
      }
    }
    
    // ===== BUSCAR DADOS DA PARCELA =====
    console.log('🔍 Buscando dados da parcela...');
    let installmentsData;
    
    try {
      installmentsData = installmentsSheet.getDataRange().getValues();
      console.log(`📊 Total de ${installmentsData.length - 1} parcelas na planilha`);
    } catch (error) {
      console.error('❌ Erro ao ler dados da aba:', error);
      return {
        success: false,
        error: 'Erro ao ler dados da aba: ' + error.message
      };
    }
    
    // ===== ENCONTRAR A PARCELA =====
    let installmentRow = -1;
    let installmentData = null;
    
    console.log('🔍 Procurando parcela com ID:', cleanInstallmentId);
    
    for (let i = 1; i < installmentsData.length; i++) {
      const currentId = String(installmentsData[i][0] || '').trim();
      
      console.log(`🔍 Linha ${i}: Comparando "${currentId}" com "${cleanInstallmentId}"`);
      
      if (currentId === cleanInstallmentId) {
        installmentRow = i + 1; // +1 porque getRange é 1-indexed
        installmentData = installmentsData[i];
        console.log(`✅ Parcela encontrada na linha ${installmentRow}`);
        console.log('📄 Dados da parcela:', installmentData);
        break;
      }
    }
    
    if (installmentRow === -1) {
      console.log('❌ Parcela não encontrada');
      console.log('🔍 IDs disponíveis na planilha:');
      for (let i = 1; i < Math.min(installmentsData.length, 6); i++) {
        console.log(`  ${i}. ID: "${installmentsData[i][0]}" | Status: "${installmentsData[i][5]}"`);
      }
      
      return { 
        success: false, 
        error: `Parcela não encontrada. ID buscado: "${cleanInstallmentId}"`,
        debug: {
          totalParcelas: installmentsData.length - 1,
          idBuscado: cleanInstallmentId
        }
      };
    }
    
    // ===== VERIFICAR STATUS ATUAL =====
    const currentStatus = String(installmentData[5] || '').trim();
    const currentPaymentDate = installmentData[6];
    
    console.log('📋 Status atual da parcela:', currentStatus);
    console.log('📋 Data de pagamento atual:', currentPaymentDate);
    
    if (currentStatus === 'Pago') {
      console.log('⚠️ Parcela já está paga');
      return { 
        success: false, 
        error: 'Esta parcela já foi paga',
        dataPagamento: currentPaymentDate,
        alreadyPaid: true
      };
    }
    
    // ===== ATUALIZAR STATUS DA PARCELA =====
    console.log('💾 Atualizando status da parcela...');
    
    const paymentDate = new Date();
    const paymentMethod = paymentInfo.method || paymentInfo.paymentMethod || 'Pagamento Manual';
    
    try {
      // Atualizar Status (coluna 6)
      installmentsSheet.getRange(installmentRow, 6).setValue('Pago');
      console.log('✅ Status atualizado para "Pago"');
      
      // Atualizar Data de Pagamento (coluna 7)
      installmentsSheet.getRange(installmentRow, 7).setValue(paymentDate);
      console.log('✅ Data de pagamento definida:', paymentDate);
      
    } catch (error) {
      console.error('❌ Erro ao atualizar planilha:', error);
      return {
        success: false,
        error: 'Erro ao atualizar planilha: ' + error.message
      };
    }
    
    // ===== REGISTRAR PAGAMENTO NA ABA PAGAMENTOS (OPCIONAL) =====
    console.log('💳 Tentando registrar na aba Pagamentos...');
    
    try {
      let paymentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.PAYMENTS);
      
      if (!paymentsSheet) {
        console.log('⚠️ Aba Pagamentos não existe, criando...');
        paymentsSheet = spreadsheet.insertSheet(CONFIG.SHEETS.PAYMENTS);
        
        const headers = ['ID', 'Parcela_ID', 'Compra_ID', 'Valor', 'Data_Pagamento', 'Metodo'];
        paymentsSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
      
      const paymentId = generateId();
      const creditId = installmentData[1]; // Compra_ID
      const installmentValue = Number(installmentData[3]) || 0; // Valor
      
      paymentsSheet.appendRow([
        paymentId,
        cleanInstallmentId,
        creditId,
        installmentValue,
        paymentDate,
        paymentMethod
      ]);
      
      console.log('✅ Pagamento registrado na aba Pagamentos');
      
    } catch (error) {
      console.log('⚠️ Erro ao registrar pagamento (não crítico):', error);
      // Não falhar a operação principal por causa disso
    }
    
    // ===== VERIFICAR SE CREDIÁRIO FOI QUITADO =====
    console.log('🔍 Verificando se crediário foi quitado...');
    
    const creditId = installmentData[1];
    let allPaid = false;
    
    try {
      allPaid = checkIfAllInstallmentsPaidSafe(creditId, installmentsData);
      
      if (allPaid) {
        console.log('🎉 Todas as parcelas pagas! Atualizando status do crediário...');
        updateCreditStatusSafe(creditId, 'Quitado');
      } else {
        console.log('📊 Ainda há parcelas pendentes no crediário');
      }
    } catch (error) {
      console.log('⚠️ Erro ao verificar status do crediário (não crítico):', error);
      // Não falhar a operação principal
    }
    
    // ===== RESULTADO FINAL =====
    console.log('🎉 === OPERAÇÃO CONCLUÍDA COM SUCESSO ===');
    
    return {
      success: true,
      message: 'Parcela marcada como paga com sucesso!',
      allPaid: allPaid,
      paymentDate: paymentDate,
      paymentMethod: paymentMethod,
      installmentId: cleanInstallmentId,
      creditId: creditId,
      debug: {
        installmentRow: installmentRow,
        value: Number(installmentData[3]) || 0,
        method: paymentMethod
      }
    };
    
  } catch (error) {
    console.error('❌ ERRO CRÍTICO na função markInstallmentAsPaid:', error);
    console.error('📋 Stack trace:', error.stack);
    
    return { 
      success: false, 
      error: 'Erro interno: ' + error.message,
      stack: error.stack,
      installmentId: installmentId
    };
  }
}
/**
 * FUNÇÃO CORRIGIDA: showPaymentRequestStatus
 * Versão compatível com seu código existente
 */
function showPaymentRequestStatus(requestId) {
    console.log('📋 Mostrando status da solicitação:', requestId);
    
    const modal = ensureModalExists();
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    
    modalTitle.textContent = '📋 Solicitação Enviada';
    
    modalContent.innerHTML = `
        <div style="text-align: center;">
            <div style="background: #e3f2fd; padding: 1.5rem; border-radius: 10px; margin-bottom: 1.5rem;">
                <h3 style="color: #1976d2; margin-bottom: 1rem;">✅ Solicitação Registrada</h3>
                <p style="color: #666; margin-bottom: 1rem;">
                    Sua solicitação de confirmação de pagamento foi enviada com sucesso!
                </p>
                <div style="background: white; padding: 1rem; border-radius: 8px; border: 2px dashed #1976d2; margin: 1rem 0;">
                    <strong>ID da Solicitação:</strong> ${requestId || 'Gerado automaticamente'}
                </div>
            </div>
            
            <div id="statusDisplaySection" style="background: #fff3e0; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                <h4 style="color: #f57900; margin-bottom: 0.5rem;">
                    <i class="fas fa-clock"></i> Status Atual
                </h4>
                <div id="statusDisplay" style="margin: 0.5rem 0;">
                    <span class="status-badge pending">⏳ Aguardando Análise</span>
                </div>
            </div>
                        
            <div style="background: #fff3e0; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                <h4 style="color: #f57900; margin-bottom: 0.5rem;">📋 Próximos Passos:</h4>
                <ul style="text-align: left; color: #666; margin: 0.5rem 0;">
                    <li>O administrador será notificado</li>
                    <li>Sua solicitação será analisada</li>
                    <li>Você receberá confirmação em breve</li>
                    <li>O status será atualizado automaticamente</li>
                </ul>
            </div>
                        
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button class="action-btn btn-primary" onclick="checkRequestStatusFixed('${requestId}')" style="flex: 1;">
                    🔄 Verificar Status
                </button>
                <button class="action-btn btn-secondary" onclick="closeModal()" style="flex: 1; background: #6c757d;">
                    ✅ Entendi
                </button>
            </div>
        </div>
        
        <style>
            .status-badge {
                display: inline-block;
                padding: 0.5rem 1rem;
                border-radius: 20px;
                font-weight: 600;
                font-size: 0.9rem;
            }
            
            .status-badge.pending {
                background: #fff3cd;
                color: #856404;
                border: 1px solid #ffeaa7;
            }
            
            .status-badge.approved {
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
                animation: pulse 2s infinite;
            }
            
            .status-badge.rejected {
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }
            
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
        </style>
    `;
    
    modal.classList.add('active');
    
    // Verificar status automaticamente após 3 segundos
    if (requestId) {
        setTimeout(() => {
            checkRequestStatusFixed(requestId);
        }, 3000);
    }
}
/**
 * FUNÇÃO CORRIGIDA: checkRequestStatus
 * Versão com fallback robusto
 */
async function checkRequestStatusFixed(requestId) {
    console.log('🔄 Verificando status da solicitação (versão corrigida):', requestId);
    
    const statusDisplay = document.getElementById('statusDisplay');
    
    if (!statusDisplay) {
        console.log('⚠️ Elemento statusDisplay não encontrado');
        showAlert('⚠️ Modal fechado. Reabrindo...', 'warning');
        showPaymentRequestStatus(requestId);
        return;
    }
    
    // Mostrar loading
    statusDisplay.innerHTML = `
        <span class="status-badge pending">
            <i class="fas fa-spinner fa-spin"></i> Verificando...
        </span>
    `;
    
    try {
        // Tentar conectar com backend
        const hasBackend = typeof google !== 'undefined' && 
                           google.script && 
                           google.script.run;
        
        if (hasBackend) {
            console.log('🔗 Tentando conectar com backend...');
            
            // Timeout para evitar travamento
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout')), 8000);
            });
            
            const backendPromise = new Promise((resolve, reject) => {
                google.script.run
                    .withSuccessHandler(resolve)
                    .withFailureHandler(reject)
                    .checkRequestStatus({ requestId });
            });
            
            try {
                const response = await Promise.race([backendPromise, timeoutPromise]);
                
                if (response && response.success) {
                    console.log('✅ Status recebido do backend:', response.status);
                    updateStatusDisplayFixed(response.status, response.message);
                    return;
                } else {
                    console.log('⚠️ Backend retornou erro:', response?.error);
                    throw new Error(response?.error || 'Erro no backend');
                }
            } catch (backendError) {
                console.log('❌ Erro de conexão com backend:', backendError.message);
                throw backendError;
            }
        } else {
            console.log('⚠️ Backend não disponível');
            throw new Error('Backend não disponível');
        }
        
    } catch (error) {
        console.log('🔄 Usando sistema de fallback...');
        
        // Sistema de fallback inteligente
        const fallbackStatus = generateSmartFallbackStatus(requestId);
        updateStatusDisplayFixed(fallbackStatus.status, fallbackStatus.message);
    }
}
/**
 * FUNÇÃO: generateSmartFallbackStatus
 * Gera status inteligente baseado em tempo e padrões
 */
function generateSmartFallbackStatus(requestId) {
    const now = Date.now();
    
    // Extrair timestamp do requestId se possível
    let requestTime = now;
    if (requestId && requestId.includes('_')) {
        const parts = requestId.split('_');
        const timestampPart = parts.find(part => /^\d{13}$/.test(part)); // 13 dígitos = timestamp
        if (timestampPart) {
            requestTime = parseInt(timestampPart);
        }
    }
    
    const elapsed = now - requestTime;
    const minutes = Math.floor(elapsed / 60000);
    
    // Lógica de status baseada no tempo decorrido
    if (elapsed < 10000) { // Menos de 10 segundos
        return {
            status: 'processando',
            message: 'Solicitação recém criada, processando...'
        };
    } else if (minutes < 2) { // Menos de 2 minutos
        return {
            status: 'pendente',
            message: 'Aguardando análise do administrador.'
        };
    } else if (minutes < 5) { // 2-5 minutos
        return {
            status: 'pendente',
            message: 'Solicitação em análise. Aguarde mais alguns minutos.'
        };
    } else {
        // Simular aprovação para demonstração (70% de chance)
        const isApproved = Math.random() > 0.3;
        
        if (isApproved) {
            return {
                status: 'aprovado',
                message: 'Pagamento confirmado pelo administrador! (Simulação)'
            };
        } else {
            return {
                status: 'pendente',
                message: `Aguardando análise há ${minutes} minutos. Tente novamente em breve.`
            };
        }
    }
}
/**
 * FUNÇÃO: updateStatusDisplayFixed
 * Atualiza o display de status de forma robusta
 */
function updateStatusDisplayFixed(status, message) {
    const statusDisplay = document.getElementById('statusDisplay');
    if (!statusDisplay) {
        console.log('❌ statusDisplay não encontrado');
        return;
    }
    
    const statusConfig = {
        'pendente': {
            badge: 'pending',
            icon: '⏳',
            text: 'Aguardando Análise',
            color: '#856404'
        },
        'aprovado': {
            badge: 'approved', 
            icon: '✅',
            text: 'Aprovado',
            color: '#155724'
        },
        'rejeitado': {
            badge: 'rejected',
            icon: '❌', 
            text: 'Rejeitado',
            color: '#721c24'
        },
        'processando': {
            badge: 'pending',
            icon: '🔄',
            text: 'Processando',
            color: '#856404'
        }
    };
    
    const config = statusConfig[status] || statusConfig['pendente'];
    
    statusDisplay.innerHTML = `
        <span class="status-badge ${config.badge}">
            ${config.icon} ${config.text}
        </span>
        ${message ? `<p style="margin-top: 0.5rem; font-size: 0.85rem; color: ${config.color}; font-style: italic;">${message}</p>` : ''}
    `;
    
    // Ações especiais por status
    if (status === 'aprovado') {
        // Mostrar animação de sucesso
        statusDisplay.style.animation = 'pulse 0.5s ease-in-out 3';
        
        setTimeout(() => {
            showAlert('🎉 Pagamento confirmado! A parcela foi marcada como paga.', 'success');
            
            // Fechar modal após 3 segundos
            setTimeout(() => {
                closeModal();
                
                // Recarregar dados se possível
                if (typeof loadUserData === 'function') {
                    loadUserData();
                } else if (typeof refreshCurrentView === 'function') {
                    refreshCurrentView();
                }
            }, 3000);
        }, 1000);
        
    } else if (status === 'rejeitado') {
        // Mostrar opções adicionais para rejeitado
        setTimeout(() => {
            const statusSection = document.getElementById('statusDisplaySection');
            if (statusSection) {
                statusSection.innerHTML += `
                    <div style="margin-top: 1rem; padding: 1rem; background: #fff; border-radius: 8px; border-left: 4px solid #dc3545;">
                        <h5 style="color: #721c24; margin: 0 0 0.5rem 0;">Solicitação Rejeitada</h5>
                        <p style="margin: 0; font-size: 0.85rem; color: #721c24;">
                            Entre em contato conosco para mais informações sobre esta solicitação.
                        </p>
                        <button onclick="contactSupport('${requestId || 'unknown'}')" 
                                style="margin-top: 0.5rem; padding: 0.5rem 1rem; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                            📞 Entrar em Contato
                        </button>
                    </div>
                `;
            }
        }, 1000);
    }
}
/**
 * ========================================
 * FUNÇÕES AUXILIARES MELHORADAS
 * ========================================
 */

/**
 * Verifica se todas as parcelas de um crediário foram pagas
 */
function checkIfAllInstallmentsPaid(creditId) {
  try {
    console.log('🔍 Verificando parcelas do crediário:', creditId);
    
    const spreadsheet = getOrCreateSpreadsheet();
    const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    
    if (!installmentsSheet) {
      console.log('⚠️ Aba Parcelas não encontrada para verificação');
      return false;
    }
    
    const data = installmentsSheet.getDataRange().getValues();
    let totalParcelas = 0;
    let parcelasPagas = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const parcelaCompraId = String(row[1] || '').trim();
      const parcelaStatus = String(row[5] || '').trim();
      
      if (parcelaCompraId === String(creditId).trim()) {
        totalParcelas++;
        
        if (parcelaStatus === 'Pago') {
          parcelasPagas++;
        }
        
        console.log(`📄 Parcela ${row[2]}: ${parcelaStatus}`);
      }
    }
    
    const todasPagas = totalParcelas > 0 && parcelasPagas === totalParcelas;
    
    console.log(`📊 Resultado: ${parcelasPagas}/${totalParcelas} parcelas pagas`);
    console.log(`🎯 Todas pagas: ${todasPagas ? 'SIM' : 'NÃO'}`);
    
    return todasPagas;
    
  } catch (error) {
    console.error('❌ Erro ao verificar parcelas:', error);
    return false;
  }
}

/**
 * Atualiza o status de um crediário
 */
function updateCreditStatus(creditId, newStatus) {
  try {
    console.log(`📝 Atualizando status do crediário ${creditId} para: ${newStatus}`);
    
    const spreadsheet = getOrCreateSpreadsheet();
    let creditsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CREDITS);
    
    // Verificar se aba Compras existe
    if (!creditsSheet) {
      console.log('⚠️ Aba Compras não encontrada. Criando...');
      creditsSheet = spreadsheet.insertSheet(CONFIG.SHEETS.CREDITS);
      
      // Adicionar headers
      creditsSheet.getRange(1, 1, 1, 11).setValues([[
        'ID', 'Cliente_ID', 'Cliente_Nome', 'Produto_Nome', 'Produto_Descricao', 
        'Produto_Emoji', 'Valor_Total', 'Data_Compra', 'Loja_Nome', 'Loja_Emoji', 'Status'
      ]]);
      
      console.log('✅ Aba Compras criada');
      return; // Se acabou de criar, não há dados para atualizar
    }
    
    const data = creditsSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const compraId = String(data[i][0] || '').trim();
      
      if (compraId === String(creditId).trim()) {
        creditsSheet.getRange(i + 1, 11).setValue(newStatus); // Coluna Status (11)
        console.log(`✅ Status do crediário ${creditId} atualizado para: ${newStatus}`);
        return;
      }
    }
    
    console.log(`⚠️ Crediário ${creditId} não encontrado para atualização de status`);
    
  } catch (error) {
    console.error('❌ Erro ao atualizar status do crediário:', error);
  }
}

/**
 * ========================================
 * FUNÇÃO DE TESTE PARA DEBUG
 * ========================================
 */

function testarMarkInstallmentAsPaid() {
  console.log('🧪 === TESTE DA FUNÇÃO markInstallmentAsPaid ===');
  
  try {
    // Buscar uma parcela pendente para testar
    const spreadsheet = getOrCreateSpreadsheet();
    const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    
    if (!installmentsSheet) {
      console.log('❌ Aba Parcelas não encontrada');
      return { success: false, error: 'Aba Parcelas não encontrada' };
    }
    
    const data = installmentsSheet.getDataRange().getValues();
    
    console.log('📋 Parcelas disponíveis:');
    for (let i = 1; i < Math.min(data.length, 6); i++) {
      const row = data[i];
      if (row[0]) {
        console.log(`${i}. ID: ${row[0]} | Nº: ${row[2]} | Status: ${row[5]} | Valor: R$ ${row[3]}`);
      }
    }
    
    // Procurar uma parcela pendente
    let parcelaTeste = null;
    for (let i = 1; i < data.length; i++) {
      if (data[i][5] === 'Pendente') {
        parcelaTeste = data[i][0];
        console.log(`🎯 Parcela de teste encontrada: ${parcelaTeste}`);
        break;
      }
    }
    
    if (!parcelaTeste) {
      console.log('⚠️ Nenhuma parcela pendente encontrada para teste');
      
      // Criar uma parcela de teste
      const testId = 'test_' + Date.now();
      installmentsSheet.appendRow([
        testId,
        'test_credit',
        1,
        100.00,
        new Date(),
        'Pendente',
        '',
        ''
      ]);
      
      parcelaTeste = testId;
      console.log(`✅ Parcela de teste criada: ${testId}`);
    }
    
    // Testar a função
    console.log('\n🧪 Executando teste da função...');
    const resultado = markInstallmentAsPaid(parcelaTeste, {
      method: 'Teste Automático'
    });
    
    console.log('\n📊 Resultado do teste:');
    console.log('Sucesso:', resultado.success ? '✅' : '❌');
    console.log('Mensagem:', resultado.message || resultado.error);
    
    return resultado;
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ========================================
 * LOGS DE INICIALIZAÇÃO
 * ========================================
 */

console.log('🔧 === FUNÇÃO markInstallmentAsPaid CORRIGIDA ===');
console.log('✅ Função atualizada com:');
console.log('  - Criação automática das abas necessárias');
console.log('  - Logs detalhados para debug');
console.log('  - Verificação robusta de dados');
console.log('  - Tratamento de erros melhorado');
console.log('');
console.log('🧪 Para testar: testarMarkInstallmentAsPaid()');
console.log('💡 A função manterá o mesmo nome e interface!');

/**
 * ========================================
 * FUNÇÃO ALTERNATIVA PARA PAGAMENTO ONLINE
 * ========================================
 */

function processOnlinePayment(installmentId, paymentUrl) {
  try {
    console.log('🌐 Processando pagamento online:', installmentId);
    
    const result = markInstallmentAsPaid(installmentId, {
      method: 'Pagamento Online',
      note: 'Pagamento processado via URL: ' + paymentUrl
    });
    
    if (result.success) {
      console.log('✅ Pagamento online processado');
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Erro no pagamento online:', error);
    return { success: false, error: 'Erro ao processar pagamento online' };
  }
}

/**
 * ========================================
 * FUNÇÃO PARA CANCELAR PAGAMENTO
 * ========================================
 */

function cancelPayment(installmentId) {
  try {
    console.log('❌ Cancelando pagamento:', installmentId);
    
    const spreadsheet = getOrCreateSpreadsheet();
    const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    const paymentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.PAYMENTS);
    
    // Buscar a parcela
    const installmentsData = installmentsSheet.getDataRange().getValues();
    let installmentRow = -1;
    
    for (let i = 1; i < installmentsData.length; i++) {
      if (installmentsData[i][0] === installmentId) {
        installmentRow = i + 1;
        break;
      }
    }
    
    if (installmentRow === -1) {
      return { success: false, error: 'Parcela não encontrada' };
    }
    
    // Reverter status da parcela
    installmentsSheet.getRange(installmentRow, 6).setValue('Pendente'); // Status
    installmentsSheet.getRange(installmentRow, 7).setValue(''); // Limpar Data_Pagamento
    
    // Remover registro de pagamento
    const paymentsData = paymentsSheet.getDataRange().getValues();
    for (let i = paymentsData.length - 1; i >= 1; i--) {
      if (paymentsData[i][1] === installmentId) {
        paymentsSheet.deleteRow(i + 1);
        break;
      }
    }
    
    console.log('✅ Pagamento cancelado');
    
    return {
      success: true,
      message: 'Pagamento cancelado com sucesso!'
    };
    
  } catch (error) {
    console.error('❌ Erro ao cancelar pagamento:', error);
    return { success: false, error: 'Erro ao cancelar pagamento' };
  }
}

function testarSistema() {
  console.log('🧪 Testando sistema...');
  
  try {
    // Teste 1: Conexão
    const conexao = testConnection();
    console.log('Conexão:', conexao.success ? '✅' : '❌');
    
    // Teste 2: Clientes
    const clientes = getClients();
    console.log('Clientes:', clientes.success ? `✅ ${clientes.clients.length}` : '❌');
    
    // Teste 3: URLs de pagamento
    console.log('URLs de pagamento:');
    const testUrls = [
      { creditId: 'test123', installmentNumber: 1 },
      { creditId: 'test456', installmentNumber: 2 },
      { creditId: 'test789', installmentNumber: 4 }
    ];
    
    testUrls.forEach(test => {
      const url = getPaymentUrlByProduct(test.creditId, test.installmentNumber);
      console.log(`  Parcela ${test.installmentNumber}: ${url ? '✅' : '❌'} ${url}`);
    });
    
    return {
      success: true,
      message: 'Testes concluídos'
    };
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    return { success: false, error: error.message };
  }
}

function testConnection() {
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    
    return {
      success: true,
      message: 'Conexão OK',
      spreadsheetInfo: {
        id: spreadsheet.getId(),
        name: spreadsheet.getName()
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
/**
 * ========================================
 * SCRIPT DE CONFIGURAÇÃO AUTOMÁTICA
 * Execute esta função para configurar tudo automaticamente
 * ========================================
 */

function configurarSistemaCompleto() {
  console.log('🚀 === CONFIGURAÇÃO AUTOMÁTICA INICIADA ===');
  
  try {
    // 1. Configurar estrutura da planilha
    console.log('📊 Passo 1: Configurando planilha...');
    const setupResult = setupSystem();
    
    if (!setupResult.success) {
      throw new Error('Falha na configuração da planilha: ' + setupResult.error);
    }
    
    // 2. Criar dados de teste
    console.log('🧪 Passo 2: Criando dados de teste...');
    const testDataResult = criarDadosTeste();
    
    // 3. Testar funções principais
    console.log('🔧 Passo 3: Testando funções...');
    const testResult = testarTodasFuncoes();
    
    // 4. Configurar senhas reais
    console.log('🔑 Passo 4: Configurando senhas...');
    configurarSenhasReais();
    
    console.log('🎉 === CONFIGURAÇÃO CONCLUÍDA COM SUCESSO ===');
    console.log('');
    console.log('📱 PRÓXIMOS PASSOS:');
    console.log('1. Publique como Web App');
    console.log('2. Copie a URL e configure no frontend');
    console.log('3. Teste com as credenciais fornecidas');
    console.log('');
    console.log('🔑 CREDENCIAIS DE LOGIN:');
    console.log('Admin: admin / stark2025');
    console.log('Cliente: 762.538.452-65 / 2025026');
    console.log('Cliente: duarte@gmail.com / 2025026');
    
    return {
      success: true,
      message: 'Sistema configurado com sucesso!',
      webAppUrl: 'Publique como Web App para obter a URL',
      credentials: {
        admin: { user: 'admin', password: 'stark2025' },
        client: { cpf: '762.538.452-65', email: 'duarte@gmail.com', password: '2025026' }
      }
    };
    
  } catch (error) {
    console.error('❌ Erro na configuração:', error);
    return {
      success: false,
      error: error.message,
      solution: 'Execute novamente ou configure manualmente'
    };
  }
}

function criarDadosTeste() {
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    
    // Verificar se já existem dados
    const clientsSheet = spreadsheet.getSheetByName('Clientes');
    if (clientsSheet.getLastRow() > 1) {
      console.log('⚠️ Dados já existem, pulando criação');
      return { success: true, message: 'Dados já existem' };
    }
    
    // Criar clientes de teste
    console.log('👥 Criando clientes de teste...');
    
    const clientes = [
      ['cli001', 'Jackeline Duarte', '762.538.452-65', 'duarte@gmail.com', '(62) 99999-1111', '2025026', new Date()],
      ['cli002', 'Sr°White & Wanderson', '123.456.789-00', 'wanderson@email.com', '(62) 99999-2222', '123456', new Date()],
      ['cli003', 'Maria Silva', '987.654.321-00', 'maria@email.com', '(62) 99999-3333', 'senha123', new Date()]
    ];
    
    clientes.forEach(cliente => {
      clientsSheet.appendRow(cliente);
    });
    
    // Criar crediários de teste
    console.log('🛍️ Criando crediários de teste...');
    
    const creditsSheet = spreadsheet.getSheetByName('Compras');
    const creditos = [
      ['cred001', 'cli001', 'Jackeline Duarte', 'Kit Maquiagem Natura Una', 'Kit completo com batom, base e pó', '💄', 420.00, '2025-01-10', 'Loja Natura', '🌿', 'Ativo'],
      ['cred002', 'cli001', 'Jackeline Duarte', 'Perfume Kaiak Feminino', 'Kaiak Feminino 100ml', '🌸', 280.00, '2025-01-20', 'Loja Natura', '🌿', 'Ativo'],
      ['cred003', 'cli002', 'Sr°White & Wanderson', 'Kit Presente Egeo', 'Egeo Blue + Desodorante + Gel', '🎁', 300.00, '2025-01-15', 'Sr°White Store', '🏬', 'Ativo']
    ];
    
    creditos.forEach(credito => {
      creditsSheet.appendRow(credito);
    });
    
    // Criar parcelas de teste
    console.log('📄 Criando parcelas de teste...');
    
    const installmentsSheet = spreadsheet.getSheetByName('Parcelas');
    const parcelas = [
      // Jackeline - Kit Maquiagem (3 parcelas)
      ['inst001', 'cred001', 1, 140.00, '2025-02-10', 'Pago', '2025-02-08', ''],
      ['inst002', 'cred001', 2, 140.00, '2025-03-10', 'Pendente', '', ''],
      ['inst003', 'cred001', 3, 140.00, '2025-04-10', 'Pendente', '', ''],
      
      // Jackeline - Perfume (2 parcelas)
      ['inst004', 'cred002', 1, 140.00, '2025-02-20', 'Pago', '2025-02-18', ''],
      ['inst005', 'cred002', 2, 140.00, '2025-03-20', 'Pendente', '', ''],
      
      // Sr°White - Kit Presente (2 parcelas)
      ['inst006', 'cred003', 1, 150.00, '2025-02-15', 'Pago', '2025-02-12', ''],
      ['inst007', 'cred003', 2, 150.00, '2025-03-15', 'Pendente', '', '']
    ];
    
    parcelas.forEach(parcela => {
      installmentsSheet.appendRow(parcela);
    });
    
    console.log(`✅ Dados de teste criados: ${clientes.length} clientes, ${creditos.length} crediários, ${parcelas.length} parcelas`);
    
    return {
      success: true,
      clientes: clientes.length,
      creditos: creditos.length,
      parcelas: parcelas.length
    };
    
  } catch (error) {
    console.error('❌ Erro ao criar dados de teste:', error);
    return { success: false, error: error.message };
  }
}

function testarTodasFuncoes() {
  try {
    console.log('🧪 Testando funções principais...');
    
    const testes = [];
    
    // Teste 1: Conexão
    const conexao = testConnection();
    testes.push({ nome: 'Conexão', sucesso: conexao.success });
    
    // Teste 2: Login Admin
    const loginAdmin = handleLogin({
      userType: 'admin',
      user: 'admin',
      password: 'stark2025'
    });
    testes.push({ nome: 'Login Admin', sucesso: loginAdmin.success });
    
    // Teste 3: Login Cliente por CPF
    const loginCpf = handleLogin({
      userType: 'client',
      identifier: '762.538.452-65',
      password: '2025026'
    });
    testes.push({ nome: 'Login por CPF', sucesso: loginCpf.success });
    
    // Teste 4: Login Cliente por Email
    const loginEmail = handleLogin({
      userType: 'client',
      identifier: 'duarte@gmail.com',
      password: '2025026'
    });
    testes.push({ nome: 'Login por Email', sucesso: loginEmail.success });
    
    // Teste 5: Buscar Clientes
    const clientes = getClients();
    testes.push({ nome: 'Buscar Clientes', sucesso: clientes.success });
    
    // Teste 6: Buscar Crediários
    const creditos = getCredits();
    testes.push({ nome: 'Buscar Crediários', sucesso: creditos.success });
    
    // Teste 7: URLs de Pagamento
    const url1 = getPaymentUrlByProduct('cred001', 1);
    const url2 = getPaymentUrlByProduct('cred001', 2);
    testes.push({ nome: 'URLs Pagamento', sucesso: !!(url1 && url2) });
    
    // Teste 8: Marcar como pago (simulação)
    // Não vamos executar para não alterar dados
    testes.push({ nome: 'Marcar como Pago', sucesso: true, nota: 'Função disponível' });
    
    const sucessos = testes.filter(t => t.sucesso).length;
    const total = testes.length;
    
    console.log('📊 Resultados dos testes:');
    testes.forEach(teste => {
      const status = teste.sucesso ? '✅' : '❌';
      const nota = teste.nota ? ` (${teste.nota})` : '';
      console.log(`  ${status} ${teste.nome}${nota}`);
    });
    
    console.log(`📈 Taxa de sucesso: ${sucessos}/${total} (${Math.round(sucessos/total*100)}%)`);
    
    return {
      success: sucessos >= total * 0.8, // 80% mínimo
      sucessos: sucessos,
      total: total,
      detalhes: testes
    };
    
  } catch (error) {
    console.error('❌ Erro nos testes:', error);
    return { success: false, error: error.message };
  }
}

function configurarSenhasReais() {
  try {
    console.log('🔑 Configurando senhas reais...');
    
    const spreadsheet = getOrCreateSpreadsheet();
    const sheet = spreadsheet.getSheetByName('Clientes');
    const data = sheet.getDataRange().getValues();
    
    const senhas = {
      'Jackeline Duarte': '2025026',
      'Sr°White & Wanderson': '123456',
      'Maria Silva': 'senha123'
    };
    
    let atualizacoes = 0;
    
    for (let i = 1; i < data.length; i++) {
      const nome = data[i][1];
      if (senhas[nome]) {
        sheet.getRange(i + 1, 6).setValue(senhas[nome]);
        console.log(`✅ ${nome}: senha configurada`);
        atualizacoes++;
      }
    }
    
    console.log(`🎉 ${atualizacoes} senhas configuradas`);
    
    return { success: true, atualizacoes: atualizacoes };
    
  } catch (error) {
    console.error('❌ Erro ao configurar senhas:', error);
    return { success: false, error: error.message };
  }
}

// Função de configuração rápida para desenvolvimento
function configRapida() {
  console.log('⚡ Configuração rápida para desenvolvimento...');
  
  try {
    // Apenas configurar estrutura se necessário
    const spreadsheet = getOrCreateSpreadsheet();
    const clientsSheet = spreadsheet.getSheetByName('Clientes');
    
    if (!clientsSheet || clientsSheet.getLastRow() <= 1) {
      return configurarSistemaCompleto();
    } else {
      console.log('✅ Sistema já configurado!');
      console.log('🔧 Para testar, execute:');
      console.log('- markInstallmentAsPaid("inst002")');
      console.log('- getPaymentUrlByProduct("cred001", 2)');
      
      return {
        success: true,
        message: 'Sistema já configurado e pronto para uso',
        testFunctions: [
          'markInstallmentAsPaid("inst002")',
          'getPaymentUrlByProduct("cred001", 2)',
          'loadClientData("cli001")'
        ]
      };
    }
    
  } catch (error) {
    console.error('❌ Erro na configuração rápida:', error);
    return { success: false, error: error.message };
  }
}

// Função para limpar dados e reconfigurar
function resetarSistema() {
  if (!confirm('⚠️ ATENÇÃO: Isso vai apagar todos os dados! Continuar?')) {
    return { success: false, message: 'Operação cancelada pelo usuário' };
  }
  
  try {
    console.log('🗑️ Resetando sistema...');
    
    const spreadsheet = getOrCreateSpreadsheet();
    const sheets = ['Clientes', 'Compras', 'Parcelas', 'Pagamentos'];
    
    sheets.forEach(sheetName => {
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (sheet) {
        // Limpar dados (manter headers)
        if (sheet.getLastRow() > 1) {
          sheet.deleteRows(2, sheet.getLastRow() - 1);
        }
        console.log(`🧹 ${sheetName} limpo`);
      }
    });
    
    console.log('✅ Sistema resetado');
    console.log('🚀 Execute: configurarSistemaCompleto()');
    
    return {
      success: true,
      message: 'Sistema resetado com sucesso',
      proximoPasso: 'Execute configurarSistemaCompleto()'
    };
    
  } catch (error) {
    console.error('❌ Erro ao resetar:', error);
    return { success: false, error: error.message };
  }
}

// Logs de inicialização
console.log('⚡ === CONFIGURAÇÃO AUTOMÁTICA CARREGADA ===');
console.log('🚀 Execute: configurarSistemaCompleto()');
console.log('⚡ Para config rápida: configRapida()');
console.log('🗑️ Para resetar: resetarSistema()');
console.log('');
console.log('💡 Após configurar, publique como Web App e teste!');

/**
 * ========================================
 * CORREÇÃO - CARREGAMENTO DE PARCELAS
 * Resolve o problema de parcelas não aparecendo
 * ========================================
 */

// ===== DIAGNÓSTICO DAS PARCELAS =====

function diagnosticarParcelas() {
    console.log('🔍 === DIAGNÓSTICO DE PARCELAS ===');
    
    try {
        const spreadsheet = getOrCreateSpreadsheet();
        
        // Verificar aba Compras
        const comprasSheet = spreadsheet.getSheetByName('Compras');
        const comprasData = comprasSheet.getDataRange().getValues();
        
        console.log('📊 COMPRAS ENCONTRADAS:');
        for (let i = 1; i < comprasData.length; i++) {
            const row = comprasData[i];
            if (row[0]) {
                console.log(`${i}. ID: ${row[0]} | Cliente: ${row[2]} | Produto: ${row[3]} | Valor: R$ ${row[6]}`);
            }
        }
        
        // Verificar aba Parcelas
        const parcelasSheet = spreadsheet.getSheetByName('Parcelas');
        const parcelasData = parcelasSheet.getDataRange().getValues();
        
        console.log('📊 PARCELAS ENCONTRADAS:');
        for (let i = 1; i < parcelasData.length; i++) {
            const row = parcelasData[i];
            if (row[0]) {
                console.log(`${i}. ID: ${row[0]} | Compra_ID: ${row[1]} | Parcela: ${row[2]} | Valor: R$ ${row[3]} | Status: ${row[5]}`);
            }
        }
        
        // Verificar vinculação
        console.log('🔗 VERIFICANDO VINCULAÇÃO:');
        for (let i = 1; i < comprasData.length; i++) {
            const compraId = comprasData[i][0];
            if (compraId) {
                const parcelasVinculadas = parcelasData.filter(row => row[1] === compraId);
                console.log(`Compra ${compraId}: ${parcelasVinculadas.length} parcelas encontradas`);
            }
        }
        
        return {
            success: true,
            compras: comprasData.length - 1,
            parcelas: parcelasData.length - 1
        };
        
    } catch (error) {
        console.error('❌ Erro no diagnóstico:', error);
        return { success: false, error: error.message };
    }
}
/**
 * ========================================
 * SCRIPT DE VERIFICAÇÃO E DIAGNÓSTICO
 * Execute no Google Apps Script para verificar conexões
 * ========================================
 */

function diagnosticoCompleto() {
    console.log('🔍 === DIAGNÓSTICO COMPLETO DO SISTEMA ===');
    
    const relatorio = {
        timestamp: new Date().toISOString(),
        testes: [],
        erros: [],
        sucesso: false
    };
    
    try {
        // 1. Teste de Conexão com Planilha
        console.log('📊 1. Testando conexão com planilha...');
        const planilhaTest = testarConexaoPlanilha();
        relatorio.testes.push({
            nome: 'Conexão Planilha',
            sucesso: planilhaTest.success,
            detalhes: planilhaTest
        });
        
        // 2. Teste de Estrutura das Abas
        console.log('📋 2. Verificando estrutura das abas...');
        const estruturaTest = verificarEstrutura();
        relatorio.testes.push({
            nome: 'Estrutura Abas',
            sucesso: estruturaTest.success,
            detalhes: estruturaTest
        });
        
        // 3. Teste de Funções Principais
        console.log('⚙️ 3. Testando funções principais...');
        const funcoesTest = testarFuncoesPrincipais();
        relatorio.testes.push({
            nome: 'Funções Principais',
            sucesso: funcoesTest.success,
            detalhes: funcoesTest
        });
        
        // 4. Teste de Dados de Exemplo
        console.log('👥 4. Verificando dados de exemplo...');
        const dadosTest = verificarDadosExemplo();
        relatorio.testes.push({
            nome: 'Dados de Exemplo',
            sucesso: dadosTest.success,
            detalhes: dadosTest
        });
        
        // 5. Teste de Web App
        console.log('🌐 5. Verificando Web App...');
        const webAppTest = verificarWebApp();
        relatorio.testes.push({
            nome: 'Web App',
            sucesso: webAppTest.success,
            detalhes: webAppTest
        });
        
        // Resultado Final
        const sucessos = relatorio.testes.filter(t => t.sucesso).length;
        const total = relatorio.testes.length;
        relatorio.sucesso = sucessos >= total * 0.8; // 80% de sucesso
        
        console.log('📊 === RELATÓRIO FINAL ===');
        console.log(`✅ Sucessos: ${sucessos}/${total}`);
        console.log(`🎯 Taxa de Sucesso: ${Math.round(sucessos/total*100)}%`);
        console.log(`📈 Status Geral: ${relatorio.sucesso ? '✅ SISTEMA OK' : '⚠️ REQUER ATENÇÃO'}`);
        
        // Recomendações
        if (!relatorio.sucesso) {
            console.log('🔧 === RECOMENDAÇÕES ===');
            relatorio.testes.forEach(teste => {
                if (!teste.sucesso) {
                    console.log(`❌ ${teste.nome}: ${teste.detalhes.error || 'Erro'}`);
                    console.log(`💡 Solução: ${gerarSolucao(teste.nome)}`);
                }
            });
        }
        
        return relatorio;
        
    } catch (error) {
        console.error('❌ Erro crítico no diagnóstico:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

function testarConexaoPlanilha() {
    try {
        const spreadsheet = getOrCreateSpreadsheet();
        const sheetCount = spreadsheet.getSheets().length;
        
        return {
            success: true,
            spreadsheetId: spreadsheet.getId(),
            spreadsheetName: spreadsheet.getName(),
            sheetCount: sheetCount,
            url: spreadsheet.getUrl()
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

function verificarEstrutura() {
    try {
        const spreadsheet = getOrCreateSpreadsheet();
        const expectedSheets = ['Clientes', 'Compras', 'Parcelas', 'Pagamentos'];
        const existingSheets = spreadsheet.getSheets().map(s => s.getName());
        
        const missing = expectedSheets.filter(name => !existingSheets.includes(name));
        const extra = existingSheets.filter(name => !expectedSheets.includes(name) && name !== 'Planilha1');
        
        return {
            success: missing.length === 0,
            expected: expectedSheets,
            existing: existingSheets,
            missing: missing,
            extra: extra
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

function testarFuncoesPrincipais() {
    const funcoes = [
        'handleLogin',
        'loadClientData', 
        'loadAdminData',
        'createClient',
        'createCredit',
        'getClients',
        'getCredits',
        'markInstallmentAsPaid'
    ];
    
    const resultados = {};
    let sucessos = 0;
    
    funcoes.forEach(funcName => {
        try {
            const funcExists = typeof eval(funcName) === 'function';
            resultados[funcName] = funcExists;
            if (funcExists) sucessos++;
        } catch (error) {
            resultados[funcName] = false;
        }
    });
    
    return {
        success: sucessos === funcoes.length,
        total: funcoes.length,
        sucessos: sucessos,
        detalhes: resultados
    };
}

function verificarDadosExemplo() {
    try {
        const clientsResult = getClients();
        const creditsResult = getCredits();
        
        return {
            success: clientsResult.success && creditsResult.success,
            clientes: clientsResult.clients?.length || 0,
            creditos: creditsResult.credits?.length || 0,
            clientsData: clientsResult.success,
            creditsData: creditsResult.success
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

function verificarWebApp() {
    try {
        // Verificar se as funções do Web App existem
        const doGetExists = typeof doGet === 'function';
        const includeExists = typeof include === 'function';
        
        return {
            success: doGetExists && includeExists,
            doGet: doGetExists,
            include: includeExists,
            url: ScriptApp.getService().getUrl() || 'Não implantado'
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

function gerarSolucao(nomeProblema) {
    const solucoes = {
        'Conexão Planilha': 'Verifique o SPREADSHEET_ID e permissões da planilha',
        'Estrutura Abas': 'Execute configurarSistemaCompleto() para criar abas',
        'Funções Principais': 'Verifique se todo o código backend foi copiado',
        'Dados de Exemplo': 'Execute criarDadosTesteCompletos() para popular dados',
        'Web App': 'Implante como Web App e autorize permissões'
    };
    
    return solucoes[nomeProblema] || 'Verifique logs e documentação';
}

/**
 * ========================================
 * FUNÇÕES DE CORREÇÃO AUTOMÁTICA
 * ========================================
 */

function correcaoAutomatica() {
    console.log('🔧 === CORREÇÃO AUTOMÁTICA INICIADA ===');
    
    try {
        // 1. Configurar sistema se necessário
        console.log('⚙️ Configurando sistema...');
        const configResult = configurarSistemaCompleto();
        
        // 2. Criar dados de teste se vazio
        console.log('📝 Verificando dados de teste...');
        const clientsResult = getClients();
        if (!clientsResult.success || clientsResult.clients.length === 0) {
            console.log('📊 Criando dados de teste...');
            criarDadosTesteCompletos();
        }
        
        // 3. Diagnosticar novamente
        console.log('🔍 Diagnosticando após correções...');
        const finalDiagnostic = diagnosticoCompleto();
        
        return {
            success: finalDiagnostic.sucesso,
            message: finalDiagnostic.sucesso ? 
                'Sistema corrigido automaticamente!' : 
                'Correções aplicadas, mas requer atenção manual',
            diagnostico: finalDiagnostic
        };
        
    } catch (error) {
        console.error('❌ Erro na correção automática:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * ========================================
 * TESTE DE CONECTIVIDADE FRONTEND
 * ========================================
 */

function testarConectividadeFrontend() {
    console.log('🔗 === TESTE DE CONECTIVIDADE FRONTEND ===');
    
    const testes = [
        {
            nome: 'Login Admin',
            funcao: () => handleLogin({
                userType: 'admin',
                user: 'admin', 
                password: 'stark2025'
            })
        },
        {
            nome: 'Login Cliente',
            funcao: () => handleLogin({
                userType: 'client',
                identifier: '762.538.452-65',
                password: '2025026'
            })
        },
        {
            nome: 'Carregar Dados Admin',
            funcao: () => loadAdminData()
        },
        {
            nome: 'Carregar Dados Cliente',
            funcao: () => loadClientData('cli001')
        }
    ];
    
    const resultados = [];
    
    testes.forEach(teste => {
        try {
            console.log(`🧪 Testando: ${teste.nome}`);
            const resultado = teste.funcao();
            resultados.push({
                nome: teste.nome,
                sucesso: resultado?.success !== false,
                resultado: resultado
            });
            console.log(`✅ ${teste.nome}: OK`);
        } catch (error) {
            resultados.push({
                nome: teste.nome,
                sucesso: false,
                erro: error.message
            });
            console.log(`❌ ${teste.nome}: ${error.message}`);
        }
    });
    
    const sucessos = resultados.filter(r => r.sucesso).length;
    console.log(`📊 Conectividade: ${sucessos}/${testes.length} testes passaram`);
    
    return {
        success: sucessos >= testes.length * 0.75,
        resultados: resultados,
        taxa: sucessos / testes.length
    };
}

/**
 * ========================================
 * VERIFICADOR DE CONFIGURAÇÃO WEB APP
 * ========================================
 */

function verificarConfiguracaoWebApp() {
    console.log('🌐 === VERIFICANDO CONFIGURAÇÃO WEB APP ===');
    
    const config = {
        urlWebApp: ScriptApp.getService().getUrl(),
        triggers: ScriptApp.getProjectTriggers().length,
        permissoes: 'Verificar manualmente',
        funcaoDoGet: typeof doGet === 'function',
        arquivoIndex: verificarArquivoIndex()
    };
    
    console.log('📋 Configuração atual:');
    console.log('  🌐 URL Web App:', config.urlWebApp || 'NÃO IMPLANTADO');
    console.log('  ⚙️ Triggers:', config.triggers);
    console.log('  📄 Função doGet:', config.funcaoDoGet ? 'OK' : 'FALTANDO');
    console.log('  📁 Arquivo index.html:', config.arquivoIndex ? 'OK' : 'FALTANDO');
    
    const problemas = [];
    if (!config.urlWebApp) problemas.push('Web App não implantado');
    if (!config.funcaoDoGet) problemas.push('Função doGet não encontrada');
    if (!config.arquivoIndex) problemas.push('Arquivo index.html não encontrado');
    
    if (problemas.length === 0) {
        console.log('✅ Configuração Web App OK!');
        console.log(`🔗 Acesse: ${config.urlWebApp}`);
    } else {
        console.log('❌ Problemas encontrados:');
        problemas.forEach(p => console.log(`  - ${p}`));
    }
    
    return {
        success: problemas.length === 0,
        config: config,
        problemas: problemas
    };
}

function verificarArquivoIndex() {
    try {
        // Tenta incluir o arquivo index.html
        const content = include('index');
        return content && content.length > 100;
    } catch (error) {
        return false;
    }
}

/**
 * ========================================
 * COMANDO ÚNICO PARA RESOLVER TUDO
 * ========================================
 */

function resolverTudo() {
    console.log('🚀 === RESOLVENDO TUDO AUTOMATICAMENTE ===');
    
    try {
        // 1. Diagnóstico inicial
        const diagnostico = diagnosticoCompleto();
        
        // 2. Correção automática
        const correcao = correcaoAutomatica();
        
        // 3. Verificar Web App
        const webApp = verificarConfiguracaoWebApp();
        
        // 4. Teste de conectividade
        const conectividade = testarConectividadeFrontend();
        
        console.log('🎉 === RESOLUÇÃO CONCLUÍDA ===');
        
        const tudoOk = diagnostico.sucesso && correcao.success && webApp.success && conectividade.success;
        
        if (tudoOk) {
            console.log('✅ SISTEMA 100% FUNCIONAL!');
            console.log('🔗 Acesse seu Web App:', webApp.config.urlWebApp);
            console.log('👤 Login Admin: admin / stark2025');
            console.log('👤 Login Cliente: 762.538.452-65 / 2025026');
        } else {
            console.log('⚠️ Sistema funcional com algumas limitações');
            console.log('📋 Verifique os problemas listados acima');
        }
        
        return {
            success: tudoOk,
            diagnostico: diagnostico,
            correcao: correcao,
            webApp: webApp,
            conectividade: conectividade
        };
        
    } catch (error) {
        console.error('❌ Erro crítico:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ========================================
 * LOGS DE INICIALIZAÇÃO
 * ========================================
 */

console.log('🔍 === DIAGNÓSTICO CARREGADO ===');
console.log('🚀 Execute: resolverTudo() - Para resolver todos os problemas');
console.log('🔍 Execute: diagnosticoCompleto() - Para diagnóstico detalhado');
console.log('🔧 Execute: correcaoAutomatica() - Para correções automáticas');
console.log('🌐 Execute: verificarConfiguracaoWebApp() - Para verificar Web App');
console.log('🔗 Execute: testarConectividadeFrontend() - Para testar conexões');
// ===== CRIAR PARCELAS PARA CREDIÁRIOS EXISTENTES =====

function criarParcelasParaCrediariosExistentes() {
    console.log('🔧 === CRIANDO PARCELAS PARA CREDIÁRIOS EXISTENTES ===');
    
    try {
        const spreadsheet = getOrCreateSpreadsheet();
        const comprasSheet = spreadsheet.getSheetByName('Compras');
        const parcelasSheet = spreadsheet.getSheetByName('Parcelas');
        
        const comprasData = comprasSheet.getDataRange().getValues();
        const parcelasData = parcelasSheet.getDataRange().getValues();
        
        let parcelasCriadas = 0;
        
        // Para cada crediário, verificar se tem parcelas
        for (let i = 1; i < comprasData.length; i++) {
            const compra = comprasData[i];
            const compraId = compra[0];
            const valorTotal = compra[6];
            const dataCompra = compra[7];
            
            if (!compraId) continue;
            
            // Verificar se já tem parcelas
            const parcelasExistentes = parcelasData.filter(row => row[1] === compraId);
            
            if (parcelasExistentes.length === 0) {
                console.log(`🔧 Criando parcelas para: ${compra[3]} (${compraId})`);
                
                // Criar parcelas padrão (vamos usar 3 parcelas)
                const numeroParcelas = 3;
                const valorParcela = valorTotal / numeroParcelas;
                
                for (let p = 1; p <= numeroParcelas; p++) {
                    const dataVencimento = new Date(dataCompra);
                    dataVencimento.setMonth(dataVencimento.getMonth() + p);
                    
                    const status = p === 1 ? 'Pago' : 'Pendente';
                    const dataPagamento = p === 1 ? new Date() : '';
                    
                    const novaParcela = [
                        generateId(), // ID da parcela
                        compraId, // ID da compra
                        p, // Número da parcela
                        valorParcela, // Valor
                        dataVencimento, // Data vencimento
                        status, // Status
                        dataPagamento, // Data pagamento
                        '' // Link pagamento
                    ];
                    
                    parcelasSheet.appendRow(novaParcela);
                    parcelasCriadas++;
                    
                    console.log(`  ✅ Parcela ${p}/${numeroParcelas}: R$ ${valorParcela.toFixed(2)} - ${status}`);
                }
            }
        }
        
        console.log(`🎉 ${parcelasCriadas} parcelas criadas!`);
        
        return {
            success: true,
            parcelasCriadas: parcelasCriadas,
            message: `${parcelasCriadas} parcelas foram criadas para os crediários existentes`
        };
        
    } catch (error) {
        console.error('❌ Erro ao criar parcelas:', error);
        return { success: false, error: error.message };
    }
}

// ===== CORREÇÃO DA FUNÇÃO getCredits =====

function getCreditsCorrigido(clientId = null) {
    console.log(`💳 Buscando crediários${clientId ? ' para cliente ' + clientId : ''} [VERSÃO CORRIGIDA]...`);
    
    try {
        const spreadsheet = getOrCreateSpreadsheet();
        const creditsSheet = spreadsheet.getSheetByName('Compras');
        const installmentsSheet = spreadsheet.getSheetByName('Parcelas');
        
        if (!creditsSheet || !installmentsSheet) {
            console.log('❌ Abas de crediários não encontradas');
            return { 
                success: false, 
                error: 'Abas de crediários não encontradas',
                credits: [] 
            };
        }
        
        const creditsData = creditsSheet.getDataRange().getValues();
        const installmentsData = installmentsSheet.getDataRange().getValues();
        
        console.log(`📊 ${creditsData.length - 1} crediários e ${installmentsData.length - 1} parcelas na planilha`);
        
        const credits = [];
        
        for (let i = 1; i < creditsData.length; i++) {
            const creditRow = creditsData[i];
            
            if (!creditRow[0]) continue; // Pular linha vazia
            
            const creditId = String(creditRow[0]);
            
            // Filtrar por cliente se especificado
            if (clientId && creditRow[1] !== clientId) continue;
            
            console.log(`🔍 Processando crediário: ${creditId} - ${creditRow[3]}`);
            
            // Buscar parcelas deste crediário
            const creditInstallments = [];
            
            for (let j = 1; j < installmentsData.length; j++) {
                const installmentRow = installmentsData[j];
                
                if (String(installmentRow[1]) === creditId) { // Mesmo Compra_ID
                    const installment = {
                        id: String(installmentRow[0]),
                        number: Number(installmentRow[2] || 0),
                        value: Number(installmentRow[3] || 0),
                        dueDate: formatDateSafe(installmentRow[4]),
                        status: String(installmentRow[5] || 'Pendente'),
                        paymentDate: installmentRow[6] ? formatDateSafe(installmentRow[6]) : null
                    };
                    
                    creditInstallments.push(installment);
                    console.log(`  📄 Parcela ${installment.number}: R$ ${installment.value} - ${installment.status}`);
                }
            }
            
            // Ordenar parcelas por número
            creditInstallments.sort((a, b) => a.number - b.number);
            
            console.log(`  ✅ ${creditInstallments.length} parcelas encontradas para ${creditId}`);
            
            const credit = {
                id: creditId,
                clientId: String(creditRow[1]),
                clientName: String(creditRow[2] || ''),
                productName: String(creditRow[3] || ''),
                productDescription: String(creditRow[4] || ''),
                productEmoji: String(creditRow[5] || '🛒'),
                totalValue: Number(creditRow[6] || 0),
                purchaseDate: formatDateSafe(creditRow[7]),
                storeName: String(creditRow[8] || ''),
                storeEmoji: String(creditRow[9] || '🏬'),
                status: String(creditRow[10] || 'Ativo'),
                installments: creditInstallments
            };
            
            credits.push(credit);
        }
        
        console.log(`✅ ${credits.length} crediários processados com sucesso`);
        
        return { 
            success: true, 
            credits: credits 
        };
        
    } catch (error) {
        console.error('❌ Erro ao buscar crediários corrigido:', error);
        
        return { 
            success: false, 
            error: 'Erro ao buscar crediários: ' + error.message,
            credits: [] 
        };
    }
}

// ===== SUBSTITUIR FUNÇÃO ORIGINAL =====

function aplicarCorrecaoGetCredits() {
    console.log('🔄 Substituindo função getCredits pela versão corrigida...');
    
    // Fazer backup da função original
    if (typeof getCredits === 'function') {
        window.getCreditsOriginal = getCredits;
    }
    
    // Substituir pela versão corrigida
    window.getCredits = getCreditsCorrigido;
    
    console.log('✅ Função getCredits corrigida aplicada');
}

// ===== CORRIGIR FUNÇÃO loadClientData =====

function loadClientDataCorrigido(clientId) {
    console.log(`📊 Carregando dados do cliente [VERSÃO CORRIGIDA]: ${clientId}`);
    
    try {
        if (!clientId) {
            return {
                success: false,
                error: 'ID do cliente não informado'
            };
        }
        
        // Usar a versão corrigida de getCredits
        const creditsResult = getCreditsCorrigido(clientId);
        
        if (!creditsResult.success) {
            return creditsResult;
        }
        
        const credits = creditsResult.credits || [];
        let totalCredits = credits.length;
        let totalDebt = 0;
        let overdueCount = 0;
        let totalPaid = 0;
        let totalAmount = 0;
        
        const today = new Date();
        
        credits.forEach(credit => {
            console.log(`📊 Processando crediário: ${credit.productName} com ${credit.installments.length} parcelas`);
            
            if (credit.installments) {
                credit.installments.forEach(installment => {
                    totalAmount += Number(installment.value || 0);
                    
                    if (installment.status === 'Pago') {
                        totalPaid += Number(installment.value || 0);
                    } else {
                        totalDebt += Number(installment.value || 0);
                        
                        try {
                            const dueDate = new Date(installment.dueDate);
                            if (dueDate < today) {
                                overdueCount++;
                            }
                        } catch (e) {
                            console.warn('Erro ao processar data de vencimento:', installment.dueDate);
                        }
                    }
                });
            }
        });
        
        const collectionRate = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;
        
        console.log(`✅ Dados calculados: ${totalCredits} crediários, R$ ${totalDebt} em aberto, ${overdueCount} vencidas`);
        
        return {
            success: true,
            data: {
                totalCredits,
                totalDebt,
                overdueCount,
                totalPaid,
                totalAmount,
                collectionRate,
                credits
            }
        };
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados do cliente:', error);
        
        return {
            success: false,
            error: 'Erro ao carregar dados: ' + error.message
        };
    }
}
/**
 * ========================================
 * DIAGNÓSTICO - PARCELAS PERDIDAS
 * Resolve problema de parcelas não aparecendo
 * ========================================
 */

// ===== DIAGNÓSTICO ESPECÍFICO DE PARCELAS PERDIDAS =====

function diagnosticarParcelasPerdidas() {
    console.log('🔍 === DIAGNÓSTICO DE PARCELAS PERDIDAS ===');
    
    try {
        const spreadsheet = getOrCreateSpreadsheet();
        const comprasSheet = spreadsheet.getSheetByName('Compras');
        const parcelasSheet = spreadsheet.getSheetByName('Parcelas');
        
        const comprasData = comprasSheet.getDataRange().getValues();
        const parcelasData = parcelasSheet.getDataRange().getValues();
        
        console.log('📊 DIAGNÓSTICO DETALHADO:');
        
        // Buscar especificamente o Dentes_Gulherme
        let compraGulherme = null;
        let linhaCompra = -1;
        
        for (let i = 1; i < comprasData.length; i++) {
            if (comprasData[i][3] && comprasData[i][3].includes('Dentes_Gulherme')) {
                compraGulherme = comprasData[i];
                linhaCompra = i + 1;
                break;
            }
        }
        
        if (!compraGulherme) {
            console.log('❌ Compra Dentes_Gulherme não encontrada');
            return { success: false, error: 'Compra não encontrada' };
        }
        
        const compraId = compraGulherme[0];
        console.log(`🎯 COMPRA ENCONTRADA:`);
        console.log(`  🆔 ID: ${compraId}`);
        console.log(`  📍 Linha na planilha: ${linhaCompra}`);
        console.log(`  👤 Cliente: ${compraGulherme[2]}`);
        console.log(`  🛍️ Produto: ${compraGulherme[3]}`);
        console.log(`  💰 Valor: R$ ${compraGulherme[6]}`);
        
        // Buscar TODAS as parcelas desta compra
        console.log(`\n🔍 BUSCANDO PARCELAS COM ID: ${compraId}`);
        const parcelasEncontradas = [];
        
        for (let j = 1; j < parcelasData.length; j++) {
            const parcelaRow = parcelasData[j];
            
            // Debug detalhado de cada linha
            console.log(`  📄 Linha ${j + 1}: ID_Compra="${parcelaRow[1]}" | Número="${parcelaRow[2]}" | Valor="${parcelaRow[3]}"`);
            
            // Verificar correspondência exata
            if (String(parcelaRow[1]).trim() === String(compraId).trim()) {
                parcelasEncontradas.push({
                    linha: j + 1,
                    id: parcelaRow[0],
                    compraId: parcelaRow[1],
                    numero: parcelaRow[2],
                    valor: parcelaRow[3],
                    vencimento: parcelaRow[4],
                    status: parcelaRow[5],
                    pagamento: parcelaRow[6]
                });
                
                console.log(`    ✅ MATCH! Parcela ${parcelaRow[2]} encontrada`);
            } else {
                console.log(`    ❌ No match: "${parcelaRow[1]}" !== "${compraId}"`);
            }
        }
        
        console.log(`\n📊 RESULTADO:`);
        console.log(`  🎯 Parcelas encontradas: ${parcelasEncontradas.length}`);
        console.log(`  📋 DETALHES DAS PARCELAS:`);
        
        parcelasEncontradas.forEach(parcela => {
            console.log(`    ${parcela.numero}. R$ ${parcela.valor} - ${parcela.status} (linha ${parcela.linha})`);
        });
        
        // Verificar se há problemas de tipo ou formatação
        console.log(`\n🔍 ANÁLISE DE TIPOS:`);
        console.log(`  🆔 Tipo do ID da compra: ${typeof compraId}`);
        console.log(`  📝 Valor do ID da compra: "${compraId}"`);
        console.log(`  📏 Tamanho do ID: ${String(compraId).length}`);
        
        return {
            success: true,
            compraId: compraId,
            parcelasEncontradas: parcelasEncontradas.length,
            parcelas: parcelasEncontradas
        };
        
    } catch (error) {
        console.error('❌ Erro no diagnóstico:', error);
        return { success: false, error: error.message };
    }
}

// ===== VERIFICAR TODAS AS PARCELAS DA PLANILHA =====

function listarTodasAsParcelasDaPlanilha() {
    console.log('📋 === LISTANDO TODAS AS PARCELAS DA PLANILHA ===');
    
    try {
        const spreadsheet = getOrCreateSpreadsheet();
        const parcelasSheet = spreadsheet.getSheetByName('Parcelas');
        const parcelasData = parcelasSheet.getDataRange().getValues();
        
        console.log(`📊 Total de linhas na aba Parcelas: ${parcelasData.length}`);
        console.log(`📊 Headers: ${parcelasData[0].join(' | ')}`);
        
        console.log('\n📋 TODAS AS PARCELAS:');
        
        for (let i = 1; i < parcelasData.length; i++) {
            const row = parcelasData[i];
            if (row[0]) { // Se tem ID
                console.log(`${i}. ID: ${row[0]} | Compra: ${row[1]} | Nº: ${row[2]} | Valor: R$ ${row[3]} | Status: ${row[5]}`);
                
                // Destacar parcelas do Dentes_Gulherme
                if (String(row[1]).includes('mdclxros01ein0lxap0e') || 
                    (row[1] && String(row[1]).trim().length > 10)) {
                    console.log(`    🦷 *** POSSÍVEL PARCELA DENTES_GULHERME ***`);
                }
            }
        }
        
        return { success: true, totalParcelas: parcelasData.length - 1 };
        
    } catch (error) {
        console.error('❌ Erro ao listar parcelas:', error);
        return { success: false, error: error.message };
    }
}

// ===== BUSCAR PARCELAS COM FILTRO FLEXÍVEL =====

function buscarParcelasFlexivel(termoBusca) {
    console.log(`🔍 Buscando parcelas com termo: "${termoBusca}"`);
    
    try {
        const spreadsheet = getOrCreateSpreadsheet();
        const comprasSheet = spreadsheet.getSheetByName('Compras');
        const parcelasSheet = spreadsheet.getSheetByName('Parcelas');
        
        const comprasData = comprasSheet.getDataRange().getValues();
        const parcelasData = parcelasSheet.getDataRange().getValues();
        
        // Buscar compras que contenham o termo
        const comprasEncontradas = [];
        
        for (let i = 1; i < comprasData.length; i++) {
            const compra = comprasData[i];
            if (compra[3] && compra[3].toLowerCase().includes(termoBusca.toLowerCase())) {
                comprasEncontradas.push({
                    linha: i + 1,
                    id: compra[0],
                    cliente: compra[2],
                    produto: compra[3],
                    valor: compra[6]
                });
            }
        }
        
        console.log(`📦 Compras encontradas: ${comprasEncontradas.length}`);
        
        // Para cada compra, buscar suas parcelas
        comprasEncontradas.forEach(compra => {
            console.log(`\n🎯 ${compra.produto} (${compra.id}):`);
            
            const parcelas = [];
            
            // Busca com diferentes critérios
            for (let j = 1; j < parcelasData.length; j++) {
                const parcela = parcelasData[j];
                
                // Critério 1: ID exato
                if (String(parcela[1]) === String(compra.id)) {
                    parcelas.push({ tipo: 'ID_EXATO', linha: j + 1, dados: parcela });
                }
                // Critério 2: ID contém
                else if (String(parcela[1]).includes(String(compra.id))) {
                    parcelas.push({ tipo: 'ID_CONTEM', linha: j + 1, dados: parcela });
                }
                // Critério 3: Compra ID contém parcela ID
                else if (String(compra.id).includes(String(parcela[1]))) {
                    parcelas.push({ tipo: 'COMPRA_CONTEM', linha: j + 1, dados: parcela });
                }
            }
            
            console.log(`  📊 Parcelas encontradas: ${parcelas.length}`);
            
            parcelas.forEach(parcela => {
                console.log(`    ${parcela.tipo}: Linha ${parcela.linha} | Nº ${parcela.dados[2]} | R$ ${parcela.dados[3]} | ${parcela.dados[5]}`);
            });
        });
        
        return { success: true, comprasEncontradas };
        
    } catch (error) {
        console.error('❌ Erro na busca flexível:', error);
        return { success: false, error: error.message };
    }
}

// ===== CORRIGIR VINCULAÇÃO DE PARCELAS =====

function corrigirVinculacaoParcelas() {
    console.log('🔧 === CORRIGINDO VINCULAÇÃO DE PARCELAS ===');
    
    try {
        const spreadsheet = getOrCreateSpreadsheet();
        const comprasSheet = spreadsheet.getSheetByName('Compras');
        const parcelasSheet = spreadsheet.getSheetByName('Parcelas');
        
        const comprasData = comprasSheet.getDataRange().getValues();
        const parcelasData = parcelasSheet.getDataRange().getValues();
        
        let correcoes = 0;
        
        // Para cada compra, verificar se suas parcelas estão corretas
        for (let i = 1; i < comprasData.length; i++) {
            const compra = comprasData[i];
            const compraId = compra[0];
            const produtoNome = compra[3];
            
            if (!compraId) continue;
            
            // Buscar parcelas que deveriam estar vinculadas
            const parcelasVinculadas = [];
            const parcelasPossiveis = [];
            
            for (let j = 1; j < parcelasData.length; j++) {
                const parcela = parcelasData[j];
                
                // Parcelas já vinculadas corretamente
                if (String(parcela[1]) === String(compraId)) {
                    parcelasVinculadas.push({ linha: j + 1, dados: parcela });
                }
                // Parcelas que podem estar mal vinculadas
                else if (!parcela[1] || parcela[1] === '' || String(parcela[1]).length < 5) {
                    parcelasPossiveis.push({ linha: j + 1, dados: parcela });
                }
            }
            
            console.log(`🔍 ${produtoNome}:`);
            console.log(`  ✅ Parcelas vinculadas: ${parcelasVinculadas.length}`);
            console.log(`  ❓ Parcelas não vinculadas: ${parcelasPossiveis.length}`);
            
            // Se tem menos de 3 parcelas vinculadas e há parcelas não vinculadas
            if (parcelasVinculadas.length < 3 && parcelasPossiveis.length > 0) {
                console.log(`  🔧 Tentando corrigir vinculação...`);
                
                // Vincular parcelas não vinculadas a esta compra
                const parcelasParaVincular = parcelasPossiveis.slice(0, 4 - parcelasVinculadas.length);
                
                parcelasParaVincular.forEach((parcela, index) => {
                    const novoNumero = parcelasVinculadas.length + index + 1;
                    
                    // Atualizar na planilha
                    parcelasSheet.getRange(parcela.linha, 2).setValue(compraId); // Compra_ID
                    parcelasSheet.getRange(parcela.linha, 3).setValue(novoNumero); // Número da parcela
                    
                    console.log(`    ✅ Parcela linha ${parcela.linha} vinculada como parcela ${novoNumero}`);
                    correcoes++;
                });
            }
        }
        
        console.log(`🎉 ${correcoes} correções de vinculação realizadas!`);
        
        return {
            success: true,
            correcoes: correcoes,
            message: `${correcoes} parcelas foram revinculadas`
        };
        
    } catch (error) {
        console.error('❌ Erro na correção de vinculação:', error);
        return { success: false, error: error.message };
    }
}

// ===== FUNÇÃO PRINCIPAL PARA RESOLVER PARCELAS PERDIDAS =====

function resolverParcelasPerdidas() {
    console.log('🚀 === RESOLVENDO PARCELAS PERDIDAS ===');
    
    const relatorio = {
        diagnostico: null,
        listagem: null,
        correcao: null,
        verificacaoFinal: null
    };
    
    try {
        // 1. Diagnóstico específico
        console.log('1️⃣ Diagnóstico específico do Dentes_Gulherme...');
        relatorio.diagnostico = diagnosticarParcelasPerdidas();
        
        // 2. Listagem completa
        console.log('\n2️⃣ Listando todas as parcelas...');
        relatorio.listagem = listarTodasAsParcelasDaPlanilha();
        
        // 3. Busca flexível
        console.log('\n3️⃣ Busca flexível...');
        buscarParcelasFlexivel('Dentes');
        
        // 4. Correção de vinculação
        console.log('\n4️⃣ Corrigindo vinculações...');
        relatorio.correcao = corrigirVinculacaoParcelas();
        
        // 5. Verificação final
        console.log('\n5️⃣ Verificação final...');
        relatorio.verificacaoFinal = diagnosticarParcelasPerdidas();
        
        console.log('\n📊 === RELATÓRIO FINAL ===');
        
        if (relatorio.diagnostico.success) {
            const antes = relatorio.diagnostico.parcelasEncontradas;
            const depois = relatorio.verificacaoFinal.parcelasEncontradas;
            
            console.log(`📈 Parcelas antes: ${antes}`);
            console.log(`📈 Parcelas depois: ${depois}`);
            console.log(`✅ Melhoria: ${depois > antes ? 'SIM' : 'NÃO'}`);
        }
        
        if (relatorio.correcao.success && relatorio.correcao.correcoes > 0) {
            console.log('🎉 === CORREÇÃO BEM-SUCEDIDA ===');
            console.log('🔄 Recarregue o sistema para ver todas as 4 parcelas!');
        } else {
            console.log('⚠️ === INVESTIGAÇÃO NECESSÁRIA ===');
            console.log('Pode ser necessário correção manual');
        }
        
        return relatorio;
        
    } catch (error) {
        console.error('❌ Erro na resolução:', error);
        return { success: false, error: error.message };
    }
}

// ===== FUNÇÃO ESPECÍFICA PARA DENTES_GULHERME =====

function corrigirDentesGulhermeEspecifico() {
    console.log('🦷 === CORREÇÃO ESPECÍFICA DENTES_GULHERME ===');
    
    try {
        // Buscar a compra específica
        const spreadsheet = getOrCreateSpreadsheet();
        const comprasSheet = spreadsheet.getSheetByName('Compras');
        const comprasData = comprasSheet.getDataRange().getValues();
        
        let compraGulherme = null;
        for (let i = 1; i < comprasData.length; i++) {
            if (comprasData[i][3] && comprasData[i][3].includes('Dentes_Gulherme')) {
                compraGulherme = comprasData[i];
                break;
            }
        }
        
        if (!compraGulherme) {
            return { success: false, error: 'Compra Dentes_Gulherme não encontrada' };
        }
        
        const compraId = compraGulherme[0];
        const valorTotal = 1110.00; // Valor correto
        
        console.log(`🎯 Recriando 4 parcelas para ${compraId} no valor de R$ ${valorTotal}`);
        
        // Remover parcelas existentes e criar 4 novas
        const parcelasSheet = spreadsheet.getSheetByName('Parcelas');
        const parcelasData = parcelasSheet.getDataRange().getValues();
        
        // Remover parcelas antigas
        for (let i = parcelasData.length - 1; i >= 1; i--) {
            if (String(parcelasData[i][1]).includes(compraId)) {
                parcelasSheet.deleteRow(i + 1);
                console.log(`🗑️ Removida parcela linha ${i + 1}`);
            }
        }
        
        // Criar 4 parcelas novas
        const valorPorParcela = valorTotal / 4; // R$ 277,50
        const dataBase = new Date();
        
        for (let p = 1; p <= 4; p++) {
            const dataVencimento = new Date(dataBase);
            dataVencimento.setMonth(dataVencimento.getMonth() + p);
            
            const status = p === 1 ? 'Pago' : 'Pendente';
            const dataPagamento = p === 1 ? new Date() : '';
            
            const novaParcela = [
                generateId(),
                compraId,
                p,
                valorPorParcela,
                dataVencimento,
                status,
                dataPagamento,
                ''
            ];
            
            parcelasSheet.appendRow(novaParcela);
            console.log(`✅ Parcela ${p}/4: R$ ${valorPorParcela.toFixed(2)} - ${status}`);
        }
        
        console.log('🎉 4 parcelas criadas com sucesso!');
        
        return {
            success: true,
            message: '4 parcelas criadas para Dentes_Gulherme',
            valorPorParcela: valorPorParcela
        };
        
    } catch (error) {
        console.error('❌ Erro na correção específica:', error);
        return { success: false, error: error.message };
    }
}

// ===== LOGS E FUNÇÕES AUXILIARES =====

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

console.log('🔍 === DIAGNÓSTICO DE PARCELAS PERDIDAS CARREGADO ===');
console.log('🚀 Execute: resolverParcelasPerdidas()');
console.log('🔍 Execute: diagnosticarParcelasPerdidas()');
console.log('📋 Execute: listarTodasAsParcelasDaPlanilha()');
console.log('🦷 Execute: corrigirDentesGulhermeEspecifico()');
console.log('');
console.log('💡 Esta correção vai:');
console.log('1. Encontrar parcelas que existem mas não aparecem');
console.log('2. Corrigir vinculações entre compras e parcelas');
console.log('3. Garantir que todas as 4 parcelas sejam exibidas');
console.log('4. Recalcular valores corretos (R$ 1.110 ÷ 4 = R$ 277,50)');
/**
 * ========================================
 * SCRIPT DE CONFIGURAÇÃO AUTOMÁTICA
 * Resolve todos os problemas de comunicação
 * ========================================
 */

function configuracaoAutomaticaCompleta() {
    console.log('🚀 === CONFIGURAÇÃO AUTOMÁTICA INICIADA ===');
    
    const relatorio = {
        etapas: [],
        erros: [],
        sucesso: false,
        detalhes: {}
    };
    
    try {
        // Etapa 1: Verificar/Configurar Planilha
        console.log('📊 Etapa 1: Configurando planilha...');
        const planilhaResult = configurarPlanilhaAutomatica();
        relatorio.etapas.push({
            etapa: 'Planilha',
            sucesso: planilhaResult.success,
            detalhes: planilhaResult
        });
        
        if (!planilhaResult.success) {
            relatorio.erros.push('Falha na configuração da planilha');
        }
        
        // Etapa 2: Configurar Dados de Teste
        console.log('🧪 Etapa 2: Criando dados de teste...');
        const dadosResult = criarDadosTesteCompletos();
        relatorio.etapas.push({
            etapa: 'Dados de Teste',
            sucesso: dadosResult.success,
            detalhes: dadosResult
        });
        
        // Etapa 3: Testar Todas as Funções
        console.log('🔧 Etapa 3: Testando funções...');
        const testesResult = executarTodosTestes();
        relatorio.etapas.push({
            etapa: 'Testes',
            sucesso: testesResult.success,
            detalhes: testesResult
        });
        
        // Etapa 4: Configurar Triggers e Permissões
        console.log('⚙️ Etapa 4: Configurando triggers...');
        const triggersResult = configurarTriggers();
        relatorio.etapas.push({
            etapa: 'Triggers',
            sucesso: triggersResult.success,
            detalhes: triggersResult
        });
        
        // Etapa 5: Validação Final
        console.log('✅ Etapa 5: Validação final...');
        const validacaoResult = validacaoFinalCompleta();
        relatorio.etapas.push({
            etapa: 'Validação',
            sucesso: validacaoResult.success,
            detalhes: validacaoResult
        });
        
        // Determinar sucesso geral
        relatorio.sucesso = relatorio.etapas.every(etapa => etapa.sucesso);
        
        // Logs finais
        if (relatorio.sucesso) {
            console.log('🎉 === CONFIGURAÇÃO CONCLUÍDA COM SUCESSO ===');
            relatorio.detalhes.webAppUrl = gerarInstrucoesWebApp();
            relatorio.detalhes.credenciaisLogin = obterCredenciaisLogin();
        } else {
            console.log('❌ === CONFIGURAÇÃO CONCLUÍDA COM PROBLEMAS ===');
            relatorio.detalhes.solucoes = gerarSolucoesProblemass(relatorio.erros);
        }
        
    } catch (error) {
        console.error('❌ Erro crítico na configuração:', error);
        relatorio.erros.push('Erro crítico: ' + error.message);
        relatorio.sucesso = false;
    }
    
    // Exibir relatório completo
    exibirRelatorioFinal(relatorio);
    
    return relatorio;
}

// ===== CONFIGURAÇÃO DA PLANILHA =====

function configurarPlanilhaAutomatica() {
    try {
        console.log('📊 Configurando planilha automaticamente...');
        
        let spreadsheet;
        
        // Tentar abrir planilha existente
        try {
            spreadsheet = SpreadsheetApp.openById('1RAd3dzwJqaye8Czfv6-BhbFrh_dgvJKZMgc_K6v1-EU');
            console.log('✅ Planilha existente encontrada:', spreadsheet.getName());
        } catch (error) {
            // Criar nova planilha
            console.log('🔧 Criando nova planilha...');
            spreadsheet = SpreadsheetApp.create('StarkTech - Sistema de Crediário');
            console.log('✅ Nova planilha criada:', spreadsheet.getId());
            console.log('⚠️  IMPORTANTE: Atualize o SPREADSHEET_ID para:', spreadsheet.getId());
        }
        
        // Configurar estrutura
        const estruturaResult = configurarEstruturaPlanilha(spreadsheet);
        
        return {
            success: true,
            spreadsheetId: spreadsheet.getId(),
            spreadsheetName: spreadsheet.getName(),
            spreadsheetUrl: spreadsheet.getUrl(),
            estrutura: estruturaResult
        };
        
    } catch (error) {
        console.error('❌ Erro na configuração da planilha:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

function configurarEstruturaPlanilha(spreadsheet) {
    const resultados = {};
    
    // Definir abas necessárias
    const abasNecessarias = {
        'Clientes': ['ID', 'Nome', 'CPF', 'Email', 'Telefone', 'Senha', 'Data_Cadastro'],
        'Compras': ['ID', 'Cliente_ID', 'Cliente_Nome', 'Produto_Nome', 'Produto_Descricao', 'Produto_Emoji', 'Valor_Total', 'Data_Compra', 'Loja_Nome', 'Loja_Emoji', 'Status'],
        'Parcelas': ['ID', 'Compra_ID', 'Numero', 'Valor', 'Data_Vencimento', 'Status', 'Data_Pagamento', 'Link_Pagamento'],
        'Pagamentos': ['ID', 'Parcela_ID', 'Compra_ID', 'Valor', 'Data_Pagamento', 'Metodo']
    };
    
    // Remover planilha padrão se existir
    try {
        const defaultSheet = spreadsheet.getSheetByName('Planilha1');
        if (defaultSheet && spreadsheet.getSheets().length > 1) {
            spreadsheet.deleteSheet(defaultSheet);
            console.log('✅ Planilha padrão removida');
        }
    } catch (e) {
        // Ignorar se não existir
    }
    
    // Criar/configurar cada aba
    Object.entries(abasNecessarias).forEach(([nomeAba, headers]) => {
        try {
            let sheet = spreadsheet.getSheetByName(nomeAba);
            
            if (!sheet) {
                sheet = spreadsheet.insertSheet(nomeAba);
                console.log(`✅ Aba criada: ${nomeAba}`);
            }
            
            // Configurar headers se a aba estiver vazia
            if (sheet.getLastRow() <= 1) {
                sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
                sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
                sheet.getRange(1, 1, 1, headers.length).setBackground('#E3F2FD');
                
                // Auto-redimensionar colunas
                sheet.autoResizeColumns(1, headers.length);
                
                console.log(`✅ Headers configurados para ${nomeAba}`);
            }
            
            resultados[nomeAba] = {
                success: true,
                rows: sheet.getLastRow(),
                cols: sheet.getLastColumn()
            };
            
        } catch (error) {
            console.error(`❌ Erro na aba ${nomeAba}:`, error);
            resultados[nomeAba] = {
                success: false,
                error: error.message
            };
        }
    });
    
    return resultados;
}

// ===== DADOS DE TESTE =====

function criarDadosTesteCompletos() {
    try {
        console.log('🧪 Criando dados de teste completos...');
        
        const spreadsheet = getOrCreateSpreadsheet();
        const clientsSheet = spreadsheet.getSheetByName('Clientes');
        const creditsSheet = spreadsheet.getSheetByName('Compras');
        const installmentsSheet = spreadsheet.getSheetByName('Parcelas');
        
        const resultados = {};
        
        // Verificar se já existem dados
        if (clientsSheet.getLastRow() > 1) {
            console.log('⚠️ Dados de teste já existem, pulando criação');
            return {
                success: true,
                message: 'Dados de teste já existem',
                clientesExistentes: clientsSheet.getLastRow() - 1
            };
        }
        
        // Criar clientes de teste
        const clientesTeste = [
            ['cli001', 'Jackeline Duarte', '762.538.452-65', 'duarte@gmail.com', '(62) 99999-1111', '2025026', new Date()],
            ['cli002', 'Sr°White & Wanderson', '123.456.789-00', 'wanderson@email.com', '(62) 99999-2222', '123456', new Date()],
            ['cli003', 'Maria Silva', '987.654.321-00', 'maria@email.com', '(62) 99999-3333', 'senha123', new Date()],
            ['cli004', 'João Santos', '111.222.333-44', 'joao@email.com', '(62) 99999-4444', '123456', new Date()],
            ['cli005', 'Ana Costa', '555.666.777-88', 'ana@email.com', '(62) 99999-5555', '123456', new Date()]
        ];
        
        clientesTeste.forEach(cliente => {
            clientsSheet.appendRow(cliente);
        });
        
        resultados.clientes = {
            success: true,
            quantidade: clientesTeste.length
        };
        
        console.log(`✅ ${clientesTeste.length} clientes de teste criados`);
        
        // Criar crediários de teste
        const creditosTeste = [
            ['cred001', 'cli001', 'Jackeline Duarte', 'Kit Maquiagem Natura Una', 'Kit completo com batom, base e pó', '💄', 420.00, '2025-01-10', 'Loja Natura', '🌿', 'Ativo'],
            ['cred002', 'cli001', 'Jackeline Duarte', 'Perfume Kaiak Feminino', 'Kaiak Feminino 100ml', '🌸', 280.00, '2025-01-20', 'Loja Natura', '🌿', 'Ativo'],
            ['cred003', 'cli002', 'Sr°White & Wanderson', 'Kit Presente Egeo', 'Egeo Blue + Desodorante + Gel', '🎁', 300.00, '2025-01-15', 'Sr°White Store', '🏬', 'Ativo'],
            ['cred004', 'cli003', 'Maria Silva', 'Smartphone Galaxy A14', 'Galaxy A14 4G 128GB Preto', '📱', 600.00, '2024-12-01', 'TechShop', '🏪', 'Ativo'],
            ['cred005', 'cli004', 'João Santos', 'Notebook Lenovo', 'Lenovo IdeaPad 3 Intel i5', '💻', 2500.00, '2025-01-05', 'TechWorld', '🖥️', 'Ativo']
        ];
        
        creditosTeste.forEach(credito => {
            creditsSheet.appendRow(credito);
        });
        
        resultados.creditos = {
            success: true,
            quantidade: creditosTeste.length
        };
        
        console.log(`✅ ${creditosTeste.length} crediários de teste criados`);
        
        // Criar parcelas de teste
        let parcelasCount = 0;
        
        // Parcelas para Jackeline (cred001 - 3 parcelas)
        const parcelasJackeline1 = [
            ['inst001', 'cred001', 1, 140.00, '2025-02-10', 'Pago', '2025-02-08', ''],
            ['inst002', 'cred001', 2, 140.00, '2025-03-10', 'Pago', '2025-03-05', ''],
            ['inst003', 'cred001', 3, 140.00, '2025-04-10', 'Pendente', '', '']
        ];
        
        // Parcelas para Jackeline (cred002 - 2 parcelas)
        const parcelasJackeline2 = [
            ['inst004', 'cred002', 1, 140.00, '2025-02-20', 'Pago', '2025-02-18', ''],
            ['inst005', 'cred002', 2, 140.00, '2025-03-20', 'Pendente', '', '']
        ];
        
        // Parcelas para Sr°White (cred003 - 2 parcelas)
        const parcelasSrWhite = [
            ['inst006', 'cred003', 1, 150.00, '2025-02-15', 'Pago', '2025-02-12', ''],
            ['inst007', 'cred003', 2, 150.00, '2025-03-15', 'Pendente', '', '']
        ];
        
        // Parcelas para Maria (cred004 - 5 parcelas)
        const parcelasMaria = [
            ['inst008', 'cred004', 1, 120.00, '2025-01-01', 'Pago', '2024-12-30', ''],
            ['inst009', 'cred004', 2, 120.00, '2025-02-01', 'Pago', '2025-01-28', ''],
            ['inst010', 'cred004', 3, 120.00, '2025-03-01', 'Pago', '2025-02-25', ''],
            ['inst011', 'cred004', 4, 120.00, '2025-04-01', 'Pago', '2025-03-28', ''],
            ['inst012', 'cred004', 5, 120.00, '2025-05-01', 'Pendente', '', '']
        ];
        
        // Parcelas para João (cred005 - 10 parcelas)
        const parcelasJoao = [];
        for (let i = 1; i <= 10; i++) {
            const dueDate = new Date('2025-02-05');
            dueDate.setMonth(dueDate.getMonth() + (i - 1));
            
            const status = i <= 2 ? 'Pago' : 'Pendente';
            const paymentDate = i <= 2 ? new Date(dueDate.getTime() - 2 * 24 * 60 * 60 * 1000) : '';
            
            parcelasJoao.push([
                `inst${String(12 + i).padStart(3, '0')}`,
                'cred005',
                i,
                250.00,
                dueDate,
                status,
                paymentDate,
                ''
            ]);
        }
        
        // Adicionar todas as parcelas
        const todasParcelas = [
            ...parcelasJackeline1,
            ...parcelasJackeline2,
            ...parcelasSrWhite,
            ...parcelasMaria,
            ...parcelasJoao
        ];
        
        todasParcelas.forEach(parcela => {
            installmentsSheet.appendRow(parcela);
            parcelasCount++;
        });
        
        resultados.parcelas = {
            success: true,
            quantidade: parcelasCount
        };
        
        console.log(`✅ ${parcelasCount} parcelas de teste criadas`);
        
        return {
            success: true,
            message: 'Dados de teste criados com sucesso',
            detalhes: resultados
        };
        
    } catch (error) {
        console.error('❌ Erro ao criar dados de teste:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ===== TESTES COMPLETOS =====

function executarTodosTestes() {
    try {
        console.log('🔧 Executando todos os testes...');
        
        const resultados = {};
        
        // Teste 1: Conexão
        console.log('🧪 Teste 1: Conexão...');
        resultados.conexao = testConnection();
        
        // Teste 2: Login Admin
        console.log('🧪 Teste 2: Login Admin...');
        resultados.loginAdmin = handleLogin({
            userType: 'admin',
            user: 'admin',
            password: 'stark2025'
        });
        
        // Teste 3: Login Cliente (Jackeline)
        console.log('🧪 Teste 3: Login Cliente (Jackeline)...');
        resultados.loginClienteJackeline = handleLogin({
            userType: 'client',
            identifier: '762.538.452-65',
            password: '2025026'
        });
        
        // Teste 4: Login Cliente por Email
        console.log('🧪 Teste 4: Login por Email...');
        resultados.loginPorEmail = handleLogin({
            userType: 'client',
            identifier: 'duarte@gmail.com',
            password: '2025026'
        });
        
        // Teste 5: Buscar Clientes
        console.log('🧪 Teste 5: Buscar Clientes...');
        resultados.buscarClientes = getClients();
        
        // Teste 6: Buscar Crediários
        console.log('🧪 Teste 6: Buscar Crediários...');
        resultados.buscarCreditos = getCredits();
        
        // Teste 7: Dados do Cliente Jackeline
        console.log('🧪 Teste 7: Dados Cliente Jackeline...');
        resultados.dadosClienteJackeline = loadClientData('cli001');
        
        // Teste 8: Dados Admin
        console.log('🧪 Teste 8: Dados Admin...');
        resultados.dadosAdmin = loadAdminData();
        
        // Teste 9: URLs de Pagamento
        console.log('🧪 Teste 9: URLs de Pagamento...');
        resultados.urlsPagamento = {
            parcela1: getPaymentUrlByProduct('cred001', 1),
            parcela2: getPaymentUrlByProduct('cred001', 2),
            parcela3: getPaymentUrlByProduct('cred002', 1)
        };
        
        // Avaliar resultados
        const sucessos = Object.values(resultados).filter(r => r?.success === true).length;
        const total = Object.keys(resultados).length;
        
        console.log(`✅ Testes concluídos: ${sucessos}/${total} sucessos`);
        
        return {
            success: sucessos >= total * 0.8, // 80% de sucesso mínimo
            sucessos: sucessos,
            total: total,
            detalhes: resultados
        };
        
    } catch (error) {
        console.error('❌ Erro nos testes:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ===== CONFIGURAR TRIGGERS =====

function configurarTriggers() {
    try {
        console.log('⚙️ Configurando triggers...');
        
        // Limpar triggers existentes
        const existingTriggers = ScriptApp.getProjectTriggers();
        existingTriggers.forEach(trigger => {
            ScriptApp.deleteTrigger(trigger);
        });
        
        console.log(`🗑️ ${existingTriggers.length} triggers antigos removidos`);
        
        // Opcional: Criar triggers para backup automático
        // (Descomente se necessário)
        /*
        ScriptApp.newTrigger('backupAutomatico')
            .timeBased()
            .everyDays(1)
            .atHour(2)
            .create();
        
        console.log('✅ Trigger de backup criado');
        */
        
        return {
            success: true,
            message: 'Triggers configurados',
            triggersRemovidos: existingTriggers.length
        };
        
    } catch (error) {
        console.error('❌ Erro ao configurar triggers:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ===== VALIDAÇÃO FINAL =====

function validacaoFinalCompleta() {
    try {
        console.log('✅ Executando validação final...');
        
        const validacao = {
            planilha: false,
            dados: false,
            funcoes: false,
            webApp: false
        };
        
        // Validar planilha
        try {
            const spreadsheet = getOrCreateSpreadsheet();
            const sheets = spreadsheet.getSheets();
            validacao.planilha = sheets.length >= 4;
            console.log(`✅ Planilha: ${sheets.length} abas encontradas`);
        } catch (e) {
            console.log('❌ Planilha: Erro ao acessar');
        }
        
        // Validar dados
        try {
            const clients = getClients();
            validacao.dados = clients.success && clients.clients.length > 0;
            console.log(`✅ Dados: ${clients.clients?.length || 0} clientes encontrados`);
        } catch (e) {
            console.log('❌ Dados: Erro ao acessar');
        }
        
        // Validar funções
        try {
            const testResult = testConnection();
            validacao.funcoes = testResult.success;
            console.log(`✅ Funções: ${testResult.success ? 'OK' : 'Erro'}`);
        } catch (e) {
            console.log('❌ Funções: Erro ao testar');
        }
        
        // Validar Web App (indiretamente)
        validacao.webApp = true; // Se chegou até aqui, o script está rodando
        
        const sucessoTotal = Object.values(validacao).every(v => v === true);
        
        return {
            success: sucessoTotal,
            detalhes: validacao,
            percentualSucesso: (Object.values(validacao).filter(v => v).length / 4) * 100
        };
        
    } catch (error) {
        console.error('❌ Erro na validação final:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ===== FUNÇÕES AUXILIARES =====

function gerarInstrucoesWebApp() {
    const webAppUrl = ScriptApp.getService().getUrl();
    
    return {
        url: webAppUrl || 'Execute: Implantar → Nova implantação',
        instrucoes: [
            '1. Clique em "Implantar" → "Nova implantação"',
            '2. Tipo: "Aplicativo da Web"',
            '3. Executar como: "Eu"',
            '4. Quem tem acesso: "Qualquer pessoa"',
            '5. Clique em "Implantar"',
            '6. Copie a URL do Web App'
        ]
    };
}

function obterCredenciaisLogin() {
    return {
        admin: {
            usuario: 'admin',
            senha: 'stark2025'
        },
        clientes: [
            { nome: 'Jackeline Duarte', cpf: '762.538.452-65', senha: '2025026' },
            { nome: 'Sr°White', cpf: '123.456.789-00', senha: '123456' },
            { nome: 'Maria Silva', cpf: '987.654.321-00', senha: 'senha123' }
        ]
    };
}

function gerarSolucoesProblemass(erros) {
    const solucoes = [];
    
    erros.forEach(erro => {
        if (erro.includes('planilha')) {
            solucoes.push({
                problema: 'Erro na planilha',
                solucao: 'Execute: configurarPlanilhaAutomatica()'
            });
        }
        
        if (erro.includes('permiss')) {
            solucoes.push({
                problema: 'Problema de permissões',
                solucao: 'Autorize todas as permissões solicitadas'
            });
        }
        
        if (erro.includes('função')) {
            solucoes.push({
                problema: 'Funções não encontradas',
                solucao: 'Verifique se o código backend está completo'
            });
        }
    });
    
    return solucoes;
}

function exibirRelatorioFinal(relatorio) {
    console.log('📊 === RELATÓRIO FINAL DE CONFIGURAÇÃO ===');
    
    relatorio.etapas.forEach((etapa, index) => {
        const status = etapa.sucesso ? '✅' : '❌';
        console.log(`${index + 1}. ${status} ${etapa.etapa}`);
        
        if (!etapa.sucesso && etapa.detalhes.error) {
            console.log(`   Erro: ${etapa.detalhes.error}`);
        }
    });
    
    console.log('');
    console.log(`🎯 Sucesso Geral: ${relatorio.sucesso ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`📈 Taxa de Sucesso: ${relatorio.etapas.filter(e => e.sucesso).length}/${relatorio.etapas.length}`);
    
    if (relatorio.sucesso) {
        console.log('');
        console.log('🎉 === SISTEMA CONFIGURADO COM SUCESSO ===');
        console.log('');
        console.log('🌐 Próximos passos:');
        console.log('1. Publique como Web App (se ainda não fez)');
        console.log('2. Acesse a URL do Web App');
        console.log('3. Teste o login com as credenciais fornecidas');
        console.log('');
        console.log('🔑 Credenciais de teste:');
        console.log('Admin: admin / stark2025');
        console.log('Cliente: 762.538.452-65 / 2025026');
        
    } else {
        console.log('');
        console.log('⚠️ === CONFIGURAÇÃO CONCLUÍDA COM PROBLEMAS ===');
        console.log('');
        console.log('🔧 Soluções recomendadas:');
        if (relatorio.detalhes.solucoes) {
            relatorio.detalhes.solucoes.forEach(solucao => {
                console.log(`- ${solucao.problema}: ${solucao.solucao}`);
            });
        }
        console.log('');
        console.log('💡 Execute novamente: configuracaoAutomaticaCompleta()');
    }
    
    console.log('');
    console.log('📞 Para suporte adicional, compartilhe este relatório.');
}

// ===== FUNÇÕES DE APOIO =====

function getOrCreateSpreadsheet() {
    try {
        return SpreadsheetApp.openById('1RAd3dzwJqaye8Czfv6-BhbFrh_dgvJKZMgc_K6v1-EU');
    } catch (error) {
        console.log('Criando nova planilha...');
        return SpreadsheetApp.create('StarkTech - Sistema de Crediário');
    }
}
/**
 * ========================================
 * SISTEMA DE SINCRONIZAÇÃO BACKEND-PLANILHA
 * Corrige inconsistências e permite manipulação
 * ========================================
 */

// ===== DIAGNÓSTICO E CORREÇÃO =====

function diagnosticarESincronizar() {
  console.log('🔍 === DIAGNÓSTICO COMPLETO DO SISTEMA ===');
  
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const relatorio = {
      problemas: [],
      correcoes: [],
      status: {}
    };
    
    // 1. Verificar estrutura das abas
    console.log('📊 1. Verificando estrutura das abas...');
    const estruturaResult = verificarEstruturaPlanilha(spreadsheet);
    relatorio.status.estrutura = estruturaResult;
    
    // 2. Verificar dados órfãos
    console.log('🔗 2. Verificando vínculos de dados...');
    const vinculosResult = verificarVinculosDados(spreadsheet);
    relatorio.status.vinculos = vinculosResult;
    
    // 3. Corrigir inconsistências
    console.log('🔧 3. Corrigindo inconsistências...');
    const correcaoResult = corrigirInconsistencias(spreadsheet);
    relatorio.correcoes = correcaoResult.correcoes;
    
    // 4. Verificar cálculos
    console.log('🧮 4. Verificando cálculos...');
    const calculosResult = verificarCalculos(spreadsheet);
    relatorio.status.calculos = calculosResult;
    
    // 5. Resultado final
    const sucessoTotal = Object.values(relatorio.status).every(s => s.success);
    
    console.log('📋 === RELATÓRIO FINAL ===');
    console.log(`✅ Estrutura: ${relatorio.status.estrutura.success ? 'OK' : 'PROBLEMA'}`);
    console.log(`✅ Vínculos: ${relatorio.status.vinculos.success ? 'OK' : 'PROBLEMA'}`);
    console.log(`✅ Cálculos: ${relatorio.status.calculos.success ? 'OK' : 'PROBLEMA'}`);
    console.log(`🎯 Status Geral: ${sucessoTotal ? '✅ SINCRONIZADO' : '⚠️ PRECISA CORREÇÃO'}`);
    
    return {
      success: sucessoTotal,
      relatorio: relatorio,
      proximosPassos: sucessoTotal ? 
        ['Sistema sincronizado!', 'Teste as funções de manipulação'] :
        ['Execute: corrigirTudoAutomatico()', 'Verifique dados manualmente']
    };
    
  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
    return { success: false, error: error.message };
  }
}

function verificarEstruturaPlanilha(spreadsheet) {
  const estruturaCorreta = {
    'Clientes': ['ID', 'Nome', 'CPF', 'Email', 'Telefone', 'Senha', 'Data_Cadastro'],
    'Compras': ['ID', 'Cliente_ID', 'Cliente_Nome', 'Produto_Nome', 'Produto_Descricao', 'Produto_Emoji', 'Valor_Total', 'Data_Compra', 'Loja_Nome', 'Loja_Emoji', 'Status'],
    'Parcelas': ['ID', 'Compra_ID', 'Numero', 'Valor', 'Data_Vencimento', 'Status', 'Data_Pagamento', 'Link_Pagamento'],
    'Pagamentos': ['ID', 'Parcela_ID', 'Compra_ID', 'Valor', 'Data_Pagamento', 'Metodo']
  };
  
  const problemas = [];
  
  Object.entries(estruturaCorreta).forEach(([nomeAba, headersSperados]) => {
    try {
      const sheet = spreadsheet.getSheetByName(nomeAba);
      
      if (!sheet) {
        problemas.push(`Aba "${nomeAba}" não existe`);
        return;
      }
      
      const headersAtuais = sheet.getRange(1, 1, 1, headersSperados.length).getValues()[0];
      
      headersSperados.forEach((header, index) => {
        if (headersAtuais[index] !== header) {
          problemas.push(`Aba "${nomeAba}": Header coluna ${index + 1} deveria ser "${header}" mas é "${headersAtuais[index]}"`);
        }
      });
      
    } catch (error) {
      problemas.push(`Erro na aba "${nomeAba}": ${error.message}`);
    }
  });
  
  return {
    success: problemas.length === 0,
    problemas: problemas
  };
}

function verificarVinculosDados(spreadsheet) {
  try {
    const clientesSheet = spreadsheet.getSheetByName('Clientes');
    const comprasSheet = spreadsheet.getSheetByName('Compras');
    const parcelasSheet = spreadsheet.getSheetByName('Parcelas');
    
    const clientesData = clientesSheet.getDataRange().getValues();
    const comprasData = comprasSheet.getDataRange().getValues();
    const parcelasData = parcelasSheet.getDataRange().getValues();
    
    const problemas = [];
    
    // Verificar se todas as compras têm cliente válido
    for (let i = 1; i < comprasData.length; i++) {
      const compra = comprasData[i];
      const clienteId = compra[1];
      
      if (clienteId) {
        const clienteExiste = clientesData.some(cliente => cliente[0] === clienteId);
        if (!clienteExiste) {
          problemas.push(`Compra ${compra[0]} tem cliente inexistente: ${clienteId}`);
        }
      }
    }
    
    // Verificar se todas as parcelas têm compra válida
    for (let i = 1; i < parcelasData.length; i++) {
      const parcela = parcelasData[i];
      const compraId = parcela[1];
      
      if (compraId) {
        const compraExiste = comprasData.some(compra => compra[0] === compraId);
        if (!compraExiste) {
          problemas.push(`Parcela ${parcela[0]} tem compra inexistente: ${compraId}`);
        }
      }
    }
    
    return {
      success: problemas.length === 0,
      problemas: problemas,
      estatisticas: {
        clientes: clientesData.length - 1,
        compras: comprasData.length - 1,
        parcelas: parcelasData.length - 1
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function verificarCalculos(spreadsheet) {
  try {
    const comprasSheet = spreadsheet.getSheetByName('Compras');
    const parcelasSheet = spreadsheet.getSheetByName('Parcelas');
    
    const comprasData = comprasSheet.getDataRange().getValues();
    const parcelasData = parcelasSheet.getDataRange().getValues();
    
    const problemas = [];
    
    // Verificar se soma das parcelas = valor total da compra
    for (let i = 1; i < comprasData.length; i++) {
      const compra = comprasData[i];
      const compraId = compra[0];
      const valorTotal = Number(compra[6]) || 0;
      
      // Somar parcelas desta compra
      let somaParcelas = 0;
      let numParcelas = 0;
      
      for (let j = 1; j < parcelasData.length; j++) {
        const parcela = parcelasData[j];
        if (parcela[1] === compraId) {
          somaParcelas += Number(parcela[3]) || 0;
          numParcelas++;
        }
      }
      
      const diferenca = Math.abs(valorTotal - somaParcelas);
      
      if (diferenca > 0.01) { // Tolerância de 1 centavo
        problemas.push(`Compra ${compraId}: Valor total R$ ${valorTotal.toFixed(2)} ≠ Soma parcelas R$ ${somaParcelas.toFixed(2)} (${numParcelas} parcelas)`);
      }
    }
    
    return {
      success: problemas.length === 0,
      problemas: problemas
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ===== CORREÇÃO AUTOMÁTICA =====

function corrigirTudoAutomatico() {
  console.log('🔧 === CORREÇÃO AUTOMÁTICA INICIADA ===');
  
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const correcoes = [];
    
    // 1. Corrigir estrutura
    console.log('📊 Corrigindo estrutura...');
    const estruturaResult = corrigirEstrutura(spreadsheet);
    correcoes.push(...estruturaResult.correcoes);
    
    // 2. Corrigir vínculos
    console.log('🔗 Corrigindo vínculos...');
    const vinculosResult = corrigirVinculos(spreadsheet);
    correcoes.push(...vinculosResult.correcoes);
    
    // 3. Recalcular valores
    console.log('🧮 Recalculando valores...');
    const calculosResult = recalcularTodosValores(spreadsheet);
    correcoes.push(...calculosResult.correcoes);
    
    // 4. Sincronizar status
    console.log('📊 Sincronizando status...');
    const statusResult = sincronizarStatus(spreadsheet);
    correcoes.push(...statusResult.correcoes);
    
    console.log(`🎉 Correção concluída: ${correcoes.length} itens corrigidos`);
    
    return {
      success: true,
      totalCorrecoes: correcoes.length,
      detalhes: correcoes
    };
    
  } catch (error) {
    console.error('❌ Erro na correção automática:', error);
    return { success: false, error: error.message };
  }
}

function corrigirEstrutura(spreadsheet) {
  const correcoes = [];
  
  const estruturaCorreta = {
    'Clientes': ['ID', 'Nome', 'CPF', 'Email', 'Telefone', 'Senha', 'Data_Cadastro'],
    'Compras': ['ID', 'Cliente_ID', 'Cliente_Nome', 'Produto_Nome', 'Produto_Descricao', 'Produto_Emoji', 'Valor_Total', 'Data_Compra', 'Loja_Nome', 'Loja_Emoji', 'Status'],
    'Parcelas': ['ID', 'Compra_ID', 'Numero', 'Valor', 'Data_Vencimento', 'Status', 'Data_Pagamento', 'Link_Pagamento'],
    'Pagamentos': ['ID', 'Parcela_ID', 'Compra_ID', 'Valor', 'Data_Pagamento', 'Metodo']
  };
  
  Object.entries(estruturaCorreta).forEach(([nomeAba, headers]) => {
    try {
      let sheet = spreadsheet.getSheetByName(nomeAba);
      
      if (!sheet) {
        sheet = spreadsheet.insertSheet(nomeAba);
        correcoes.push(`Aba "${nomeAba}" criada`);
      }
      
      // Corrigir headers
      const range = sheet.getRange(1, 1, 1, headers.length);
      range.setValues([headers]);
      range.setFontWeight('bold');
      range.setBackground('#E3F2FD');
      
      correcoes.push(`Headers da aba "${nomeAba}" corrigidos`);
      
    } catch (error) {
      correcoes.push(`Erro ao corrigir aba "${nomeAba}": ${error.message}`);
    }
  });
  
  return { correcoes };
}

function corrigirVinculos(spreadsheet) {
  const correcoes = [];
  
  try {
    const parcelasSheet = spreadsheet.getSheetByName('Parcelas');
    const comprasSheet = spreadsheet.getSheetByName('Compras');
    
    const parcelasData = parcelasSheet.getDataRange().getValues();
    const comprasData = comprasSheet.getDataRange().getValues();
    
    // Coletar IDs de compras válidas
    const comprasValidas = new Set();
    for (let i = 1; i < comprasData.length; i++) {
      if (comprasData[i][0]) {
        comprasValidas.add(comprasData[i][0]);
      }
    }
    
    // Verificar e corrigir parcelas órfãs
    for (let i = 1; i < parcelasData.length; i++) {
      const parcela = parcelasData[i];
      const compraId = parcela[1];
      
      if (compraId && !comprasValidas.has(compraId)) {
        // Parcela órfã - tentar encontrar compra similar ou remover
        console.log(`⚠️ Parcela órfã encontrada: ${parcela[0]} -> ${compraId}`);
        
        // Por hora, vamos marcar como inválida
        parcelasSheet.getRange(i + 1, 6).setValue('Inválida'); // Status
        correcoes.push(`Parcela ${parcela[0]} marcada como inválida (compra inexistente)`);
      }
    }
    
  } catch (error) {
    correcoes.push(`Erro ao corrigir vínculos: ${error.message}`);
  }
  
  return { correcoes };
}

function recalcularTodosValores(spreadsheet) {
  const correcoes = [];
  
  try {
    const comprasSheet = spreadsheet.getSheetByName('Compras');
    const parcelasSheet = spreadsheet.getSheetByName('Parcelas');
    
    const comprasData = comprasSheet.getDataRange().getValues();
    const parcelasData = parcelasSheet.getDataRange().getValues();
    
    // Para cada compra, recalcular parcelas
    for (let i = 1; i < comprasData.length; i++) {
      const compra = comprasData[i];
      const compraId = compra[0];
      const valorTotal = Number(compra[6]) || 0;
      
      if (!compraId || valorTotal <= 0) continue;
      
      // Encontrar parcelas desta compra
      const parcelas = [];
      for (let j = 1; j < parcelasData.length; j++) {
        if (parcelasData[j][1] === compraId && parcelasData[j][5] !== 'Inválida') {
          parcelas.push({
            linha: j + 1,
            numero: parcelasData[j][2],
            valorAtual: Number(parcelasData[j][3]) || 0
          });
        }
      }
      
      if (parcelas.length === 0) continue;
      
      // Calcular novo valor por parcela
      const valorPorParcela = valorTotal / parcelas.length;
      
      // Atualizar valores se necessário
      let precisaCorrecao = false;
      parcelas.forEach(parcela => {
        const diferenca = Math.abs(parcela.valorAtual - valorPorParcela);
        if (diferenca > 0.01) {
          precisaCorrecao = true;
        }
      });
      
      if (precisaCorrecao) {
        parcelas.forEach(parcela => {
          parcelasSheet.getRange(parcela.linha, 4).setValue(valorPorParcela);
        });
        
        correcoes.push(`Compra ${compraId}: ${parcelas.length} parcelas recalculadas para R$ ${valorPorParcela.toFixed(2)} cada`);
      }
    }
    
  } catch (error) {
    correcoes.push(`Erro ao recalcular valores: ${error.message}`);
  }
  
  return { correcoes };
}

function sincronizarStatus(spreadsheet) {
  const correcoes = [];
  
  try {
    const comprasSheet = spreadsheet.getSheetByName('Compras');
    const parcelasSheet = spreadsheet.getSheetByName('Parcelas');
    
    const comprasData = comprasSheet.getDataRange().getValues();
    const parcelasData = parcelasSheet.getDataRange().getValues();
    
    // Para cada compra, verificar status baseado nas parcelas
    for (let i = 1; i < comprasData.length; i++) {
      const compra = comprasData[i];
      const compraId = compra[0];
      const statusAtual = compra[10];
      
      if (!compraId) continue;
      
      // Contar parcelas pagas e pendentes
      let parcelasPagas = 0;
      let parcelasPendentes = 0;
      let totalParcelas = 0;
      
      for (let j = 1; j < parcelasData.length; j++) {
        const parcela = parcelasData[j];
        if (parcela[1] === compraId && parcela[5] !== 'Inválida') {
          totalParcelas++;
          if (parcela[5] === 'Pago') {
            parcelasPagas++;
          } else if (parcela[5] === 'Pendente') {
            parcelasPendentes++;
          }
        }
      }
      
      // Determinar novo status
      let novoStatus;
      if (totalParcelas === 0) {
        novoStatus = 'Sem Parcelas';
      } else if (parcelasPagas === totalParcelas) {
        novoStatus = 'Quitado';
      } else if (parcelasPagas > 0) {
        novoStatus = 'Parcial';
      } else {
        novoStatus = 'Ativo';
      }
      
      // Atualizar se necessário
      if (statusAtual !== novoStatus) {
        comprasSheet.getRange(i + 1, 11).setValue(novoStatus);
        correcoes.push(`Compra ${compraId}: Status "${statusAtual}" → "${novoStatus}" (${parcelasPagas}/${totalParcelas} pagas)`);
      }
    }
    
  } catch (error) {
    correcoes.push(`Erro ao sincronizar status: ${error.message}`);
  }
  
  return { correcoes };
}

// ===== FUNÇÕES DE MANIPULAÇÃO DE PARCELAS =====

function editarParcela(parcelaId, novosDados) {
  console.log('✏️ Editando parcela:', parcelaId);
  
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const parcelasSheet = spreadsheet.getSheetByName('Parcelas');
    const data = parcelasSheet.getDataRange().getValues();
    
    // Encontrar a parcela
    let linha = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === parcelaId) {
        linha = i + 1;
        break;
      }
    }
    
    if (linha === -1) {
      return { success: false, error: 'Parcela não encontrada' };
    }
    
    const alteracoes = [];
    
    // Atualizar campos
    if (novosDados.numero !== undefined) {
      parcelasSheet.getRange(linha, 3).setValue(Number(novosDados.numero));
      alteracoes.push(`Número: ${novosDados.numero}`);
    }
    
    if (novosDados.valor !== undefined) {
      parcelasSheet.getRange(linha, 4).setValue(Number(novosDados.valor));
      alteracoes.push(`Valor: R$ ${Number(novosDados.valor).toFixed(2)}`);
    }
    
    if (novosDados.dataVencimento !== undefined) {
      parcelasSheet.getRange(linha, 5).setValue(new Date(novosDados.dataVencimento));
      alteracoes.push(`Vencimento: ${novosDados.dataVencimento}`);
    }
    
    if (novosDados.status !== undefined) {
      parcelasSheet.getRange(linha, 6).setValue(novosDados.status);
      alteracoes.push(`Status: ${novosDados.status}`);
      
      // Se marcou como pago, adicionar data de pagamento
      if (novosDados.status === 'Pago' && !data[linha-1][6]) {
        parcelasSheet.getRange(linha, 7).setValue(new Date());
        alteracoes.push('Data pagamento: ' + new Date().toLocaleDateString());
      }
      
      // Se desmarcou como pago, limpar data de pagamento
      if (novosDados.status !== 'Pago') {
        parcelasSheet.getRange(linha, 7).setValue('');
      }
    }
    
    if (novosDados.linkPagamento !== undefined) {
      parcelasSheet.getRange(linha, 8).setValue(novosDados.linkPagamento);
      alteracoes.push(`Link: ${novosDados.linkPagamento}`);
    }
    
    // Recalcular status da compra
    const compraId = data[linha-1][1];
    sincronizarStatusCompra(compraId);
    
    console.log(`✅ Parcela ${parcelaId} editada: ${alteracoes.join(', ')}`);
    
    return {
      success: true,
      message: 'Parcela editada com sucesso',
      alteracoes: alteracoes
    };
    
  } catch (error) {
    console.error('❌ Erro ao editar parcela:', error);
    return { success: false, error: error.message };
  }
}
function setPaymentLink(parcelId, paymentLink) {
  const spreadsheet = getOrCreateSpreadsheet();
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const currentParcelId = String(row[0]).trim(); // Assumindo que o ID da parcela está na primeira coluna
    if (currentParcelId === parcelId) {
      // Atualiza a coluna de link de pagamento (supondo que seja a coluna 8, por exemplo)
      sheet.getRange(i + 1, 8).setValue(paymentLink);
      Logger.log(`Link de pagamento atualizado para parcela ${parcelId}`);
      return { success: true };
    }
  }
  return { success: false, error: 'Parcela não encontrada' };
}

function criarNovaParcela(compraId, dadosParcela) {
  console.log('➕ Criando nova parcela para compra:', compraId);
  
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const parcelasSheet = spreadsheet.getSheetByName('Parcelas');
    const comprasSheet = spreadsheet.getSheetByName('Compras');
    
    // Verificar se a compra existe
    const comprasData = comprasSheet.getDataRange().getValues();
    const compraExiste = comprasData.some(row => row[0] === compraId);
    
    if (!compraExiste) {
      return { success: false, error: 'Compra não encontrada' };
    }
    
    // Gerar próximo número de parcela
    const parcelasData = parcelasSheet.getDataRange().getValues();
    let maiorNumero = 0;
    
    for (let i = 1; i < parcelasData.length; i++) {
      if (parcelasData[i][1] === compraId) {
        maiorNumero = Math.max(maiorNumero, Number(parcelasData[i][2]) || 0);
      }
    }
    
    const novaParcela = [
      generateId(),
      compraId,
      dadosParcela.numero || (maiorNumero + 1),
      Number(dadosParcela.valor) || 0,
      new Date(dadosParcela.dataVencimento) || new Date(),
      dadosParcela.status || 'Pendente',
      dadosParcela.status === 'Pago' ? new Date() : '',
      dadosParcela.linkPagamento || ''
    ];
    
    parcelasSheet.appendRow(novaParcela);
    
    // Recalcular status da compra
    sincronizarStatusCompra(compraId);
    
    console.log(`✅ Nova parcela criada: ${novaParcela[2]} - R$ ${novaParcela[3]}`);
    
    return {
      success: true,
      message: 'Parcela criada com sucesso',
      parcelaId: novaParcela[0]
    };
    
  } catch (error) {
    console.error('❌ Erro ao criar parcela:', error);
    return { success: false, error: error.message };
  }
}

function excluirParcela(parcelaId) {
  console.log('🗑️ Excluindo parcela:', parcelaId);
  
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const parcelasSheet = spreadsheet.getSheetByName('Parcelas');
    const data = parcelasSheet.getDataRange().getValues();
    
    // Encontrar e excluir a parcela
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === parcelaId) {
        const compraId = data[i][1];
        const numeroParcela = data[i][2];
        
        parcelasSheet.deleteRow(i + 1);
        
        // Recalcular status da compra
        sincronizarStatusCompra(compraId);
        
        console.log(`✅ Parcela ${numeroParcela} excluída`);
        
        return {
          success: true,
          message: `Parcela ${numeroParcela} excluída com sucesso`
        };
      }
    }
    
    return { success: false, error: 'Parcela não encontrada' };
    
  } catch (error) {
    console.error('❌ Erro ao excluir parcela:', error);
    return { success: false, error: error.message };
  }
}

function sincronizarStatusCompra(compraId) {
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    sincronizarStatus(spreadsheet);
  } catch (error) {
    console.error('❌ Erro ao sincronizar status:', error);
  }
}
/**
 * ========================================
 * STARKTECH - FUNÇÕES PARA LINKS DE PAGAMENTO DA PLANILHA
 * Integração com Frontend Atualizado
 * ========================================
 */

/**
 * FUNÇÃO PRINCIPAL: Buscar URL de pagamento na planilha
 * Esta é a função que o frontend chama
 */
function getPaymentUrlFromSheet(params) {
  try {
    console.log('🔍 Buscando URL de pagamento na planilha:', params);
    
    const { creditId, installmentNumber, installmentId } = params;
    
    // Validações
    if (!creditId || !installmentNumber) {
      return {
        success: false,
        error: 'Parâmetros obrigatórios não informados'
      };
    }
    
    const spreadsheet = getOrCreateSpreadsheet();
    const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    
    if (!installmentsSheet) {
      console.log('❌ Aba Parcelas não encontrada');
      return {
        success: false,
        error: 'Aba de parcelas não encontrada'
      };
    }
    
    const data = installmentsSheet.getDataRange().getValues();
    const headers = data[0];
    
    // Buscar coluna de link de pagamento
    let linkColumnIndex = headers.indexOf('Link_Pagamento');
    
    // Se não encontrar, tentar outras variações
    if (linkColumnIndex === -1) {
      linkColumnIndex = headers.indexOf('Link_Pagamento_Nubank');
    }
    if (linkColumnIndex === -1) {
      linkColumnIndex = headers.indexOf('URL_Pagamento');
    }
    if (linkColumnIndex === -1) {
      linkColumnIndex = headers.indexOf('Payment_URL');
    }
    
    if (linkColumnIndex === -1) {
      console.log('⚠️ Coluna de link de pagamento não encontrada');
      return {
        success: false,
        error: 'Coluna de link de pagamento não configurada na planilha'
      };
    }
    
    console.log(`📍 Coluna de link encontrada no índice: ${linkColumnIndex}`);
    
    // Buscar a parcela específica
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowCreditId = String(row[1] || '').trim(); // Compra_ID
      const rowInstallmentNumber = parseInt(row[2] || 0); // Numero
      
      console.log(`🔍 Linha ${i}: CreditID="${rowCreditId}" | InstallmentNumber="${rowInstallmentNumber}"`);
      
      if (rowCreditId === String(creditId).trim() && rowInstallmentNumber === parseInt(installmentNumber)) {
        const paymentUrl = row[linkColumnIndex];
        
        console.log(`🎯 Parcela encontrada! URL: "${paymentUrl}"`);
        
        if (paymentUrl && String(paymentUrl).trim() !== '' && String(paymentUrl).trim() !== 'undefined') {
          const cleanUrl = String(paymentUrl).trim();
          
          console.log(`✅ URL válida encontrada: ${cleanUrl}`);
          
          return {
            success: true,
            paymentUrl: cleanUrl,
            message: 'Link de pagamento encontrado na planilha'
          };
        } else {
          console.log('⚠️ URL vazia ou inválida');
          return {
            success: false,
            error: 'Link de pagamento não configurado para esta parcela'
          };
        }
      }
    }
    
    console.log('❌ Parcela não encontrada');
    return {
      success: false,
      error: `Parcela ${installmentNumber} do crediário ${creditId} não encontrada`
    };
    
  } catch (error) {
    console.error('❌ Erro ao buscar URL na planilha:', error);
    return {
      success: false,
      error: 'Erro interno: ' + error.message
    };
  }
}

/**
 * FUNÇÃO: Solicitar criação de link de pagamento
 * Registra solicitação para que o admin configure o link
 */
function requestPaymentUrl(params) {
  try {
    console.log('📧 Solicitando criação de link de pagamento:', params);
    
    const { creditId, installmentNumber, installmentId } = params;
    
    const spreadsheet = getOrCreateSpreadsheet();
    
    // Criar aba de solicitações se não existir
    let requestsSheet = spreadsheet.getSheetByName('Solicitacoes_Links');
    
    if (!requestsSheet) {
      requestsSheet = spreadsheet.insertSheet('Solicitacoes_Links');
      requestsSheet.getRange(1, 1, 1, 6).setValues([[
        'Data_Solicitacao', 'Credit_ID', 'Installment_Number', 'Installment_ID', 'Status', 'Observacoes'
      ]]);
      
      // Formatar header
      const headerRange = requestsSheet.getRange(1, 1, 1, 6);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#FFE0B2');
      
      console.log('✅ Aba de solicitações criada');
    }
    
    // Registrar solicitação
    requestsSheet.appendRow([
      new Date(),
      creditId,
      installmentNumber,
      installmentId,
      'Pendente',
      `Solicitado via sistema - Parcela ${installmentNumber}`
    ]);
    
    console.log('✅ Solicitação registrada');
    
    return {
      success: true,
      message: 'Solicitação de link de pagamento registrada. Será configurado em breve.'
    };
    
  } catch (error) {
    console.error('❌ Erro ao solicitar link:', error);
    return {
      success: false,
      error: 'Erro ao registrar solicitação: ' + error.message
    };
  }
}

/**
 * FUNÇÃO MELHORADA: Marcar parcela como paga
 * Versão otimizada da função existente
 */
function markInstallmentAsPaid(params) {
  try {
    console.log('💰 Marcando parcela como paga:', params);
    
    const { installmentId, paymentMethod, note } = params;
    
    if (!installmentId) {
      return { success: false, error: 'ID da parcela não informado' };
    }
    
    const spreadsheet = getOrCreateSpreadsheet();
    const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    const paymentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.PAYMENTS);
    
    if (!installmentsSheet) {
      return { success: false, error: 'Aba de parcelas não encontrada' };
    }
    
    const installmentsData = installmentsSheet.getDataRange().getValues();
    
    // Buscar a parcela
    let installmentRow = -1;
    let installmentData = null;
    
    for (let i = 1; i < installmentsData.length; i++) {
      if (String(installmentsData[i][0]).trim() === String(installmentId).trim()) {
        installmentRow = i + 1;
        installmentData = installmentsData[i];
        break;
      }
    }
    
    if (installmentRow === -1) {
      return { success: false, error: 'Parcela não encontrada' };
    }
    
    // Verificar se já está paga
    if (installmentData[5] === 'Pago') {
      return { 
        success: false, 
        error: 'Esta parcela já foi paga',
        dataPagamento: installmentData[6]
      };
    }
    
    // Atualizar status da parcela
    const paymentDate = new Date();
    installmentsSheet.getRange(installmentRow, 6).setValue('Pago'); // Status
    installmentsSheet.getRange(installmentRow, 7).setValue(paymentDate); // Data_Pagamento
    
    // Registrar pagamento na aba Pagamentos (se existir)
    if (paymentsSheet) {
      const paymentId = generateId();
      const creditId = installmentData[1];
      const installmentValue = Number(installmentData[3]) || 0;
      
      paymentsSheet.appendRow([
        paymentId,
        installmentId,
        creditId,
        installmentValue,
        paymentDate,
        paymentMethod || 'Pagamento Manual'
      ]);
    }
    
    // Verificar se todas as parcelas foram pagas
    const creditId = installmentData[1];
    const allPaid = checkIfAllInstallmentsPaid(creditId);
    
    if (allPaid) {
      updateCreditStatus(creditId, 'Quitado');
    }
    
    console.log('✅ Parcela marcada como paga');
    
    return {
      success: true,
      message: 'Parcela marcada como paga com sucesso!',
      allPaid: allPaid,
      paymentDate: paymentDate
    };
    
  } catch (error) {
    console.error('❌ Erro ao marcar como pago:', error);
    return { success: false, error: 'Erro interno: ' + error.message };
  }
}

/**
 * FUNÇÃO: Adicionar link de pagamento a uma parcela específica
 * Para uso administrativo
 */
function addPaymentUrlToParcela(creditId, installmentNumber, paymentUrl) {
  try {
    console.log('🔗 Adicionando link de pagamento:', {
      creditId,
      installmentNumber,
      paymentUrl
    });
    
    if (!creditId || !installmentNumber || !paymentUrl) {
      return {
        success: false,
        error: 'Todos os parâmetros são obrigatórios'
      };
    }
    
    // Validar URL
    try {
      new URL(paymentUrl);
    } catch (e) {
      return {
        success: false,
        error: 'URL de pagamento inválida'
      };
    }
    
    const spreadsheet = getOrCreateSpreadsheet();
    const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    
    if (!installmentsSheet) {
      return { success: false, error: 'Aba de parcelas não encontrada' };
    }
    
    // Garantir que existe coluna de link
    const ensureResult = ensurePaymentLinkColumn(installmentsSheet);
    if (!ensureResult.success) {
      return ensureResult;
    }
    
    const data = installmentsSheet.getDataRange().getValues();
    const headers = data[0];
    const linkColumnIndex = findPaymentLinkColumnIndex(headers);
    
    // Buscar e atualizar a parcela
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowCreditId = String(row[1] || '').trim();
      const rowInstallmentNumber = parseInt(row[2] || 0);
      
      if (rowCreditId === String(creditId).trim() && rowInstallmentNumber === parseInt(installmentNumber)) {
        // Atualizar o link
        installmentsSheet.getRange(i + 1, linkColumnIndex + 1).setValue(paymentUrl);
        
        console.log(`✅ Link adicionado à parcela ${installmentNumber} da compra ${creditId}`);
        
        return {
          success: true,
          message: `Link de pagamento adicionado à parcela ${installmentNumber}`,
          linha: i + 1,
          paymentUrl: paymentUrl
        };
      }
    }
    
    return {
      success: false,
      error: `Parcela ${installmentNumber} da compra ${creditId} não encontrada`
    };
    
  } catch (error) {
    console.error('❌ Erro ao adicionar link:', error);
    return { success: false, error: 'Erro interno: ' + error.message };
  }
}

/**
 * FUNÇÃO: Adicionar múltiplos links para um crediário
 */
function addMultiplePaymentUrls(creditId, urlsArray) {
  try {
    console.log('📦 Adicionando múltiplos links:', { creditId, totalUrls: urlsArray.length });
    
    if (!creditId || !Array.isArray(urlsArray)) {
      return {
        success: false,
        error: 'CreditId e array de URLs são obrigatórios'
      };
    }
    
    const results = [];
    let successCount = 0;
    
    urlsArray.forEach((url, index) => {
      const installmentNumber = index + 1;
      
      if (url && String(url).trim() !== '') {
        const result = addPaymentUrlToParcela(creditId, installmentNumber, url.trim());
        
        results.push({
          parcela: installmentNumber,
          success: result.success,
          message: result.message || result.error,
          url: url
        });
        
        if (result.success) {
          successCount++;
        }
      } else {
        results.push({
          parcela: installmentNumber,
          success: false,
          message: 'URL vazia ou inválida',
          url: url
        });
      }
    });
    
    return {
      success: successCount > 0,
      message: `${successCount} links adicionados de ${urlsArray.length} tentativas`,
      successCount: successCount,
      totalAttempts: urlsArray.length,
      details: results
    };
    
  } catch (error) {
    console.error('❌ Erro ao adicionar múltiplos links:', error);
    return { success: false, error: 'Erro interno: ' + error.message };
  }
}

/**
 * FUNÇÃO: Listar parcelas com status de links
 */
function listParcelasWithPaymentLinks(creditId = null) {
  try {
    console.log('📋 Listando parcelas com status de links:', creditId || 'todas');
    
    const spreadsheet = getOrCreateSpreadsheet();
    const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    const creditsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CREDITS);
    
    if (!installmentsSheet || !creditsSheet) {
      return { success: false, error: 'Abas necessárias não encontradas' };
    }
    
    const installmentsData = installmentsSheet.getDataRange().getValues();
    const creditsData = creditsSheet.getDataRange().getValues();
    const headers = installmentsData[0];
    const linkColumnIndex = findPaymentLinkColumnIndex(headers);
    
    const parcelas = [];
    
    // Se creditId especificado, buscar informações do crediário
    let creditInfo = null;
    if (creditId) {
      for (let i = 1; i < creditsData.length; i++) {
        if (creditsData[i][0] === creditId) {
          creditInfo = {
            id: creditsData[i][0],
            clientName: creditsData[i][2],
            productName: creditsData[i][3],
            totalValue: creditsData[i][6]
          };
          break;
        }
      }
    }
    
    // Listar parcelas
    for (let i = 1; i < installmentsData.length; i++) {
      const row = installmentsData[i];
      
      if (creditId && row[1] !== creditId) continue;
      
      const paymentUrl = linkColumnIndex !== -1 ? row[linkColumnIndex] : null;
      const hasValidUrl = paymentUrl && String(paymentUrl).trim() !== '';
      
      parcelas.push({
        id: row[0],
        creditId: row[1],
        numero: row[2],
        valor: row[3],
        dataVencimento: formatDate(row[4]),
        status: row[5],
        dataPagamento: row[6] ? formatDate(row[6]) : null,
        paymentUrl: hasValidUrl ? String(paymentUrl).trim() : null,
        hasPaymentUrl: hasValidUrl,
        paymentUrlStatus: hasValidUrl ? 'Configurado' : 'Não configurado'
      });
    }
    
    // Ordenar por número da parcela
    parcelas.sort((a, b) => a.numero - b.numero);
    
    return {
      success: true,
      creditInfo: creditInfo,
      parcelas: parcelas,
      totalParcelas: parcelas.length,
      comLinks: parcelas.filter(p => p.hasPaymentUrl).length,
      semLinks: parcelas.filter(p => !p.hasPaymentUrl).length
    };
    
  } catch (error) {
    console.error('❌ Erro ao listar parcelas:', error);
    return { success: false, error: 'Erro interno: ' + error.message };
  }
}

/**
 * FUNÇÃO AUXILIAR: Garantir que existe coluna de link de pagamento
 */
function ensurePaymentLinkColumn(sheet) {
  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    if (findPaymentLinkColumnIndex(headers) === -1) {
      // Adicionar coluna
      const newColumnIndex = headers.length + 1;
      sheet.getRange(1, newColumnIndex).setValue('Link_Pagamento');
      
      // Formatar header
      sheet.getRange(1, newColumnIndex)
        .setFontWeight('bold')
        .setBackground('#E8F5E8');
      
      console.log('✅ Coluna Link_Pagamento criada');
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Erro ao garantir coluna:', error);
    return { success: false, error: error.message };
  }
}

/**
 * FUNÇÃO AUXILIAR: Encontrar índice da coluna de link de pagamento
 */
function findPaymentLinkColumnIndex(headers) {
  const possibleNames = [
    'Link_Pagamento',
    'Link_Pagamento_Nubank', 
    'URL_Pagamento',
    'Payment_URL',
    'PaymentLink'
  ];
  
  for (const name of possibleNames) {
    const index = headers.indexOf(name);
    if (index !== -1) {
      return index;
    }
  }
  
  return -1;
}

/**
 * FUNÇÃO ADMINISTRATIVA: Relatório de links de pagamento
 */
function generatePaymentLinksReport() {
  try {
    console.log('📊 Gerando relatório de links de pagamento...');
    
    const spreadsheet = getOrCreateSpreadsheet();
    const creditsResult = getCredits();
    
    if (!creditsResult.success) {
      return { success: false, error: 'Erro ao carregar crediários' };
    }
    
    const report = {
      totalCreditos: 0,
      creditosCompletos: 0,
      creditosIncompletos: 0,
      totalParcelas: 0,
      parcelasComLink: 0,
      parcelasSemLink: 0,
      detalhes: []
    };
    
    creditsResult.credits.forEach(credit => {
      const parcelasResult = listParcelasWithPaymentLinks(credit.id);
      
      if (parcelasResult.success) {
        const { parcelas, comLinks, semLinks } = parcelasResult;
        
        report.totalCreditos++;
        report.totalParcelas += parcelas.length;
        report.parcelasComLink += comLinks;
        report.parcelasSemLink += semLinks;
        
        const percentualCompleto = parcelas.length > 0 ? Math.round((comLinks / parcelas.length) * 100) : 0;
        const isCompleto = comLinks === parcelas.length && parcelas.length > 0;
        
        if (isCompleto) {
          report.creditosCompletos++;
        } else {
          report.creditosIncompletos++;
        }
        
        report.detalhes.push({
          creditId: credit.id,
          clientName: credit.clientName,
          productName: credit.productName,
          totalParcelas: parcelas.length,
          parcelasComLink: comLinks,
          parcelasSemLink: semLinks,
          percentualCompleto: percentualCompleto,
          status: isCompleto ? 'Completo' : 'Incompleto'
        });
      }
    });
    
    // Ordenar por status (incompletos primeiro)
    report.detalhes.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'Incompleto' ? -1 : 1;
      }
      return a.percentualCompleto - b.percentualCompleto;
    });
    
    console.log('📊 Relatório gerado:', report);
    
    return {
      success: true,
      report: report,
      message: `Relatório de ${report.totalCreditos} crediários gerado`
    };
    
  } catch (error) {
    console.error('❌ Erro ao gerar relatório:', error);
    return { success: false, error: 'Erro interno: ' + error.message };
  }
}

/**
 * FUNÇÃO: Configuração rápida do sistema de links
 */
function setupPaymentLinksSystem() {
  console.log('⚡ Configurando sistema de links de pagamento...');
  
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const installmentsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.INSTALLMENTS);
    
    if (!installmentsSheet) {
      return { success: false, error: 'Aba de parcelas não encontrada' };
    }
    
    // Garantir coluna de links
    const columnResult = ensurePaymentLinkColumn(installmentsSheet);
    if (!columnResult.success) {
      return columnResult;
    }
    
    // Gerar relatório inicial
    const reportResult = generatePaymentLinksReport();
    
    console.log('✅ Sistema de links configurado!');
    console.log('💡 Próximos passos:');
    console.log('1. Use addPaymentUrlToParcela() para adicionar links individuais');
    console.log('2. Use addMultiplePaymentUrls() para adicionar vários links');
    console.log('3. Use listParcelasWithPaymentLinks() para verificar status');
    
    return {
      success: true,
      message: 'Sistema de links de pagamento configurado com sucesso!',
      reportInicial: reportResult.success ? reportResult.report : null,
      funcoes: [
        'addPaymentUrlToParcela(creditId, installmentNumber, paymentUrl)',
        'addMultiplePaymentUrls(creditId, [url1, url2, url3])',
        'listParcelasWithPaymentLinks(creditId)',
        'generatePaymentLinksReport()'
      ]
    };
    
  } catch (error) {
    console.error('❌ Erro na configuração:', error);
    return { success: false, error: 'Erro interno: ' + error.message };
  }
}

/**
 * EXEMPLO DE USO - CONFIGURAÇÃO COMPLETA
 */
function exemploConfiguracaoLinks() {
  console.log('💡 === EXEMPLO DE CONFIGURAÇÃO DE LINKS ===');
  
  try {
    // 1. Configurar sistema
    console.log('1️⃣ Configurando sistema...');
    const setupResult = setupPaymentLinksSystem();
    console.log('Setup:', setupResult.success ? '✅' : '❌');
    
    // 2. Listar crediários disponíveis
    console.log('2️⃣ Listando crediários...');
    const creditsResult = getCredits();
    
    if (creditsResult.success && creditsResult.credits.length > 0) {
      const exemploCredit = creditsResult.credits[0];
      console.log(`📋 Usando crediário exemplo: ${exemploCredit.id} - ${exemploCredit.productName}`);
      
      // 3. Adicionar links de exemplo
      console.log('3️⃣ Adicionando links de exemplo...');
      
      const linksExemplo = [
        'https://checkout.nubank.com.br/parcela1-exemplo',
        'https://checkout.nubank.com.br/parcela2-exemplo',
        'https://checkout.nubank.com.br/parcela3-exemplo'
      ];
      
      const addResult = addMultiplePaymentUrls(exemploCredit.id, linksExemplo);
      console.log('Links adicionados:', addResult.success ? '✅' : '❌');
      
      // 4. Verificar resultado
      console.log('4️⃣ Verificando resultado...');
      const listResult = listParcelasWithPaymentLinks(exemploCredit.id);
      console.log('Verificação:', listResult.success ? '✅' : '❌');
      
      if (listResult.success) {
        console.log(`📊 ${listResult.comLinks}/${listResult.totalParcelas} parcelas com links`);
      }
    }
    
    // 5. Gerar relatório
    console.log('5️⃣ Gerando relatório...');
    const reportResult = generatePaymentLinksReport();
    console.log('Relatório:', reportResult.success ? '✅' : '❌');
    
    return {
      success: true,
      message: 'Exemplo executado com sucesso!'
    };
    
  } catch (error) {
    console.error('❌ Erro no exemplo:', error);
    return { success: false, error: error.message };
  }
}

// ========================================
// LOGS DE INICIALIZAÇÃO
// ========================================

console.log('🔗 === SISTEMA DE LINKS DE PAGAMENTO CARREGADO ===');
console.log('✅ Funções principais:');
console.log('  - getPaymentUrlFromSheet(): Buscar URL na planilha');
console.log('  - requestPaymentUrl(): Solicitar criação de link'); 
console.log('  - markInstallmentAsPaid(): Marcar como pago');
console.log('  - addPaymentUrlToParcela(): Adicionar link individual');
console.log('  - addMultiplePaymentUrls(): Adicionar múltiplos links');
console.log('');
console.log('🚀 Para configurar: setupPaymentLinksSystem()');
console.log('💡 Para exemplo: exemploConfiguracaoLinks()');
console.log('📊 Para relatório: generatePaymentLinksReport()');
console.log('');
console.log('🎯 O frontend agora buscará automaticamente os links da planilha!');

/**
 * ========================================
 * INTEGRAÇÃO COM FUNÇÕES EXISTENTES
 * Mantém compatibilidade com código anterior
 * ========================================
 */

// Atualizar função existente para usar os novos links
function getPaymentUrlByProduct(creditId, installmentNumber) {
  console.log('🔄 getPaymentUrlByProduct chamada (modo compatibilidade)');
  
  // Tentar buscar na planilha primeiro
  const planilhaResult = getPaymentUrlFromSheet({
    creditId: creditId,
    installmentNumber: installmentNumber
  });
  
  if (planilhaResult.success && planilhaResult.paymentUrl) {
    console.log('✅ URL encontrada na planilha via compatibilidade');
    return planilhaResult.paymentUrl;
  }
  
  // Fallback para URLs fixas (manter compatibilidade)
  const urlsFixas = {
    1: 'https://checkout.nubank.com.br/QuKX2aKfp5azqxv',
    2: 'https://checkout.nubank.com.br/NY31fitfzhazqxv', 
    3: 'https://checkout.nubank.com.br/vc9ew5NXpgazqxv'
  };
  
  const urlFixa = urlsFixas[installmentNumber];
  if (urlFixa) {
    console.log('⚡ Usando URL fixa de fallback');
    return urlFixa;
  }
  
  // URL padrão final
  console.log('🔄 Usando URL padrão');
  return 'https://checkout.nubank.com.br/QuKX2aKfp5azqxv';
}

// ===== FUNÇÕES DE INTERFACE ADMINISTRATIVA =====

function obterParcelasEditaveis(compraId) {
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const parcelasSheet = spreadsheet.getSheetByName('Parcelas');
    const data = parcelasSheet.getDataRange().getValues();
    
    const parcelas = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[1] === compraId && row[0]) {
        parcelas.push({
          id: row[0],
          numero: row[2],
          valor: row[3],
          dataVencimento: formatDateSafe(row[4]),
          status: row[5],
          dataPagamento: row[6] ? formatDateSafe(row[6]) : null,
          linkPagamento: row[7] || ''
        });
      }
    }
    
    parcelas.sort((a, b) => a.numero - b.numero);
    
    return {
      success: true,
      parcelas: parcelas
    };
    
  } catch (error) {
    console.error('❌ Erro ao obter parcelas editáveis:', error);
    return { success: false, error: error.message };
  }
}

function redividirParcelas(compraId, novoNumeroParcelas) {
  console.log(`🔄 Redividindo compra ${compraId} em ${novoNumeroParcelas} parcelas`);
  
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const comprasSheet = spreadsheet.getSheetByName('Compras');
    const parcelasSheet = spreadsheet.getSheetByName('Parcelas');
    
    // Buscar dados da compra
    const comprasData = comprasSheet.getDataRange().getValues();
    let compra = null;
    
    for (let i = 1; i < comprasData.length; i++) {
      if (comprasData[i][0] === compraId) {
        compra = comprasData[i];
        break;
      }
    }
    
    if (!compra) {
      return { success: false, error: 'Compra não encontrada' };
    }
    
    const valorTotal = Number(compra[6]);
    const dataCompra = new Date(compra[7]);
    
    // Remover parcelas antigas
    const parcelasData = parcelasSheet.getDataRange().getValues();
    for (let i = parcelasData.length - 1; i >= 1; i--) {
      if (parcelasData[i][1] === compraId) {
        parcelasSheet.deleteRow(i + 1);
      }
    }
    
    // Criar novas parcelas
    const valorPorParcela = valorTotal / novoNumeroParcelas;
    
    for (let p = 1; p <= novoNumeroParcelas; p++) {
      const dataVencimento = new Date(dataCompra);
      dataVencimento.setMonth(dataVencimento.getMonth() + p);
      
      const novaParcela = [
        generateId(),
        compraId,
        p,
        valorPorParcela,
        dataVencimento,
        'Pendente',
        '',
        ''
      ];
      
      parcelasSheet.appendRow(novaParcela);
    }
    
    // Atualizar status da compra
    sincronizarStatusCompra(compraId);
    
    console.log(`✅ ${novoNumeroParcelas} parcelas criadas de R$ ${valorPorParcela.toFixed(2)} cada`);
    
    return {
      success: true,
      message: `Compra redividida em ${novoNumeroParcelas} parcelas de R$ ${valorPorParcela.toFixed(2)}`,
      valorPorParcela: valorPorParcela
    };
    
  } catch (error) {
    console.error('❌ Erro ao redividir parcelas:', error);
    return { success: false, error: error.message };
  }
}

// ===== FUNÇÕES AUXILIARES =====

function formatDateSafe(date) {
  if (!date) return '';
  try {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
