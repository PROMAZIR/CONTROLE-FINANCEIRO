// Variáveis globais
let categorias = ['Alimentação', 'Transporte', 'Lazer', 'Calçados', 'Moradia', 'Saúde', 'Educação', 'Investimentos', 'Salário', 'Outros'];
let lancamentosData = [];
let chartGastosCategorias, chartEvolucaoMensal, chartReceitasDespesas;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
  inicializar();
  setupMenuItemsEvents();
  carregarPreferenciasDeTemasalvas();
  carregarCategoriasSalvas();
  adjustLayout();
  
  // Adicionar listener para o botão de toggle sidebar
  const toggleBtn = document.getElementById('toggleSidebar');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleSidebar);
  }
  
  // Adicionar listener para redimensionamento da janela
  window.addEventListener('resize', adjustLayout);
});

function inicializar() {
  carregarLancamentos();
  atualizarListaCategorias();
  atualizarSelectCategorias();
  setActiveMenuItem('dashboard');
  mostrarAlerta("Sistema de controle financeiro carregado com sucesso!", "info");
}

function showPage(pageId) {
  // Esconder todas as páginas
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  // Mostrar a página selecionada
  document.getElementById(pageId).classList.add('active');

  // Atualizar menu ativo
  setActiveMenuItem(pageId);

  // Fechar sidebar em dispositivos móveis
  if (window.innerWidth <= 768) {
    closeSidebar();
  }

  // Ações específicas para cada página
  if (pageId === 'relatorios') {
    atualizarGraficos();
    mostrarAlerta("Relatórios atualizados com os dados mais recentes", "info");
  } else if (pageId === 'novo-lancamento') {
    mostrarAlerta("Preencha os dados para adicionar um novo lançamento", "info");
  } else if (pageId === 'configuracoes') {
    mostrarAlerta("Personalize suas configurações", "info");
  }
}

function setActiveMenuItem(pageId) {
  // Remover classe ativa de todos os itens do menu
  document.querySelectorAll('.menu-item').forEach(item => {
    item.classList.remove('active');
  });

  // Adicionar classe ativa ao item correspondente
  document.querySelectorAll('.menu-item').forEach(item => {
    if (item.getAttribute('data-page') === pageId) {
      item.classList.add('active');
    }
  });
}

// Definir closeSidebar primeiro, já que é chamada por outras funções
function closeSidebar() {
  console.log("Fechando sidebar");
  
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) {
    console.error("Sidebar não encontrado");
    return;
  }
  
  sidebar.classList.remove('open');
  
  const toggleBtn = document.getElementById('toggleSidebar');
  if (toggleBtn) {
    toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
  }
  
  // Remover overlay
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) overlay.remove();
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  
  if (!sidebar) {
    console.error("Sidebar não encontrado");
    return;
  }
  
  if (sidebar.classList.contains('open')) {
    closeSidebar();
  } else {
    sidebar.classList.add('open');
    
    const toggleBtn = document.getElementById('toggleSidebar');
    if (toggleBtn) {
      toggleBtn.innerHTML = '<i class="fas fa-times"></i>';
    }
    
    // Adicionar overlay
    if (!document.getElementById('sidebar-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'sidebar-overlay';
      overlay.className = 'sidebar-overlay';
      
      // Importante: o overlay deve apenas fechar o sidebar, não interferir com os cliques nos itens do menu
      overlay.addEventListener('click', function(e) {
        // Verificar se o clique foi diretamente no overlay e não em um item do menu
        if (e.target === overlay) {
          closeSidebar();
        }
      });
      
      document.body.appendChild(overlay);
    }
  }
}

// Configurar eventos para fechar a barra lateral ao clicar fora dela
document.addEventListener('click', function(event) {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggleSidebar');
  
  if (sidebar && toggleBtn && window.innerWidth <= 768 && 
      sidebar.classList.contains('open') &&
      !sidebar.contains(event.target) &&
      event.target !== toggleBtn) {
    closeSidebar();
  }
});

