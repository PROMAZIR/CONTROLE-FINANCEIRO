// Variáveis globais
let categorias = ['Alimentação', 'Transporte', 'Lazer', 'Calçados', 'Moradia', 'Saúde', 'Educação', 'Investimentos', 'Salário', 'Outros'];
let lancamentosData = [];
let chartGastosCategorias, chartEvolucaoMensal, chartReceitasDespesas;
let apiUrl = 'https://script.google.com/macros/s/AKfycbw7y6XzCAjEVMYMI-WhflFE6eqiDVHWCbHQfr5At7LRuOwQ1-tN6DfRmq1yjIYsMdhuiA/exec';

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    // Carregar URL da API do localStorage
    apiUrl = localStorage.getItem('apiUrl') || '';
    if (apiUrl) {
        document.getElementById('apiUrl').value = apiUrl;
    }

    // Carregar preferências de tema
    carregarPreferenciasDeTemasalvas();
    
    // Carregar categorias salvas
    carregarCategoriasSalvas();
    
    // Configurar eventos dos itens de menu
    setupMenuItemsEvents();
    
    // Ajustar layout
    adjustLayout();
    
    // Mostrar data atual
    mostrarDataAtual();
    
    // Inicializar sistema
    inicializar();
    
    // Adicionar listener para redimensionamento da janela
    window.addEventListener('resize', adjustLayout);
});

function inicializar() {
    atualizarListaCategorias();
    atualizarSelectCategorias();
    setActiveMenuItem('dashboard');
    
    // Definir data padrão para hoje
    document.getElementById('dataTransacao').valueAsDate = new Date();
    
    // Verificar se a URL da API está configurada
    if (!apiUrl) {
        mostrarAlerta("Por favor, configure a URL da API nas configurações para começar.", "warning");
        showPage('configuracoes');
    } else {
        carregarLancamentos();
        mostrarAlerta("Sistema de controle financeiro carregado com sucesso!", "info");
    }
}

function mostrarDataAtual() {
    const dataAtual = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('dataAtual').textContent = dataAtual.toLocaleDateString('pt-BR', options);
}

// Funções de navegação
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

