// Variáveis globais
let lancamentosData = [];
let categorias = ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Educação', 'Outros'];
let chartGastosCategorias = null;
let chartEvolucaoMensal = null;
let chartReceitasDespesas = null;
let appInitialized = false;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM carregado, iniciando aplicação...");
  
  // Verificar se estamos na página correta com os elementos necessários
  if (document.querySelector('.app-container')) {
    console.log("App container encontrado, inicializando aplicação...");
    inicializar();
  } else {
    console.warn("Elementos necessários não encontrados. A aplicação pode estar em uma página diferente.");
  }
});

function inicializar() {
  if (appInitialized) return;
  appInitialized = true;
  
  console.log("Inicializando aplicação...");
  
  try {
    // Inicializar navegação
    initNavigation();
    
    // Carregar preferências salvas
    carregarPreferenciasDeTema();
    
    // Carregar categorias salvas
    carregarCategoriasSalvas();
    
    // Inicializar formulário
    initForm();
    
    // Atualizar lista de categorias
    atualizarListaCategorias();
    atualizarSelectCategorias();
    
    // Ajustar layout
    adjustLayout();
    window.addEventListener('resize', adjustLayout);
    
    // Carregar dados (com verificação de elementos)
    if (document.getElementById('lancamentosTabela')) {
      console.log("Tabela de lançamentos encontrada, carregando dados...");
      setTimeout(carregarLancamentos, 100);
    } else {
      console.warn("Tabela de lançamentos não encontrada. Pulando carregamento de dados.");
    }
  } catch (error) {
    console.error("Erro durante a inicialização:", error);
  }
}

// Inicializar navegação
function initNavigation() {
  // Alternar sidebar em dispositivos móveis
  const toggleBtn = document.getElementById('toggleSidebar');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      document.querySelector('.sidebar').classList.toggle('open');
    });
  }
  
  // Navegação entre páginas
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function() {
      const pageId = this.getAttribute('data-page');
      
      // Desativar todos os itens do menu e páginas
      document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      
      // Ativar o item de menu e página selecionados
      this.classList.add('active');
      const targetPage = document.getElementById(pageId);
      if (targetPage) {
        targetPage.classList.add('active');
      }
      
      // Fechar sidebar em dispositivos móveis
      if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('open');
      }
      
      // Atualizar gráficos se estiver na página de relatórios
      if (pageId === 'relatorios' && document.getElementById('relatorios')) {
        setTimeout(function() {
          atualizarGraficoReceitasDespesas();
          atualizarGraficoGastosCategorias();
          atualizarGraficoEvolucaoMensal();
        }, 100);
      }
    });
  });
}


// Inicializar formulário
function initForm() {
  // Definir data atual no formulário
  const dataInput = document.getElementById('data');
  if (dataInput) {
    const hoje = new Date().toISOString().split('T')[0];
    dataInput.value = hoje;
  }
  
  // Manipular envio do formulário
  const form = document.getElementById('formLancamento');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      salvarLancamento();
    });
  }
}