// Configurar eventos para itens do menu
function setupMenuItemsEvents() {
  document.querySelectorAll('.menu-item').forEach(item => {
    // Remover qualquer evento de clique existente
    item.removeAttribute('onclick');
    
    // Adicionar novo evento de clique
    item.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation(); // Impedir propagação para o overlay
      
      const pageId = this.getAttribute('data-page');
      if (pageId) {
        console.log("Menu item clicado: " + pageId);
        
        // Primeiro, navegue para a página
        showPage(pageId);
        
        // Em telas menores, fechar o sidebar após a navegação
        if (window.innerWidth <= 768) {
          // Usar um atraso maior para garantir que a navegação ocorra primeiro
          setTimeout(function() {
            closeSidebar();
          }, 300);
        }
      }
    });
  });
}

// Funções para gerenciar lançamentos
function carregarLancamentos() {
  // Verificar se o objeto google está disponível
  if (typeof google === 'undefined' || !google.script) {
    console.error("API do Google Apps Script não está disponível");
    mostrarAlerta("Não foi possível conectar ao backend. Verifique sua conexão.", "error");
    
    // Carregar dados de exemplo para desenvolvimento
    carregarDadosExemplo();
    return;
  }

  google.script.run
    .withSuccessHandler(function(lancamentos) {
      processarLancamentos(lancamentos);
    })
    .withFailureHandler(function(error) {
      console.error("Erro ao carregar lançamentos:", error);
      mostrarAlerta("Erro ao carregar dados: " + error, "error");
      
      // Carregar dados de exemplo em caso de erro
      carregarDadosExemplo();
    })
    .obterLancamentos();
}

// Função para carregar dados de exemplo quando estiver desenvolvendo no GitHub
function carregarDadosExemplo() {
  console.log("Carregando dados de exemplo para desenvolvimento");
  
  const dadosExemplo = [
    {linha: 1, data: "01/11/2023", tipo: "Receita", valor: "R$ 3500,00", descricao: "Salário", categoria: "Salário"},
    {linha: 2, data: "05/11/2023", tipo: "Gasto", valor: "R$ 800,00", descricao: "Aluguel", categoria: "Moradia"},
    {linha: 3, data: "10/11/2023", tipo: "Gasto", valor: "R$ 350,00", descricao: "Supermercado", categoria: "Alimentação"},
    {linha: 4, data: "15/11/2023", tipo: "Gasto", valor: "R$ 120,00", descricao: "Conta de luz", categoria: "Moradia"},
    {linha: 5, data: "20/11/2023", tipo: "Gasto", valor: "R$ 80,00", descricao: "Internet", categoria: "Moradia"},
    {linha: 6, data: "25/11/2023", tipo: "Receita", valor: "R$ 500,00", descricao: "Freelance", categoria: "Outros"}
  ];
  
  processarLancamentos(dadosExemplo);
}

