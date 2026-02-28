let erros = JSON.parse(localStorage.getItem("erros")) || [];
let colaboradores = JSON.parse(localStorage.getItem("colaboradores")) || [];
let assuntos = JSON.parse(localStorage.getItem("assuntos")) || [];

// Limpeza única dos dados de teste criados anteriormente
if (!localStorage.getItem("limpeza_testes_realizada")) {
  const nomesTeste = ["joão", "joao", "maria", "felipe"];

  erros = erros.filter(e => !nomesTeste.includes(e.nome.toLowerCase().trim()));
  colaboradores = colaboradores.filter(c => !nomesTeste.includes(c.toLowerCase().trim()));

  localStorage.setItem("erros", JSON.stringify(erros));
  localStorage.setItem("colaboradores", JSON.stringify(colaboradores));
  localStorage.setItem("limpeza_testes_realizada", "true"); // Garante que não apague Joãos verdadeiros no futuro
}

let chart;

// Atualiza array de colaboradores com base nos erros
function atualizarColaboradores() {
  const uniqueNames = new Set([...colaboradores, ...erros.map(e => e.nome)]);
  colaboradores = Array.from(uniqueNames).sort();
  localStorage.setItem("colaboradores", JSON.stringify(colaboradores));
}

// Atualiza array de assuntos com base nos erros
function atualizarAssuntos() {
  const uniqueAssuntos = new Set([...assuntos, ...erros.map(e => e.assunto)]);
  assuntos = Array.from(uniqueAssuntos).sort();
  localStorage.setItem("assuntos", JSON.stringify(assuntos));
}

// Configura o autocomplete para um input
function setupAutocomplete(inputId, dropdownId, dataSourceType) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);

  dropdown.addEventListener("mousedown", (e) => {
    if (e.target.tagName === "LI") {
      input.value = e.target.textContent;
      dropdown.style.display = "none";
      if (inputId === "filtroPessoa") filtrar();
    }
  });

  input.addEventListener("input", () => renderList(input.value));
  input.addEventListener("focus", () => renderList(input.value));
  input.addEventListener("blur", () => {
    dropdown.style.display = "none";
  });

  function renderList(query) {
    const value = query.toLowerCase();

    let dataSource = [];
    if (dataSourceType === "colaboradores") {
      dataSource = colaboradores;
    } else if (dataSourceType === "assuntos") {
      dataSource = assuntos;
    }

    const suggestions = dataSource.filter(c => c.toLowerCase().includes(value));

    dropdown.innerHTML = "";
    if (suggestions.length > 0) {
      suggestions.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
        dropdown.appendChild(li);
      });
      dropdown.style.display = "block";
    } else {
      dropdown.style.display = "none";
    }
  }
}

document.getElementById("formErro").addEventListener("submit", function (e) {
  e.preventDefault();

  const inputNome = document.getElementById("nome").value.trim();
  const inputAssunto = document.getElementById("assunto").value.trim();
  const inputMotivo = document.getElementById("motivo").value.trim();
  const selectGrau = document.getElementById("grau").value;

  if (!inputNome) return;

  const erro = {
    nome: inputNome,
    assunto: inputAssunto,
    motivo: inputMotivo,
    grau: selectGrau,
    data: new Date().toISOString().split('T')[0],
    status: "Aberto"
  };

  erros.push(erro);
  salvar();
  atualizarColaboradores(); // Atualiza a lista caso seja um novo nome
  atualizarAssuntos(); // Atualiza a lista caso seja um novo assunto
  atualizar();
  this.reset();
});

function salvar() {
  localStorage.setItem("erros", JSON.stringify(erros));
}

function atualizar() {
  const tabela = document.getElementById("tabelaErros");
  tabela.innerHTML = "";

  let leve = 0, medio = 0, grave = 0;

  erros.forEach((e, index) => {

    if (e.grau === "Leve") leve++;
    if (e.grau === "Médio") medio++;
    if (e.grau === "Grave") grave++;

    const statusClass = e.status === "Aberto" ? "status-aberto" : "status-resolvido";

    tabela.innerHTML += `
      <tr>
        <td>${e.nome}</td>
        <td>${e.assunto}</td>
        <td>${e.grau}</td>
        <td>${e.data.split('-').reverse().join('/')}</td>
        <td><span class="status-badge ${statusClass}">${e.status}</span></td>
        <td>
          <button class="btn-resolve" onclick="resolver(${index})" title="Resolver">✔</button>
          <button class="btn-delete" onclick="excluir(${index})" title="Excluir">❌</button>
        </td>
      </tr>
    `;
  });

  document.getElementById("countLeve").textContent = leve;
  document.getElementById("countMedio").textContent = medio;
  document.getElementById("countGrave").textContent = grave;

  atualizarGrafico();
}