// Carregar lançamentos
function carregarLancamentos() {
  console.log("Carregando lançamentos...");
  
  const tabelaLancamentos = document.getElementById('lancamentosTabela');
  
  // Verificar se a tabela existe
  if (!tabelaLancamentos) {
    console.error("Elemento 'lancamentosTabela' não encontrado");
    return;
  }
  
  // Mostrar indicador de carregamento
  tabelaLancamentos.innerHTML = `
    <tr>
      <td colspan="6" style="text-align: center;">
        <i class="fas fa-spinner fa-spin"></i> Carregando...
      </td>
    </tr>
  `;
  
  // Verificar se o Google Apps Script está disponível
  if (typeof google === 'undefined' || !google.script) {
    console.log("Modo de demonstração: carregando dados de exemplo");
    carregarDadosExemplo();
    return;
  }
  
  // Carregar dados do Google Sheets
  google.script.run
    .withSuccessHandler(function(dados) {
      lancamentosData = dados;
      processarLancamentos(dados);
    })
    .withFailureHandler(function(erro) {
      const tabelaLancamentos = document.getElementById('lancamentosTabela');
      if (tabelaLancamentos) {
        tabelaLancamentos.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--error-color);">
              <i class="fas fa-exclamation-circle"></i> Erro ao carregar dados: ${erro}
            </td>
          </tr>
        `;
      }
    })
    .obterLancamentos();
}

// Carregar dados de exemplo para demonstração
function carregarDadosExemplo() {
  console.log("Carregando dados de exemplo...");
  
  setTimeout(() => {
    lancamentosData = [
      {linha: 1, data: "01/05/2023", descricao: "Salário", categoria: "Outros", valor: "R$ 3000,00", tipo: "Receita", comprovante: true},
      {linha: 2, data: "05/05/2023", descricao: "Aluguel", categoria: "Moradia", valor: "R$ 1200,00", tipo: "Gasto", comprovante: true},
      {linha: 3, data: "10/05/2023", descricao: "Supermercado", categoria: "Alimentação", valor: "R$ 450,00", tipo: "Gasto", comprovante: false},
      {linha: 4, data: "15/05/2023", descricao: "Freelance", categoria: "Outros", valor: "R$ 800,00", tipo: "Receita", comprovante: false},
      {linha: 5, data: "20/05/2023", descricao: "Restaurante", categoria: "Alimentação", valor: "R$ 120,00", tipo: "Gasto", comprovante: true}
    ];
    
    const tabelaLancamentos = document.getElementById('lancamentosTabela');
    if (tabelaLancamentos) {
      processarLancamentos(lancamentosData);
    } else {
      console.error("Elemento 'lancamentosTabela' não encontrado ao processar dados de exemplo");
    }
  }, 1000);
}

// Processar e exibir lançamentos
function processarLancamentos(dados) {
  console.log("Processando lançamentos...");
  
  const tabelaLancamentos = document.getElementById('lancamentosTabela');
  
  // Verificar se a tabela existe
  if (!tabelaLancamentos) {
    console.error("Elemento 'lancamentosTabela' não encontrado ao processar lançamentos");
    return;
  }
  
  if (!dados || dados.length === 0) {
    tabelaLancamentos.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center;">
          <i class="fas fa-info-circle"></i> Nenhum lançamento encontrado.
        </td>
      </tr>
    `;
    
    // Atualizar resumo
    atualizarResumo(0, 0);
    
    return;
  }
  
  let html = '';
  let totalReceitas = 0;
  let totalGastos = 0;
  
  dados.forEach(lancamento => {
    const valor = parseFloat(String(lancamento.valor).replace("R$ ", "").replace(",", ".")) || 0;
    
    if (lancamento.tipo.toLowerCase() === 'receita') {
      totalReceitas += valor;
    } else {
      totalGastos += valor;
    }
    
    const valorClass = lancamento.tipo.toLowerCase() === 'receita' ? 'valor-receita' : 'valor-gasto';
    
    html += `
      <tr>
        <td>${lancamento.data}</td>
        <td>${lancamento.descricao}</td>
        <td>${lancamento.categoria}</td>
        <td class="${valorClass}">${lancamento.valor}</td>
        <td>${lancamento.tipo}</td>
        <td class="acoes">
          ${lancamento.comprovante ? 
            `<button class="btn-sm btn-visualizar" onclick="verComprovante(${lancamento.linha})">
              <i class="fas fa-file-alt"></i>
            </button>` : 
            `<span class="status-comprovante pendente">
              <i class="fas fa-file-upload"></i> Pendente
            </span>`
          }
          <button class="btn-sm btn-excluir" onclick="excluirLancamento(${lancamento.linha})">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });
  
  tabelaLancamentos.innerHTML = html;
  
  // Atualizar resumo
  atualizarResumo(totalReceitas, totalGastos);
}

// Atualizar resumo financeiro
function atualizarResumo(totalReceitas, totalGastos) {
  console.log("Atualizando resumo...");
  
  const painelResumo = document.getElementById('painelResumo');
  if (!painelResumo) {
    console.error("Elemento 'painelResumo' não encontrado");
    return;
  }
  
  const saldo = totalReceitas - totalGastos;
  
  // Atualizar classes do painel
  if (saldo >= 0) {
    painelResumo.className = 'resumo positivo';
  } else {
    painelResumo.className = 'resumo negativo';
  }
  
  // Atualizar valores
  painelResumo.innerHTML = `
    <div class="resumo-item">
      <span>Recebido:</span>
      <span class="valor-receita">R$ ${totalReceitas.toFixed(2).replace('.', ',')}</span>
    </div>
    <div class="resumo-item">
      <span>Gasto:</span>
      <span class="valor-gasto">R$ ${totalGastos.toFixed(2).replace('.', ',')}</span>
    </div>
    <div class="resumo-item">
      <span>Saldo:</span>
      <span class="${saldo >= 0 ? 'valor-receita' : 'valor-gasto'}">
        R$ ${Math.abs(saldo).toFixed(2).replace('.', ',')}
      </span>
    </div>
  `;
}

// Função placeholder para salvar lançamento
function salvarLancamento() {
  alert("Função de salvar lançamento ainda não implementada completamente");
  // Implementação completa seria feita aqui
}

// Função placeholder para excluir lançamento
function excluirLancamento(linha) {
  alert(`Função de excluir lançamento (linha ${linha}) ainda não implementada completamente`);
  // Implementação completa seria feita aqui
}

// Função placeholder para ver comprovante
function verComprovante(linha) {
  alert(`Função de visualizar comprovante (linha ${linha}) ainda não implementada completamente`);
  // Implementação completa seria feita aqui
}

// Função placeholder para atualizar gráficos
function atualizarGraficos() {
  console.log("Atualizando gráficos...");
  // Implementação completa seria feita aqui
}

// Função placeholder para atualizar lista de categorias
function atualizarListaCategorias() {
  console.log("Atualizando lista de categorias...");
  const listaCategorias = document.getElementById('listaCategorias');
  if (!listaCategorias) {
    console.warn("Elemento 'listaCategorias' não encontrado");
    return;
  }
  
  // Implementação básica
  listaCategorias.innerHTML = '';
  categorias.forEach((categoria, index) => {
    const item = document.createElement('div');
    item.className = 'resumo-item';
    item.style.justifyContent = 'space-between';
    item.innerHTML = `
      <span>${categoria}</span>
      <button class="btn-sm btn-excluir" onclick="alert('Remover categoria ${categoria}')">
        <i class="fas fa-trash"></i>
      </button>
    `;
    listaCategorias.appendChild(item);
  });
}

// Função placeholder para atualizar select de categorias
function atualizarSelectCategorias() {
  console.log("Atualizando select de categorias...");
  const select = document.getElementById('categoria');
  if (!select) {
    console.warn("Elemento 'categoria' não encontrado");
    return;
  }
  
  // Implementação básica
  select.innerHTML = '';
  categorias.forEach(categoria => {
    const option = document.createElement('option');
    option.value = categoria;
    option.textContent = categoria;
    select.appendChild(option);
  });
}

// Função placeholder para carregar preferências de tema
function carregarPreferenciasDeTemasalvas() {
  console.log("Carregando preferências de tema...");
  // Implementação completa seria feita aqui
}

// Função placeholder para carregar categorias salvas
function carregarCategoriasSalvas() {
  console.log("Carregando categorias salvas...");
  const categoriasSalvas = JSON.parse(localStorage.getItem('categorias'));
  if (categoriasSalvas && Array.isArray(categoriasSalvas) && categoriasSalvas.length > 0) {
    categorias = categoriasSalvas;
  }
}

// Função placeholder para ajustar layout
function adjustLayout() {
  console.log("Ajustando layout...");
  
  // Verificar se estamos em modo paisagem em dispositivo móvel
  const isMobile = window.innerWidth <= 768;
  const isLandscape = window.innerWidth > window.innerHeight;
  
  if (isMobile && isLandscape) {
    document.body.classList.add('landscape-mobile');
  } else {
    document.body.classList.remove('landscape-mobile');
  }
  
  // Ajustar altura dos gráficos
  const chartContainers = document.querySelectorAll('.chart-container');
  chartContainers.forEach(container => {
    if (isMobile) {
      container.style.height = isLandscape ? '200px' : '300px';
    } else {
      container.style.height = '400px';
    }
  });
}

// Função para alternar entre abas nos relatórios
function changeTab(tabId) {
  // Desativar todas as abas
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.remove('active');
  });
  
  // Ativar a aba selecionada
  const selectedTab = document.getElementById(tabId);
  if (selectedTab) {
    selectedTab.classList.add('active');
  }
  
  // Ativar o botão correspondente
  const button = document.querySelector(`.tab-button[onclick="changeTab('${tabId}')"]`);
  if (button) {
    button.classList.add('active');
  }
  
  // Atualizar gráficos específicos da aba
  if (tabId === 'tab-resumo') {
    atualizarGraficoReceitasDespesas();
  } else if (tabId === 'tab-categorias') {
    atualizarGraficoGastosCategorias();
  } else if (tabId === 'tab-evolucao') {
    atualizarGraficoEvolucaoMensal();
  }
}

// Função placeholder para atualizar gráfico de receitas e despesas
function atualizarGraficoReceitasDespesas() {
  console.log("Atualizando gráfico de receitas e despesas...");
  const canvas = document.getElementById('chartReceitasDespesas');
  if (!canvas) {
    console.warn("Canvas 'chartReceitasDespesas' não encontrado");
    return;
  }
  
  // Implementação básica (sem Chart.js real)
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('Gráfico de Receitas e Despesas (simulado)', canvas.width / 2, canvas.height / 2);
  }
}

// Função placeholder para atualizar gráfico de gastos por categorias
function atualizarGraficoGastosCategorias() {
  console.log("Atualizando gráfico de gastos por categorias...");
  const canvas = document.getElementById('chartGastosCategorias');
  if (!canvas) {
    console.warn("Canvas 'chartGastosCategorias' não encontrado");
    return;
  }
  
  // Implementação básica (sem Chart.js real)
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('Gráfico de Gastos por Categorias (simulado)', canvas.width / 2, canvas.height / 2);
  }
}

// Função placeholder para atualizar gráfico de evolução mensal
function atualizarGraficoEvolucaoMensal() {
  console.log("Atualizando gráfico de evolução mensal...");
  const canvas = document.getElementById('chartEvolucaoMensal');
  if (!canvas) {
    console.warn("Canvas 'chartEvolucaoMensal' não encontrado");
    return;
  }
  
  // Implementação básica (sem Chart.js real)
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('Gráfico de Evolução Mensal (simulado)', canvas.width / 2, canvas.height / 2);
  }
}

// Função para adicionar nova categoria
function adicionarCategoria() {
  const input = document.getElementById('novaCategoria');
  if (!input) {
    console.warn("Elemento 'novaCategoria' não encontrado");
    return;
  }
  
  const novaCategoria = input.value.trim();
  
  if (novaCategoria === '') {
    mostrarAlerta('Por favor, insira um nome para a categoria.', 'warning');
    return;
  }
  
  if (categorias.includes(novaCategoria)) {
    mostrarAlerta('Esta categoria já existe.', 'warning');
    return;
  }
  
  categorias.push(novaCategoria);
  localStorage.setItem('categorias', JSON.stringify(categorias));
  
  // Atualizar interface
  atualizarListaCategorias();
  atualizarSelectCategorias();
  
  // Limpar campo
  input.value = '';
  
  mostrarAlerta('Categoria adicionada com sucesso!', 'success');
}

// Função para exportar dados
function exportarDados() {
  if (lancamentosData.length === 0) {
    mostrarAlerta('Não há dados para exportar.', 'warning');
    return;
  }
  
  const dadosExportacao = {
    lancamentos: lancamentosData,
    categorias: categorias,
    dataExportacao: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(dadosExportacao, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `financas_pessoais_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
  
  mostrarAlerta('Dados exportados com sucesso!', 'success');
}
// Tornando funções acessíveis globalmente para uso no HTML
window.adicionarCategoria = function() {
  const input = document.getElementById('novaCategoria');
  if (!input) {
    console.warn("Elemento 'novaCategoria' não encontrado");
    return;
  }
  
  const novaCategoria = input.value.trim();
  
  if (novaCategoria === '') {
    mostrarAlerta('Por favor, insira um nome para a categoria.', 'warning');
    return;
  }
  
  if (categorias.includes(novaCategoria)) {
    mostrarAlerta('Esta categoria já existe.', 'warning');
    return;
  }
  
  categorias.push(novaCategoria);
  localStorage.setItem('categorias', JSON.stringify(categorias));
  
  // Atualizar interface
  atualizarListaCategorias();
  atualizarSelectCategorias();
  
  // Limpar campo
  input.value = '';
  
  mostrarAlerta('Categoria adicionada com sucesso!', 'success');
};

window.exportarDados = function() {
  if (lancamentosData.length === 0) {
    mostrarAlerta('Não há dados para exportar.', 'warning');
    return;
  }
  
  const dadosExportacao = {
    lancamentos: lancamentosData,
    categorias: categorias,
    dataExportacao: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(dadosExportacao, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `financas_pessoais_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
  
  mostrarAlerta('Dados exportados com sucesso!', 'success');
};

window.importarDados = function() {
  const input = document.getElementById('importarArquivo');
  if (!input) {
    console.warn("Elemento 'importarArquivo' não encontrado");
    return;
  }
  
  if (!input.files || input.files.length === 0) {
    mostrarAlerta('Por favor, selecione um arquivo para importar.', 'warning');
    return;
  }
  
  const file = input.files[0];
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      const dados = JSON.parse(e.target.result);
      
      if (!dados.lancamentos || !Array.isArray(dados.lancamentos)) {
        throw new Error('Formato de arquivo inválido.');
      }
      
      // Atualizar dados
      lancamentosData = dados.lancamentos;
      
      if (dados.categorias && Array.isArray(dados.categorias)) {
        categorias = dados.categorias;
        localStorage.setItem('categorias', JSON.stringify(categorias));
      }
      
      // Atualizar interface
      processarLancamentos(lancamentosData);
      atualizarListaCategorias();
      atualizarSelectCategorias();
      
      mostrarAlerta('Dados importados com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao importar dados:', error);
      mostrarAlerta('Erro ao importar dados. Verifique o formato do arquivo.', 'error');
    }
  };
  
  reader.readAsText(file);
};

window.fecharModalComprovante = function() {
  const modal = document.getElementById('modalComprovante');
  if (modal) {
    modal.style.display = 'none';
  }
};

window.verComprovante = function(linha) {
  alert(`Função de visualizar comprovante (linha ${linha}) ainda não implementada completamente`);
  // Implementação completa seria feita aqui
};

window.excluirLancamento = function(linha) {
  alert(`Função de excluir lançamento (linha ${linha}) ainda não implementada completamente`);
  // Implementação completa seria feita aqui
};

// Função para atualizar cor do tema
// Definindo como global para ser acessível via onclick no HTML
window.updateThemeColor = function(variable, value) {
  document.documentElement.style.setProperty(`--${variable}`, value);
  
  // Salvar preferências
  const temaAtual = JSON.parse(localStorage.getItem('tema') || '{}');
  temaAtual[variable] = value;
  localStorage.setItem('tema', JSON.stringify(temaAtual));
  
  mostrarAlerta('Tema atualizado!', 'info');
};



// Função para importar dados
function importarDados() {
  const input = document.getElementById('importarArquivo');
  if (!input) {
    console.warn("Elemento 'importarArquivo' não encontrado");
    return;
  }
  
  if (!input.files || input.files.length === 0) {
    mostrarAlerta('Por favor, selecione um arquivo para importar.', 'warning');
    return;
  }
  
  const file = input.files[0];
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      const dados = JSON.parse(e.target.result);
      
      if (!dados.lancamentos || !Array.isArray(dados.lancamentos)) {
        throw new Error('Formato de arquivo inválido.');
      }
      
      // Atualizar dados
      lancamentosData = dados.lancamentos;
      
      if (dados.categorias && Array.isArray(dados.categorias)) {
        categorias = dados.categorias;
        localStorage.setItem('categorias', JSON.stringify(categorias));
      }
      
      // Atualizar interface
      processarLancamentos(lancamentosData);
      atualizarListaCategorias();
      atualizarSelectCategorias();
      
      mostrarAlerta('Dados importados com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao importar dados:', error);
      mostrarAlerta('Erro ao importar dados. Verifique o formato do arquivo.', 'error');
    }
  };
  
  reader.readAsText(file);
}
// Função para alternar entre abas nos relatórios
// Definindo como global para ser acessível via onclick no HTML
window.changeTab = function(tabId) {
  console.log("Alterando para a aba:", tabId);
  
  // Desativar todas as abas
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.remove('active');
  });
  
  // Ativar a aba selecionada
  const selectedTab = document.getElementById(tabId);
  if (selectedTab) {
    selectedTab.classList.add('active');
  }
  
  // Ativar o botão correspondente
  const buttons = document.querySelectorAll('.tab-button');
  buttons.forEach(button => {
    if (button.getAttribute('onclick').includes(tabId)) {
      button.classList.add('active');
    }
  });
  
  // Atualizar gráficos específicos da aba
  if (tabId === 'tab-resumo') {
    atualizarGraficoReceitasDespesas();
  } else if (tabId === 'tab-categorias') {
    atualizarGraficoGastosCategorias();
  } else if (tabId === 'tab-evolucao') {
    atualizarGraficoEvolucaoMensal();
  }
};

// Função para carregar preferências de tema
function carregarPreferenciasDeTema() {
  console.log("Carregando preferências de tema...");
  
  try {
    const temasSalvos = JSON.parse(localStorage.getItem('tema') || '{}');
    
    // Aplicar cores salvas
    if (temasSalvos['primary-color']) {
      document.documentElement.style.setProperty('--primary-color', temasSalvos['primary-color']);
      document.getElementById('primaryColor').value = temasSalvos['primary-color'];
    }
    
    if (temasSalvos['secondary-color']) {
      document.documentElement.style.setProperty('--secondary-color', temasSalvos['secondary-color']);
      document.getElementById('secondaryColor').value = temasSalvos['secondary-color'];
    }
    
    if (temasSalvos['accent-color']) {
      document.documentElement.style.setProperty('--accent-color', temasSalvos['accent-color']);
      document.getElementById('accentColor').value = temasSalvos['accent-color'];
    }
  } catch (error) {
    console.error("Erro ao carregar preferências de tema:", error);
  }
}

// Função para atualizar cor do tema
function updateThemeColor(variable, value) {
  document.documentElement.style.setProperty(`--${variable}`, value);
  
  // Salvar preferências
  const temaAtual = JSON.parse(localStorage.getItem('tema') || '{}');
  temaAtual[variable] = value;
  localStorage.setItem('tema', JSON.stringify(temaAtual));
  
  mostrarAlerta('Tema atualizado!', 'info');
}

// Função para mostrar alertas
function mostrarAlerta(mensagem, tipo) {
  // Remover alertas existentes
  const alertasAntigos = document.querySelectorAll('.alerta-flutuante');
  alertasAntigos.forEach(alerta => {
    alerta.classList.add('fechar');
    setTimeout(() => {
      if (alerta.parentNode) {
        alerta.parentNode.removeChild(alerta);
      }
    }, 500);
  });
  
  // Criar novo alerta
  const alerta = document.createElement('div');
  alerta.className = `alerta-flutuante alerta-${tipo}`;
  
  let icone = '';
  switch (tipo) {
    case 'success':
      icone = '<i class="fas fa-check-circle"></i>';
      break;
    case 'error':
      icone = '<i class="fas fa-exclamation-circle"></i>';
      break;
    case 'warning':
      icone = '<i class="fas fa-exclamation-triangle"></i>';
      break;
    case 'info':
      icone = '<i class="fas fa-info-circle"></i>';
      break;
  }
  
  alerta.innerHTML = `
    ${icone}
    <span>${mensagem}</span>
    <button onclick="this.parentNode.classList.add('fechar'); setTimeout(() => this.parentNode.remove(), 500);">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  document.body.appendChild(alerta);
  
  // Remover automaticamente após 5 segundos
  setTimeout(() => {
    if (document.body.contains(alerta)) {
      alerta.classList.add('fechar');
      setTimeout(() => {
        if (document.body.contains(alerta)) {
          document.body.removeChild(alerta);
        }
      }, 500);
    }
  }, 5000);
}

// Função para abrir modal de comprovante
function fecharModalComprovante() {
  const modal = document.getElementById('modalComprovante');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Inicializar a aplicação quando o script for carregado
console.log("Script app.js carregado");