function processarLancamentos(lancamentos) {
  if (!Array.isArray(lancamentos) || lancamentos.length === 0) {
    console.warn("Nenhum lançamento encontrado.");
    document.getElementById("tabela-registros").innerHTML = "<tr><td colspan='6'>Nenhum registro encontrado</td></tr>";
    document.getElementById("painelResumo").innerHTML = `
      <div class="resumo-item">
        <span>Recebido:</span> <span>R$ 0,00</span>
      </div>
      <div class="resumo-item">
        <span>Gasto:</span> <span>R$ 0,00</span>
      </div>
      <div class="resumo-item">
        <span>Saldo:</span> <span>R$ 0,00</span>
      </div>
    `;
    lancamentosData = [];
    return;
  }
  
  lancamentosData = lancamentos;
  
  var tabela = document.getElementById("tabela-registros");
  tabela.innerHTML = "";
  var totalRecebido = 0, totalGasto = 0;
  
  lancamentos.forEach(function(lancamento) {
    if (!lancamento || typeof lancamento !== "object") return;
    
    var valor = parseFloat(String(lancamento.valor).replace("R$ ", "").replace(",", ".")) || 0;
    
    if (lancamento.tipo.toLowerCase() === 'gasto') {
      totalGasto += valor;
    } else {
      totalRecebido += valor;
    }
    
    var tipoIcone = lancamento.tipo.toLowerCase() === 'gasto' ? 
      '<i class="fas fa-arrow-down" style="color: #ff5252;"></i>' :
      '<i class="fas fa-arrow-up" style="color: #1de9b6;"></i>';
      
    var novaLinha = `<tr>
      <td>${lancamento.data}</td>
      <td>${tipoIcone} ${lancamento.tipo}</td>
      <td>R$ ${valor.toFixed(2).replace(".", ",")}</td>
      <td>${lancamento.descricao}</td>
      <td>${lancamento.categoria}</td>
      <td class="btn-action-group">
        <button class="btn-sm btn-excluir" onclick="excluirLancamento(${lancamento.linha})" title="Excluir">
          <i class="fas fa-trash"></i>
        </button>
        <input type="file" id="fileInput${lancamento.linha}" style="display: none;" onchange="uploadComprovante(${lancamento.linha})">
        <button class="btn-sm btn-comprovante" onclick="document.getElementById('fileInput${lancamento.linha}').click()" title="Adicionar comprovante">
          <i class="fas fa-upload"></i>
        </button>
        <button class="btn-sm btn-ver" onclick="verComprovante(${lancamento.linha})" title="Ver comprovante">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    </tr>`;
    
    tabela.innerHTML += novaLinha;
  });
  
  atualizarResumo(totalRecebido, totalGasto);
}

function enviar() {
  // Verificar se o Google Apps Script está disponível
  if (typeof google === 'undefined' || !google.script) {
    mostrarAlerta("Modo de demonstração: não é possível salvar dados.", "warning");
    return;
  }

  var tipoTransacao = document.getElementById("tipoTransacao").value;
  var valorInput = document.getElementById("valor").value.replace(",", ".");
  var valor = parseFloat(valorInput);
  var descricao = document.getElementById("descricao").value;
  var categoria = document.getElementById("categoria").value;

  // Validação básica
  if (isNaN(valor) || valor <= 0) {
    mostrarAlerta("Por favor, insira um valor válido maior que zero.", "warning");
    return;
  }

  if (!descricao.trim()) {
    mostrarAlerta("Por favor, insira uma descrição para a transação.", "warning");
    return;
  }

  // Mostrar indicador de carregamento
  document.getElementById("btnRegistrar").innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
  document.getElementById("btnRegistrar").disabled = true;

  google.script.run
    .withSuccessHandler(function(resposta) {
      mostrarAlerta(resposta, "success");
      // Limpar campos
      document.getElementById("valor").value = "";
      document.getElementById("descricao").value = "";
      // Restaurar botão
      document.getElementById("btnRegistrar").innerHTML = '<i class="fas fa-save"></i> Registrar';
      document.getElementById("btnRegistrar").disabled = false;
      // Recarregar dados
      carregarLancamentos();
    })
    .withFailureHandler(function(erro) {
      mostrarAlerta("Erro ao registrar: " + erro, "error");
      document.getElementById("btnRegistrar").innerHTML = '<i class="fas fa-save"></i> Registrar';
      document.getElementById("btnRegistrar").disabled = false;
    })
    .adicionarLancamento(tipoTransacao, valor, descricao, categoria);
}

function atualizarResumo(recebido, gasto) {
  var saldo = recebido - gasto;
  var painel = document.getElementById("painelResumo");
  
  painel.innerHTML = `
    <div class="resumo-item">
      <span>Recebido:</span> <span>R$ ${recebido.toFixed(2).replace(".", ",")}</span>
    </div>
    <div class="resumo-item">
      <span>Gasto:</span> <span>R$ ${gasto.toFixed(2).replace(".", ",")}</span>
    </div>
    <div class="resumo-item">
      <span>Saldo:</span> <span>R$ ${saldo.toFixed(2).replace(".", ",")}</span>
    </div>
  `;
  
  painel.className = saldo >= 0 ? "resumo positivo" : "resumo negativo";
}