function renderizarTabela(lista) {
  const tabela = document.getElementById("tabelaErros");
  tabela.innerHTML = "";

  lista.forEach((e, index) => {
    // Para simplificar, quando filtrado, buscar o index original no array de erros não é tão simples.
    // O certo seria encontrar o index original, mas usando map antes resolve.
    // Vamos fazer direto a busca do index
    const originalIndex = erros.indexOf(e);
    const statusClass = e.status === "Aberto" ? "status-aberto" : "status-resolvido";

    tabela.innerHTML += `
      <tr>
        <td>${e.nome}</td>
        <td>${e.assunto}</td>
        <td>${e.grau}</td>
        <td>${e.data.split('-').reverse().join('/')}</td>
        <td><span class="status-badge ${statusClass}">${e.status}</span></td>
        <td>
          <button class="btn-resolve" onclick="resolver(${originalIndex})" title="Resolver">✔</button>
          <button class="btn-delete" onclick="excluir(${originalIndex})" title="Excluir">❌</button>
        </td>
      </tr>
    `;
  });
}


function excluir(index) {
  if (confirm("Tem certeza que deseja excluir este registro?")) {
    erros.splice(index, 1);
    salvar();
    atualizarColaboradores();
    atualizarAssuntos();
    atualizar();
  }
}

function resolver(index) {
  erros[index].status = "Resolvido";
  salvar();
  atualizar();
}

function filtrar() {
  const dataRange = document.getElementById("filtroData").value;
  const pessoa = document.getElementById("filtroPessoa").value.trim();

  let dataInicio = null;
  let dataFim = null;

  if (dataRange) {
    // Flatpickr in range mode uses ' to ' as separator
    const particoes = dataRange.split(" to ");
    dataInicio = particoes[0];
    dataFim = particoes[1] || particoes[0];
  }

  let filtrados = erros.filter(e => {
    let matchData = true;
    if (dataInicio && dataFim) {
      // String comparison for ISO dates ('YYYY-MM-DD') works perfectly
      matchData = e.data >= dataInicio && e.data <= dataFim;
    }

    let matchPessoa = true;
    if (pessoa) {
      matchPessoa = e.nome.toLowerCase() === pessoa.toLowerCase();
    }

    return matchData && matchPessoa;
  });

  renderizarTabela(filtrados);
}

function atualizarGrafico() {

  let ranking = {};

  erros.forEach(e => {
    ranking[e.nome] = (ranking[e.nome] || 0) + 1;
  });

  // Ordenar o ranking
  const rankingOrdenado = Object.entries(ranking).sort((a, b) => b[1] - a[1]);
  const nomes = rankingOrdenado.map(item => item[0]);
  const valores = rankingOrdenado.map(item => item[1]);

  // Atualizar Liderança
  const leaderCard = document.getElementById("leaderCard");
  const leaderMessage = document.getElementById("leaderMessage");

  if (rankingOrdenado.length > 0) {
    const liderNome = rankingOrdenado[0][0]; // Nome do primeiro colocado
    leaderMessage.innerHTML = `<span class="leader-name">${liderNome}</span> está liderando da pior forma!!`;
    leaderCard.style.display = "block";
  } else {
    leaderCard.style.display = "none";
  }

  if (chart) chart.destroy();

  const ctx = document.getElementById("graficoRanking").getContext("2d");
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: nomes,
      datasets: [{
        label: 'Quantidade de Erros',
        data: valores,
        backgroundColor: '#3b82f6',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#f8fafc' } }
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8' },
          grid: { color: '#334155' }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#94a3b8', stepSize: 1 },
          grid: { color: '#334155' }
        }
      }
    }
  });
}

function gerarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("Relatório de Erros", 14, 20);

  doc.setFontSize(12);
  let y = 30;

  if (erros.length === 0) {
    doc.text("Nenhum erro registrado.", 14, y);
  } else {
    erros.forEach((e, index) => {
      const dataFormatada = e.data.split('-').reverse().join('/');
      doc.text(`${index + 1}. Nome: ${e.nome} | Assunto: ${e.assunto} | Grau: ${e.grau} | Data: ${dataFormatada} | Status: ${e.status}`, 14, y);
      y += 10;
      if (y > 280) { // Cria nova página se passar do limite
        doc.addPage();
        y = 20;
      }
    });
  }

  doc.save("relatorio_erros.pdf");
}

// Inicializar Data Picker
flatpickr("#filtroData", {
  locale: "pt",
  mode: "range",
  dateFormat: "Y-m-d",
  altInput: true,
  altFormat: "d/m/Y",
  placeholder: "Selecione o Período"
});

atualizarColaboradores();
atualizarAssuntos();
setupAutocomplete("nome", "dropdownNome", "colaboradores");
setupAutocomplete("filtroPessoa", "dropdownFiltro", "colaboradores");
setupAutocomplete("assunto", "dropdownAssunto", "assuntos");
atualizar();