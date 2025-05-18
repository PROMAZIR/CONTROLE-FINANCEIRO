// Variáveis globais
let lancamentosData = [];
let categorias = ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Educação', 'Outros'];
let chartGastosCategorias = null;
let chartEvolucaoMensal = null;
let chartReceitasDespesas = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
  inicializar();
});

function inicializar() {
  // Inicializar navegação
  initNavigation();
  
  // Carregar preferências salvas
  carregarPreferenciasDeTemasalvas();
  
  // Carregar categorias salvas
  carregarCategoriasSalvas();
  
  // Inicializar formulário
  initForm();
  
  // Carregar dados
  setTimeout(carregarLancamentos, 100); // Pequeno atraso para garantir que o DOM esteja pronto
  
  // Atualizar lista de categorias
  atualizarListaCategorias();
  atualizarSelectCategorias();
  
  // Ajustar layout
  adjustLayout();
  window.addEventListener('resize', adjustLayout);
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
      document.getElementById(pageId).classList.add('active');
      
      // Fechar sidebar em dispositivos móveis
      if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('open');
      }
      
      // Atualizar gráficos se estiver na página de relatórios
      if (pageId === 'relatorios') {
        setTimeout(atualizarGraficos, 100); // Pequeno atraso para garantir que o DOM esteja pronto
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
  setTimeout(() => {
    lancamentosData = [
      {linha: 1, data: "01/05/2023", descricao: "Salário", categoria: "Outros", valor: "R$ 3000,00", tipo: "Receita", comprovante: true},
      {linha: 2, data: "05/05/2023", descricao: "Aluguel", categoria: "Moradia", valor: "R$ 1200,00", tipo: "Gasto", comprovante: true},
      {linha: 3, data: "10/05/2023", descricao: "Supermercado", categoria: "Alimentação", valor: "R$ 450,00", tipo: "Gasto", comprovante: false},
      {linha: 4, data: "15/05/2023", descricao: "Freelance", categoria: "Outros", valor: "R$ 800,00", tipo: "Receita", comprovante: false},
      {linha: 5, data: "20/05/2023", descricao: "Restaurante", categoria: "Alimentação", valor: "R$ 120,00", tipo: "Gasto", comprovante: true}
    ];
    
    processarLancamentos(lancamentosData);
  }, 1000);
}

// Processar e exibir lançamentos
function processarLancamentos(dados) {
  const tabelaLancamentos = document.getElementById('lancamentosTabela');
  
  // Verificar se a tabela existe
  if (!tabelaLancamentos) {
    console.error("Elemento 'lancamentosTabela' não encontrado");
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
            `<div class="comprovante-upload">
              <input type="file" id="fileInput${lancamento.linha}" accept="image/*,.pdf" style="display:none;">
              <button class="btn-sm btn-visualizar" onclick="document.getElementById('fileInput${lancamento.linha}').click()">
                <i class="fas fa-upload"></i>
              </button>
              <button class="btn-sm btn-visualizar" onclick="uploadComprovante(${lancamento.linha})" style="margin-left:5px;">
                <i class="fas fa-save"></i>
              </button>
            </div>`
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