function excluirLancamento(linha) {
  if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;
  
  // Verificar se o Google Apps Script está disponível
  if (typeof google === 'undefined' || !google.script) {
    mostrarAlerta("Modo de demonstração: não é possível excluir dados.", "warning");
    return;
  }

  google.script.run
    .withSuccessHandler(function(mensagem) {
      mostrarAlerta(mensagem, "success");
      carregarLancamentos();
    })
    .withFailureHandler(function(erro) {
      mostrarAlerta("Erro ao excluir: " + erro, "error");
    })
    .excluirLancamento(linha);
}

function uploadComprovante(linha) {
  var inputFile = document.getElementById(`fileInput${linha}`);
  var file = inputFile.files[0];
  
  if (!file) {
    mostrarAlerta("Por favor, selecione um arquivo.", "warning");
    return;
  }
  
  // Verificar tamanho do arquivo (limite de 5MB)
  if (file.size > 5 * 1024 * 1024) {
    mostrarAlerta("O arquivo é muito grande. O tamanho máximo é 5MB.", "warning");
    return;
  }
  
  mostrarAlerta("Enviando comprovante, aguarde...", "info");
  
  // Verificar se o Google Apps Script está disponível
  if (typeof google === 'undefined' || !google.script) {
    setTimeout(() => {
      mostrarAlerta("Modo de demonstração: comprovante simulado com sucesso.", "success");
    }, 1500);
    return;
  }
  
  var reader = new FileReader();
  reader.onload = function(e) {
    var fileData = e.target.result;
    // Remover o prefixo "data:mime/type;base64," caso exista
    var base64Data = fileData.split(',')[1];
    
    google.script.run
      .withSuccessHandler(function(response) {
        mostrarAlerta(response, "success");
        carregarLancamentos();
      })
      .withFailureHandler(function(erro) {
        mostrarAlerta("Erro ao enviar comprovante: " + erro, "error");
      })
      .uploadComprovante(linha, file.name, base64Data);
  };
  
  reader.readAsDataURL(file);
}

function verComprovante(linha) {
  document.getElementById("comprovanteModal").innerHTML = '<div style="text-align:center"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Carregando comprovante...</p></div>';
  document.getElementById("modalComprovante").style.display = "block";
  
  // Verificar se o Google Apps Script está disponível
  if (typeof google === 'undefined' || !google.script) {
    setTimeout(() => {
      // Mostrar uma imagem de exemplo
      document.getElementById("comprovanteModal").innerHTML = `
        <h3>Comprovante (Demonstração)</h3>
        <div style="text-align:center; margin-top:15px;">
          <p>Este é um comprovante de demonstração.</p>
          <img src="https://via.placeholder.com/400x300?text=Comprovante+Exemplo" style="max-width:100%; max-height:400px; border-radius:8px;">
        </div>
      `;
    }, 1000);
    return;
  }
  
  google.script.run
    .withSuccessHandler(function(response) {
      if (response) {
        // Verificar se é uma URL ou dados base64
        if (response.startsWith('http')) {
          document.getElementById("comprovanteModal").innerHTML = `
            <h3>Comprovante</h3>
            <div style="text-align:center; margin-top:15px;">
              <a href="${response}" target="_blank" class="btn-comprovante" style="display:inline-block; margin:10px;">
                <i class="fas fa-external-link-alt"></i> Abrir em nova aba
              </a>
              <iframe src="${response}" style="width:100%; height:400px; border:none; border-radius:8px; margin-top:10px;"></iframe>
            </div>
          `;
        } else {
          // Assumindo que é uma imagem base64
          document.getElementById("comprovanteModal").innerHTML = `
            <h3>Comprovante</h3>
            <div style="text-align:center; margin-top:15px;">
              <img src="${response}" style="max-width:100%; max-height:400px; border-radius:8px;">
            </div>
          `;
        }
      } else {
        document.getElementById("comprovanteModal").innerHTML = `
          <h3>Comprovante</h3>
          <div style="text-align:center; margin-top:15px;">
            <p>Nenhum comprovante encontrado para este lançamento.</p>
          </div>
        `;
      }
    })
    .withFailureHandler(function(erro) {
      document.getElementById("comprovanteModal").innerHTML = `
        <h3>Erro</h3>
        <div style="text-align:center; margin-top:15px;">
          <p>Não foi possível carregar o comprovante: ${erro}</p>
        </div>
      `;
    })
    .obterComprovante(linha);
}