function closeSidebar() {
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
    
    if (sidebar.classList.contains('open')) {
        closeSidebar();
    } else {
        sidebar.classList.add('open');
        
        const toggleBtn = document.getElementById('toggleSidebar');
        toggleBtn.innerHTML = '<i class="fas fa-times"></i>';
        
        // Adicionar overlay
        if (!document.getElementById('sidebar-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'sidebar-overlay';
            overlay.className = 'sidebar-overlay';
            
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) {
                    closeSidebar();
                }
            });
            
            document.body.appendChild(overlay);
        }
    }
}

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
async function carregarLancamentos() {
    if (!apiUrl) {
        mostrarAlerta("URL da API não configurada. Configure nas configurações.", "warning");
        return;
    }

    try {
        mostrarAlerta("Carregando lançamentos...", "info");
        
        const response = await fetch(`${apiUrl}?action=obterLancamentos`);
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || "Erro ao carregar lançamentos");
        }
        
        const lancamentos = data.data;
        
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
                    <button class="btn-sm btn-excluir" onclick="excluirLancamento(${lancamento.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                    <input type="file" id="fileInput${lancamento.id}" style="display: none;" onchange="uploadComprovante(${lancamento.id})">
                    <button class="btn-sm btn-comprovante" onclick="document.getElementById('fileInput${lancamento.id}').click()" title="Adicionar comprovante">
                        <i class="fas fa-upload"></i>
                    </button>
                    <button class="btn-sm btn-ver" onclick="verComprovante(${lancamento.id})" title="Ver comprovante">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>`;
            
            tabela.innerHTML += novaLinha;
        });
        
        atualizarResumo(totalRecebido, totalGasto);
        mostrarAlerta("Lançamentos carregados com sucesso!", "success");
    } catch (error) {
        console.error("Erro ao carregar lançamentos:", error);
        mostrarAlerta("Erro ao carregar lançamentos: " + error.message, "error");
    }
}

async function enviar() {
    if (!apiUrl) {
        mostrarAlerta("URL da API não configurada. Configure nas configurações.", "warning");
        return;
    }

    var tipoTransacao = document.getElementById("tipoTransacao").value;
    var valorInput = document.getElementById("valor").value.replace(",", ".");
    var valor = parseFloat(valorInput);
    var descricao = document.getElementById("descricao").value;
    var categoria = document.getElementById("categoria").value;
    var data = document.getElementById("dataTransacao").value;
    
    // Validação básica
    if (isNaN(valor) || valor <= 0) {
        mostrarAlerta("Por favor, insira um valor válido maior que zero.", "warning");
        return;
    }
    
    if (!descricao.trim()) {
        mostrarAlerta("Por favor, insira uma descrição para a transação.", "warning");
        return;
    }
    
    if (!data) {
        mostrarAlerta("Por favor, selecione uma data para a transação.", "warning");
        return;
    }
    
    // Mostrar indicador de carregamento
    document.getElementById("btnRegistrar").innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    document.getElementById("btnRegistrar").disabled = true;
    
    try {
        const formData = new FormData();
        formData.append('action', 'adicionarLancamento');
        formData.append('tipo', tipoTransacao);
        formData.append('valor', valor);
        formData.append('descricao', descricao);
        formData.append('categoria', categoria);
        formData.append('data', data);
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || "Erro ao adicionar lançamento");
        }
        
        mostrarAlerta(data.message || "Lançamento registrado com sucesso!", "success");
        
        // Limpar campos
        document.getElementById("valor").value = "";
        document.getElementById("descricao").value = "";
        document.getElementById("dataTransacao").valueAsDate = new Date();
        
        // Restaurar botão
        document.getElementById("btnRegistrar").innerHTML = '<i class="fas fa-save"></i> Registrar';
        document.getElementById("btnRegistrar").disabled = false;
        
        // Recarregar dados
        carregarLancamentos();
    } catch (error) {
        mostrarAlerta("Erro ao registrar: " + error.message, "error");
        document.getElementById("btnRegistrar").innerHTML = '<i class="fas fa-save"></i> Registrar';
        document.getElementById("btnRegistrar").disabled = false;
    }
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

async function excluirLancamento(id) {
    if (!apiUrl) {
        mostrarAlerta("URL da API não configurada. Configure nas configurações.", "warning");
        return;
    }

    if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;
    
    try {
        const formData = new FormData();
        formData.append('action', 'excluirLancamento');
        formData.append('id', id);
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || "Erro ao excluir lançamento");
        }
        
        mostrarAlerta(data.message || "Lançamento excluído com sucesso!", "success");
        carregarLancamentos();
    } catch (error) {
        mostrarAlerta("Erro ao excluir: " + error.message, "error");
    }
}

async function uploadComprovante(id) {
    if (!apiUrl) {
        mostrarAlerta("URL da API não configurada. Configure nas configurações.", "warning");
        return;
    }

    var inputFile = document.getElementById(`fileInput${id}`);
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
    
    try {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const fileData = e.target.result;
            // Remover o prefixo "data:mime/type;base64," caso exista
            const base64Data = fileData.split(',')[1];
            
            const formData = new FormData();
            formData.append('action', 'uploadComprovante');
            formData.append('id', id);
            formData.append('fileName', file.name);
            formData.append('fileData', base64Data);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || "Erro ao enviar comprovante");
            }
            
            mostrarAlerta(data.message || "Comprovante enviado com sucesso!", "success");
            carregarLancamentos();
        };
        
        reader.readAsDataURL(file);
    } catch (error) {
        mostrarAlerta("Erro ao enviar comprovante: " + error.message, "error");
    }
}

async function verComprovante(id) {
    if (!apiUrl) {
        mostrarAlerta("URL da API não configurada. Configure nas configurações.", "warning");
        return;
    }

    document.getElementById("comprovanteModal").innerHTML = '<div style="text-align:center"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Carregando comprovante...</p></div>';
    document.getElementById("modalComprovante").style.display = "block";
    
    try {
        const response = await fetch(`${apiUrl}?action=obterComprovante&id=${id}`);
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || "Erro ao obter comprovante");
        }
        
        const comprovante = data.data;
        
        if (comprovante) {
            // Verificar se é uma URL ou dados base64
            if (comprovante.startsWith('http')) {
                document.getElementById("comprovanteModal").innerHTML = `
                    <h3>Comprovante</h3>
                    <div style="text-align:center; margin-top:15px;">
                        <a href="${comprovante}" target="_blank" class="btn-comprovante" style="display:inline-block; margin:10px;">
                            <i class="fas fa-external-link-alt"></i> Abrir em nova aba
                        </a>
                        <iframe src="${comprovante}" style="width:100%; height:400px; border:none; border-radius:8px; margin-top:10px;"></iframe>
                    </div>
                `;
            } else {
                // Assumindo que é uma imagem base64
                document.getElementById("comprovanteModal").innerHTML = `
                    <h3>Comprovante</h3>
                    <div style="text-align:center; margin-top:15px;">
                        <img src="${comprovante}" style="max-width:100%; max-height:400px; border-radius:8px;">
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
    } catch (error) {
        document.getElementById("comprovanteModal").innerHTML = `
            <h3>Erro</h3>
            <div style="text-align:center; margin-top:15px;">
                <p>Não foi possível carregar o comprovante: ${error.message}</p>
            </div>
        `;
    }
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
                if (button.getAttribute('onclick').includes(tabId)) {
            button.classList.add('active');
        }
    });
    
    // Redimensionar gráficos
    if (chartGastosCategorias) chartGastosCategorias.resize();
    if (chartEvolucaoMensal) chartEvolucaoMensal.resize();
    if (chartReceitasDespesas) chartReceitasDespesas.resize();
}