// Funções para relatórios e gráficos
function changeTab(tabId) {
  // Desativar todas as abas
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Desativar todos os botões
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.remove('active');
  });
  
  // Ativar a aba selecionada
  document.getElementById(tabId).classList.add('active');
  
  // Ativar o botão correspondente
  document.querySelectorAll('.tab-button').forEach(button => {
    if (button.getAttribute('onclick') && button.getAttribute('onclick').includes(tabId)) {
      button.classList.add('active');
    }
  });
  
  // Atualizar gráficos quando mudar de aba
  atualizarGraficos();
}

function atualizarGraficos() {
  if (!lancamentosData || lancamentosData.length === 0) {
    mostrarAlerta("Não há dados suficientes para gerar gráficos.", "info");
    return;
  }
  
  // Verificar se Chart.js está disponível
  if (typeof Chart === 'undefined') {
    console.error("Chart.js não está disponível");
    mostrarAlerta("Biblioteca de gráficos não carregada corretamente.", "error");
    return;
  }
  
  // Destruir gráficos existentes para evitar duplicação
  if (chartGastosCategorias) chartGastosCategorias.destroy();
  if (chartEvolucaoMensal) chartEvolucaoMensal.destroy();
  if (chartReceitasDespesas) chartReceitasDespesas.destroy();
  
  // Gráfico de gastos por categoria
  criarGraficoGastosPorCategoria();
  
  // Gráfico de evolução mensal
  criarGraficoEvolucaoMensal();
  
  // Gráfico de receitas x despesas
  criarGraficoReceitasDespesas();
}

function criarGraficoGastosPorCategoria() {
  // Verificar se o elemento canvas existe
  const canvas = document.getElementById('chartGastosCategorias');
  if (!canvas) {
    console.error("Canvas para gráfico de categorias não encontrado");
    return;
  }

  // Filtrar apenas gastos
  const gastos = lancamentosData.filter(lancamento => 
    lancamento.tipo.toLowerCase() === 'gasto'
  );
  
  // Agrupar por categoria
  const categorias = {};
  gastos.forEach(lancamento => {
    const valor = parseFloat(String(lancamento.valor).replace("R$ ", "").replace(",", ".")) || 0;
    if (categorias[lancamento.categoria]) {
      categorias[lancamento.categoria] += valor;
    } else {
      categorias[lancamento.categoria] = valor;
    }
  });
  
  // Preparar dados para o gráfico
  const labels = Object.keys(categorias);
  const data = Object.values(categorias);
  
  // Gerar cores aleatórias para cada categoria
  const backgroundColors = labels.map(() => 
    `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`
  );
  
  // Criar gráfico
  const ctx = canvas.getContext('2d');
  
  chartGastosCategorias = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColors,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#fff',
            font: {
              size: 12
            }
          }
        },
        title: {
          display: true,
          text: 'Gastos por Categoria',
          color: '#fff',
          font: {
            size: 16
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              return `R$ ${value.toFixed(2).replace('.', ',')}`;
            }
          }
        }
      }
    }
  });
}

function criarGraficoEvolucaoMensal() {
  // Verificar se o elemento canvas existe
  const canvas = document.getElementById('chartEvolucaoMensal');
  if (!canvas) {
    console.error("Canvas para gráfico de evolução mensal não encontrado");
    return;
  }

  // Agrupar por mês
  const meses = {};
  
  lancamentosData.forEach(lancamento => {
    const dataParts = lancamento.data.split('/');
    if (dataParts.length !== 3) return;
    
    const mes = `${dataParts[1]}/${dataParts[2]}`;
    const valor = parseFloat(String(lancamento.valor).replace("R$ ", "").replace(",", ".")) || 0;
    
    if (!meses[mes]) {
      meses[mes] = { receitas: 0, despesas: 0 };
    }
    
    if (lancamento.tipo.toLowerCase() === 'gasto') {
      meses[mes].despesas += valor;
    } else {
      meses[mes].receitas += valor;
    }
  });
  
  // Ordenar meses cronologicamente
  const mesesOrdenados = Object.keys(meses).sort((a, b) => {
    const [mesA, anoA] = a.split('/');
    const [mesB, anoB] = b.split('/');
    return new Date(anoA, mesA - 1) - new Date(anoB, mesB - 1);
  });
  
  // Preparar dados para o gráfico
  const receitas = mesesOrdenados.map(mes => meses[mes].receitas);
  const despesas = mesesOrdenados.map(mes => meses[mes].despesas);
  const saldos = mesesOrdenados.map(mes => meses[mes].receitas - meses[mes].despesas);
  
  // Criar gráfico
  const ctx = canvas.getContext('2d');
  chartEvolucaoMensal = new Chart(ctx, {
    type: 'line',
    data: {
      labels: mesesOrdenados,
      datasets: [
        {
          label: 'Receitas',
          data: receitas,
          borderColor: '#1de9b6',
          backgroundColor: 'rgba(29, 233, 182, 0.1)',
          tension: 0.3,
          fill: true
        },
        {
          label: 'Despesas',
          data: despesas,
          borderColor: '#ff5252',
          backgroundColor: 'rgba(255, 82, 82, 0.1)',
          tension: 0.3,
          fill: true
        },
        {
          label: 'Saldo',
          data: saldos,
          borderColor: '#ffeb3b',
          backgroundColor: 'rgba(255, 235, 59, 0.1)',
          tension: 0.3,
          borderDash: [5, 5],
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: {
            color: '#fff',
            callback: function(value) {
              return 'R$ ' + value.toFixed(2).replace('.', ',');
            }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        x: {
          ticks: {
            color: '#fff'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#fff'
          }
        },
        title: {
          display: true,
          text: 'Evolução Mensal',
          color: '#fff',
          font: {
            size: 16
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              return `${context.dataset.label}: R$ ${value.toFixed(2).replace('.', ',')}`;
            }
          }
        }
      }
    }
  });
}

function criarGraficoReceitasDespesas() {
  // Verificar se o elemento canvas existe
  const canvas = document.getElementById('chartReceitasDespesas');
  if (!canvas) {
    console.error("Canvas para gráfico de receitas x despesas não encontrado");
    return;
  }

  // Calcular totais
  let totalReceitas = 0;
  let totalDespesas = 0;
  
  lancamentosData.forEach(lancamento => {
    const valor = parseFloat(String(lancamento.valor).replace("R$ ", "").replace(",", ".")) || 0;
    
    if (lancamento.tipo.toLowerCase() === 'gasto') {
      totalDespesas += valor;
    } else {
      totalReceitas += valor;
    }
  });
  
  // Criar gráfico
  const ctx = canvas.getContext('2d');
  chartReceitasDespesas = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Receitas', 'Despesas'],
      datasets: [{
        data: [totalReceitas, totalDespesas],
                backgroundColor: ['rgba(29, 233, 182, 0.7)', 'rgba(255, 82, 82, 0.7)'],
        borderColor: ['#1de9b6', '#ff5252'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#fff',
            callback: function(value) {
              return 'R$ ' + value.toFixed(2).replace('.', ',');
            }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        x: {
          ticks: {
            color: '#fff'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: 'Receitas x Despesas',
          color: '#fff',
          font: {
            size: 16
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              return `R$ ${value.toFixed(2).replace('.', ',')}`;
            }
          }
        }
      }
    }
  });
}

function updateThemeColor(property, value) {
  document.documentElement.style.setProperty(`--${property}`, value);
  
  // Salvar preferências no localStorage
  const themePreferences = JSON.parse(localStorage.getItem('themePreferences') || '{}');
  themePreferences[property] = value;
  localStorage.setItem('themePreferences', JSON.stringify(themePreferences));
  
  // Atualizar gráficos se necessário
  if (document.getElementById('relatorios') && document.getElementById('relatorios').classList.contains('active')) {
    atualizarGraficos();
  }
  
  mostrarAlerta("Tema atualizado com sucesso!", "success");
}