function atualizarGraficos() {
    if (!lancamentosData || lancamentosData.length === 0) {
        document.getElementById('graficoGastosCategorias').innerHTML = '<div class="sem-dados">Nenhum dado disponível para exibir</div>';
        document.getElementById('graficoEvolucaoMensal').innerHTML = '<div class="sem-dados">Nenhum dado disponível para exibir</div>';
        document.getElementById('graficoReceitasDespesas').innerHTML = '<div class="sem-dados">Nenhum dado disponível para exibir</div>';
        return;
    }
    
    // Inicializar gráficos
    inicializarGraficoGastosPorCategoria();
    inicializarGraficoEvolucaoMensal();
    inicializarGraficoReceitasDespesas();
    
    // Ativar a primeira aba por padrão
    changeTab('tabGastosCategorias');
}

function inicializarGraficoGastosPorCategoria() {
    // Preparar dados para o gráfico
    const gastosPorCategoria = {};
    
    // Filtrar apenas os gastos
    const gastos = lancamentosData.filter(lancamento => 
        lancamento.tipo.toLowerCase() === 'gasto'
    );
    
    // Agrupar por categoria
    gastos.forEach(lancamento => {
        const categoria = lancamento.categoria || 'Outros';
        const valor = parseFloat(String(lancamento.valor).replace("R$ ", "").replace(",", ".")) || 0;
        
        if (!gastosPorCategoria[categoria]) {
            gastosPorCategoria[categoria] = 0;
        }
        
        gastosPorCategoria[categoria] += valor;
    });
    
    // Converter para arrays para o gráfico
    const categorias = Object.keys(gastosPorCategoria);
    const valores = Object.values(gastosPorCategoria);
    
    // Cores para as categorias
    const cores = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#C9CBCF', '#7FD8BE', '#A1C181', '#FCCA46'
    ];
    
    // Configurar o gráfico
    const ctx = document.getElementById('graficoGastosCategorias').getContext('2d');
    
    if (chartGastosCategorias) {
        chartGastosCategorias.destroy();
    }
    
    chartGastosCategorias = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categorias,
            datasets: [{
                data: valores,
                backgroundColor: cores.slice(0, categorias.length),
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
                        color: '#e0e0e0'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${context.label}: R$ ${value.toFixed(2)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function inicializarGraficoEvolucaoMensal() {
    // Preparar dados para o gráfico
    const dadosPorMes = {};
    
    // Processar cada lançamento
    lancamentosData.forEach(lancamento => {
        const data = new Date(lancamento.data);
        const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
        const valor = parseFloat(String(lancamento.valor).replace("R$ ", "").replace(",", ".")) || 0;
        
        if (!dadosPorMes[mes]) {
            dadosPorMes[mes] = {
                receitas: 0,
                gastos: 0
            };
        }
        
        if (lancamento.tipo.toLowerCase() === 'receita') {
            dadosPorMes[mes].receitas += valor;
        } else {
            dadosPorMes[mes].gastos += valor;
        }
    });
    
    // Ordenar meses
    const mesesOrdenados = Object.keys(dadosPorMes).sort();
    
    // Formatar labels para exibição
    const mesesFormatados = mesesOrdenados.map(mes => {
        const [ano, mesNum] = mes.split('-');
        const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${nomesMeses[parseInt(mesNum) - 1]}/${ano.slice(2)}`;
    });
    
    // Preparar dados para o gráfico
    const receitas = mesesOrdenados.map(mes => dadosPorMes[mes].receitas);
    const gastos = mesesOrdenados.map(mes => dadosPorMes[mes].gastos);
    const saldos = mesesOrdenados.map(mes => dadosPorMes[mes].receitas - dadosPorMes[mes].gastos);
    
    // Configurar o gráfico
    const ctx = document.getElementById('graficoEvolucaoMensal').getContext('2d');
    
    if (chartEvolucaoMensal) {
        chartEvolucaoMensal.destroy();
    }
    
    chartEvolucaoMensal = new Chart(ctx, {
        type: 'line',
        data: {
            labels: mesesFormatados,
            datasets: [
                {
                    label: 'Receitas',
                    data: receitas,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Gastos',
                    data: gastos,
                    borderColor: '#F44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Saldo',
                    data: saldos,
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#e0e0e0'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: R$ ${context.raw.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#e0e0e0'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#e0e0e0',
                        callback: function(value) {
                            return 'R$ ' + value;
                        }
                    }
                }
            }
        }
    });
}

function inicializarGraficoReceitasDespesas() {
    // Calcular totais
    let totalReceitas = 0;
    let totalGastos = 0;
    
    lancamentosData.forEach(lancamento => {
        const valor = parseFloat(String(lancamento.valor).replace("R$ ", "").replace(",", ".")) || 0;
        
        if (lancamento.tipo.toLowerCase() === 'receita') {
            totalReceitas += valor;
        } else {
            totalGastos += valor;
        }
    });
    
    // Configurar o gráfico
    const ctx = document.getElementById('graficoReceitasDespesas').getContext('2d');
    
    if (chartReceitasDespesas) {
        chartReceitasDespesas.destroy();
    }
    
    chartReceitasDespesas = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Receitas vs Despesas'],
            datasets: [
                {
                    label: 'Receitas',
                    data: [totalReceitas],
                    backgroundColor: 'rgba(76, 175, 80, 0.7)',
                    borderColor: '#4CAF50',
                    borderWidth: 1
                },
                {
                    label: 'Despesas',
                    data: [totalGastos],
                    backgroundColor: 'rgba(244, 67, 54, 0.7)',
                    borderColor: '#F44336',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#e0e0e0'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: R$ ${context.raw.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#e0e0e0'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#e0e0e0',
                        callback: function(value) {
                            return 'R$ ' + value;
                        }
                    }
                }
            }
        }
    });
}

// Funções para gerenciar categorias
function carregarCategoriasSalvas() {
    const categoriasString = localStorage.getItem('categorias');
    if (categoriasString) {
        categorias = JSON.parse(categoriasString);
    }
}

function atualizarListaCategorias() {
    const listaCategorias = document.getElementById('listaCategorias');
    if (!listaCategorias) return;
    
    listaCategorias.innerHTML = '';
    
    categorias.forEach((categoria, index) => {
        const item = document.createElement('div');
        item.className = 'categoria-item';
        item.innerHTML = `
            <span>${categoria}</span>
            <button class="btn-sm btn-excluir" onclick="removerCategoria(${index})">
                <i class="fas fa-trash"></i>
            </button>
        `;
        listaCategorias.appendChild(item);
    });
}

function atualizarSelectCategorias() {
    const selectCategorias = document.getElementById('categoria');
    if (!selectCategorias) return;
    
    // Salvar a categoria selecionada atualmente
    const categoriaAtual = selectCategorias.value;
    
    // Limpar opções existentes
    selectCategorias.innerHTML = '';
    
    // Adicionar novas opções
    categorias.forEach(categoria => {
        const option = document.createElement('option');
        option.value = categoria;
        option.textContent = categoria;
        selectCategorias.appendChild(option);
    });
    
    // Restaurar a categoria selecionada, se possível
    if (categorias.includes(categoriaAtual)) {
        selectCategorias.value = categoriaAtual;
    }
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
    localStorage.setItem('categorias', JSON.stringify(categorias));
    
    document.getElementById('novaCategoria').value = '';
    atualizarListaCategorias();
    atualizarSelectCategorias();
    
    mostrarAlerta("Categoria adicionada com sucesso!", "success");
}

function removerCategoria(index) {
    if (!confirm("Tem certeza que deseja remover esta categoria?")) return;
    
    categorias.splice(index, 1);
    localStorage.setItem('categorias', JSON.stringify(categorias));
    
    atualizarListaCategorias();
    atualizarSelectCategorias();
    
    mostrarAlerta("Categoria removida com sucesso!", "success");
}

// Funções para configurações
function salvarConfiguracoes() {
    // Salvar URL da API
    const novaApiUrl = document.getElementById('apiUrl').value.trim();
    
    if (novaApiUrl !== apiUrl) {
        apiUrl = novaApiUrl;
        localStorage.setItem('apiUrl', apiUrl);
        mostrarAlerta("URL da API atualizada com sucesso!", "success");
        
        // Recarregar dados se a URL foi alterada
        if (apiUrl) {
            carregarLancamentos();
        }
    }
    
    // Salvar tema
    const tema = document.querySelector('input[name="tema"]:checked').value;
    localStorage.setItem('tema', tema);
    aplicarTema(tema);
    
    mostrarAlerta("Configurações salvas com sucesso!", "success");
}

function carregarPreferenciasDeTemasalvas() {
       const temaSalvo = localStorage.getItem('tema') || 'escuro';
    
    // Marcar o radio button correto
    document.querySelectorAll('input[name="tema"]').forEach(input => {
        if (input.value === temaSalvo) {
            input.checked = true;
        }
    });
    
    // Aplicar o tema
    aplicarTema(temaSalvo);
}

function aplicarTema(tema) {
    const body = document.body;
    
    // Remover classes de tema existentes
    body.classList.remove('tema-escuro', 'tema-claro', 'tema-azul');
    
    // Adicionar a classe do tema selecionado
    body.classList.add(`tema-${tema}`);
    
    // Atualizar variáveis CSS de acordo com o tema
    if (tema === 'escuro') {
        document.documentElement.style.setProperty('--background-color', '#121212');
        document.documentElement.style.setProperty('--card-background', '#1e1e1e');
        document.documentElement.style.setProperty('--text-color', '#e0e0e0');
        document.documentElement.style.setProperty('--border-color', '#333');
    } else if (tema === 'claro') {
        document.documentElement.style.setProperty('--background-color', '#f5f5f5');
        document.documentElement.style.setProperty('--card-background', '#ffffff');
        document.documentElement.style.setProperty('--text-color', '#333333');
        document.documentElement.style.setProperty('--border-color', '#ddd');
    } else if (tema === 'azul') {
        document.documentElement.style.setProperty('--background-color', '#0a1929');
        document.documentElement.style.setProperty('--card-background', '#132f4c');
        document.documentElement.style.setProperty('--text-color', '#e3f2fd');
        document.documentElement.style.setProperty('--border-color', '#1e4976');
    }
}

// Funções de utilidade
function adjustLayout() {
    const isLandscape = window.innerWidth > window.innerHeight;
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile && isLandscape) {
        document.body.classList.add('landscape-mobile');
    } else {
        document.body.classList.remove('landscape-mobile');
    }
}

function mostrarAlerta(mensagem, tipo) {
    // Remover alertas existentes
    const alertasExistentes = document.querySelectorAll('.alerta-flutuante');
    alertasExistentes.forEach(alerta => {
        alerta.classList.add('fechar');
        setTimeout(() => {
            alerta.remove();
        }, 300);
    });
    
    // Criar novo alerta
    const alerta = document.createElement('div');
    alerta.className = `alerta-flutuante alerta-${tipo}`;
    
    // Definir ícone com base no tipo
    let icone = '';
    switch (tipo) {
        case 'success':
            icone = '<i class="fas fa-check-circle"></i>';
            break;
        case 'warning':
            icone = '<i class="fas fa-exclamation-triangle"></i>';
            break;
        case 'error':
            icone = '<i class="fas fa-times-circle"></i>';
            break;
        case 'info':
        default:
            icone = '<i class="fas fa-info-circle"></i>';
            break;
    }
    
    alerta.innerHTML = `
        ${icone}
        <span>${mensagem}</span>
        <button onclick="fecharAlerta(this.parentNode)">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(alerta);
    
    // Fechar automaticamente após 5 segundos
    setTimeout(() => {
        fecharAlerta(alerta);
    }, 5000);
}

function fecharAlerta(alerta) {
    if (!alerta) return;
    
    alerta.classList.add('fechar');
    setTimeout(() => {
        alerta.remove();
    }, 300);
}

// Funções para modal
function fecharModal() {
    document.getElementById("modalComprovante").style.display = "none";
}

// Fechar modal ao clicar fora dele
window.onclick = function(event) {
    const modal = document.getElementById("modalComprovante");
    if (event.target === modal) {
        fecharModal();
    }
};