function adicionarCategoria() {
  const novaCategoria = document.getElementById('novaCategoria').value.trim();
  
  if (!novaCategoria) {
    mostrarAlerta("Por favor, insira um nome para a categoria.", "warning");
    return;
  }
  
  if (categorias.includes(novaCategoria)) {
    mostrarAlerta("Esta categoria já existe.", "warning");
    return;
  }
  
  categorias.push(novaCategoria);
  atualizarListaCategorias();
  atualizarSelectCategorias();
  
  document.getElementById('novaCategoria').value = '';
  mostrarAlerta("Categoria adicionada com sucesso!", "success");
  
  // Salvar categorias no localStorage
  localStorage.setItem('categorias', JSON.stringify(categorias));
}

function removerCategoria(index) {
  if (!confirm("Tem certeza que deseja remover esta categoria?")) return;
  
  categorias.splice(index, 1);
  atualizarListaCategorias();
  atualizarSelectCategorias();
  
  mostrarAlerta("Categoria removida com sucesso!", "success");
  
  // Salvar categorias no localStorage
  localStorage.setItem('categorias', JSON.stringify(categorias));
}

function atualizarListaCategorias() {
  const listaCategorias = document.getElementById('listaCategorias');
  if (!listaCategorias) {
    console.error("Elemento listaCategorias não encontrado");
    return;
  }
  
  listaCategorias.innerHTML = '';
  
  categorias.forEach((categoria, index) => {
    const item = document.createElement('div');
    item.className = 'resumo-item';
    item.style.justifyContent = 'space-between';
    item.style.marginBottom = '5px';
    
    item.innerHTML = `
      <span>${categoria}</span>
      <button class="btn-sm btn-excluir" onclick="removerCategoria(${index})" style="margin: 0; width: auto;">
        <i class="fas fa-trash"></i>
      </button>
    `;
    
    listaCategorias.appendChild(item);
  });
}

function atualizarSelectCategorias() {
  const select = document.getElementById('categoria');
  if (!select) {
    console.error("Elemento select de categorias não encontrado");
    return;
  }
  
  const valorAtual = select.value;
  
  select.innerHTML = '';
  
  categorias.forEach(categoria => {
    const option = document.createElement('option');
    option.value = categoria;
    option.textContent = categoria;
    select.appendChild(option);
  });
  
  // Tentar manter a seleção anterior
  if (categorias.includes(valorAtual)) {
    select.value = valorAtual;
  }
}

function exportarDados() {
  if (!lancamentosData || lancamentosData.length === 0) {
    mostrarAlerta("Não há dados para exportar.", "warning");
    return;
  }
  
  const dados = {
    lancamentos: lancamentosData,
    categorias: categorias,
    dataExportacao: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(dados, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `controle_financeiro_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  mostrarAlerta("Dados exportados com sucesso!", "success");
}

function importarDados() {
  const fileInput = document.getElementById('importarArquivo');
  if (!fileInput) {
    console.error("Elemento importarArquivo não encontrado");
    return;
  }
  
  const file = fileInput.files[0];
  
  if (!file) {
    mostrarAlerta("Por favor, selecione um arquivo para importar.", "warning");
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const dados = JSON.parse(e.target.result);
      
      if (!dados.lancamentos || !Array.isArray(dados.lancamentos)) {
        throw new Error("Formato de arquivo inválido.");
      }
      
      // Verificar se o Google Apps Script está disponível
      if (typeof google === 'undefined' || !google.script) {
        mostrarAlerta("Modo de demonstração: dados importados apenas para visualização.", "info");
        
        // Atualizar dados localmente
        lancamentosData = dados.lancamentos;
        if (dados.categorias && Array.isArray(dados.categorias)) {
          categorias = dados.categorias;
          atualizarListaCategorias();
          atualizarSelectCategorias();
          localStorage.setItem('categorias', JSON.stringify(categorias));
        }
        
        // Atualizar interface
        processarLancamentos(lancamentosData);
        if (document.getElementById('relatorios').classList.contains('active')) {
          atualizarGraficos();
        }
      } else {
        // Implementar lógica para enviar ao Google Apps Script
        mostrarAlerta("Importação para o servidor ainda não implementada.", "info");
      }
      
      // Limpar o input de arquivo
      fileInput.value = '';
    } catch (error) {
      mostrarAlerta("Erro ao importar dados: " + error.message, "error");
    }
  };
  
  reader.readAsText(file);
}

// Função para mostrar alertas estilizados
function mostrarAlerta(mensagem, tipo = "info") {
  // Remover alertas anteriores com o mesmo tipo
  const alertasAntigos = document.querySelectorAll(`.alerta-flutuante.alerta-${tipo}`);
  alertasAntigos.forEach(alerta => {
    alerta.classList.add('fechar');
    setTimeout(() => {
      if (alerta.parentElement) {
        alerta.remove();
      }
    }, 500);
  });
  
  // Criar novo alerta
  const alerta = document.createElement('div');
  alerta.className = `alerta-flutuante alerta-${tipo}`;
  
  // Definir ícone baseado no tipo
  let icone = 'info-circle';
  if (tipo === 'success') icone = 'check-circle';
  if (tipo === 'error') icone = 'exclamation-circle';
  if (tipo === 'warning') icone = 'exclamation-triangle';
  
  alerta.innerHTML = `
    <i class="fas fa-${icone}"></i>
    <span>${mensagem}</span>
    <button onclick="this.parentElement.classList.add('fechar'); setTimeout(() => this.parentElement.remove(), 500);">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  document.body.appendChild(alerta);
  
  // Auto-remover após 5 segundos
  setTimeout(() => {
    if (alerta.parentElement) {
      alerta.classList.add('fechar');
      setTimeout(() => {
        if (alerta.parentElement) {
          alerta.remove();
        }
      }, 500);
    }
  }, 5000);
}

function adjustLayout() {
  const isLandscape = window.innerWidth > window.innerHeight;
  const isMobile = window.innerWidth <= 768;
  
  if (isLandscape && isMobile) {
    document.body.classList.add('landscape-mobile');
  } else {
    document.body.classList.remove('landscape-mobile');
  }
  
  // Ajustar altura da tabela com base no espaço disponível
  const mainContent = document.querySelector('.main-content');
  const container = document.querySelector('.container');
  const historico = document.querySelector('.historico');
  
  if (historico && container && mainContent) {
    const otherElementsHeight = container.offsetHeight - historico.offsetHeight;
    const availableHeight = mainContent.offsetHeight - otherElementsHeight - 40; // 40px de margem
    
    if (availableHeight > 150) { // Altura mínima razoável
      historico.style.maxHeight = `${availableHeight}px`;
    }
  }
}

// Carregar preferências de tema salvas
function carregarPreferenciasDeTemasalvas() {
  const themePreferences = JSON.parse(localStorage.getItem('themePreferences') || '{}');
  
  for (const [property, value] of Object.entries(themePreferences)) {
    document.documentElement.style.setProperty(`--${property}`, value);
    
    // Atualizar inputs de cores
    const inputId = property.replace(/-/g, '') + 'Color';
    const input = document.getElementById(inputId);
    if (input) input.value = value;
  }
}

// Carregar categorias salvas
function carregarCategoriasSalvas() {
  const categoriasSalvas = JSON.parse(localStorage.getItem('categorias'));
  if (categoriasSalvas && Array.isArray(categoriasSalvas) && categoriasSalvas.length > 0) {
    categorias = categoriasSalvas;
  }
}

// Fechar modal de comprovante
function fecharModalComprovante() {
  const modal = document.getElementById('modalComprovante');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Adicionar listener para fechar modal ao clicar fora
window.addEventListener('click', function(event) {
  const modal = document.getElementById('modalComprovante');
  if (modal && event.target === modal) {
    fecharModalComprovante();
  }
});


