import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Credenciais de conexão com o seu Banco de Dados no Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBA4vkpYS3LGtigvtSrQ_b-PDpsWSSdyT0",
  authDomain: "dashboard-erros.firebaseapp.com",
  projectId: "dashboard-erros",
  storageBucket: "dashboard-erros.firebasestorage.app",
  messagingSenderId: "903332053803",
  appId: "1:903332053803:web:c7f5e296f79fcf5fa27b6e",
  measurementId: "G-5E8CDT4KHN"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Variáveis Globais de Estado
let chart;
let erros = [];
let colaboradores = [];
let assuntos = [];

// Funções expostas no window (necessário porque o script agora é type="module")
window.filtrar = filtrar;
window.gerarPDF = gerarPDF;
window.resolver = resolver;
window.excluir = excluir;

// --- LISTENERS (Tempo Real) DO FIREBASE --- //

// 1. Escutando a lista de colaboradores (para o autocomplete)
onSnapshot(doc(db, "listas", "colaboradores"), (docSnap) => {
  if (docSnap.exists()) {
    colaboradores = docSnap.data().itens || [];
    colaboradores.sort();
  }
});

// 2. Escutando a lista de assuntos (para o autocomplete)
onSnapshot(doc(db, "listas", "assuntos"), (docSnap) => {
  if (docSnap.exists()) {
    assuntos = docSnap.data().itens || [];
    assuntos.sort();
  }
});

// 3. Escutando todos os erros cadastrados
onSnapshot(collection(db, "erros"), (snapshot) => {
  erros = [];
  snapshot.forEach((doc) => {
    // Pegamos a ID do documento no firebase e juntamos com os dados
    erros.push({ id: doc.id, ...doc.data() });
  });

  // Ordenar para sempre mostrar os mais recentes primeiro
  erros.sort((a, b) => b.data.localeCompare(a.data));

  atualizar(); // Atualiza paineis e estatísticas
  filtrar();   // Renderiza a tabela mantendo o filtro ativo, se houver
});

// Função para salvar nova pessoa ou assunto na lista oficial independente do erro
async function adicionarItemLista(tipo, valor) {
  let arrayOriginal = tipo === "colaborador" ? colaboradores : assuntos;
  let documentId = tipo === "colaborador" ? "colaboradores" : "assuntos";

  if (!arrayOriginal.includes(valor)) {
    arrayOriginal.push(valor);
    arrayOriginal.sort();
    try {
      // Salva no Firestore usando merge para não apagar dados existentes sem querer
      await setDoc(doc(db, "listas", documentId), { itens: arrayOriginal }, { merge: true });
    } catch (e) {
      console.error("Erro ao adicionar à lista no Firestore:", e);
    }
  }
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

// Submissão do novo Erro
document.getElementById("formErro").addEventListener("submit", async function (e) {
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

  try {
    const btn = this.querySelector('button[type="submit"]');
    const txtOriginal = btn.textContent;
    btn.textContent = "Salvando...";
    btn.disabled = true;

    // 1. Salva na Coleção de Erros
    await addDoc(collection(db, "erros"), erro);

    // 2. Adiciona os nomes nas listas para o Autocomplete funcionar para todo mundo no futuro
    await adicionarItemLista("colaborador", inputNome);
    await adicionarItemLista("assunto", inputAssunto);

    this.reset();
    btn.textContent = txtOriginal;
    btn.disabled = false;
  } catch (err) {
    console.error("Erro ao salvar cadastro:", err);
    alert("Houve um problema de conexão com o banco de dados.");
  }
});

// Atualiza contadores e gráfico
function atualizar() {
  let leve = 0, medio = 0, grave = 0;

  erros.forEach((e) => {
    if (e.grau === "Leve") leve++;
    if (e.grau === "Médio") medio++;
    if (e.grau === "Grave") grave++;
  });

  document.getElementById("countLeve").textContent = leve;
  document.getElementById("countMedio").textContent = medio;
  document.getElementById("countGrave").textContent = grave;

  atualizarGrafico();
}

// Renderiza o HTML da tabela (chamada dentro do filtrar())
function renderizarTabela(lista) {
  const tabela = document.getElementById("tabelaErros");
  tabela.innerHTML = "";

  lista.forEach((e) => {
    const statusClass = e.status === "Aberto" ? "status-aberto" : "status-resolvido";

    tabela.innerHTML += `
      <tr>
        <td>${e.nome}</td>
        <td>${e.assunto}</td>
        <td>${e.grau}</td>
        <td>${e.data.split('-').reverse().join('/')}</td>
        <td><span class="status-badge ${statusClass}">${e.status}</span></td>
        <td>
          <button class="btn-resolve" onclick="resolver('${e.id}')" title="Resolver">✔</button>
          <button class="btn-delete" onclick="excluir('${e.id}')" title="Excluir">❌</button>
        </td>
      </tr>
    `;
  });
}

// Excluir registro do Firebase
async function excluir(id) {
  if (confirm("Tem certeza que deseja excluir este registro?")) {
    try {
      await deleteDoc(doc(db, "erros", id));
    } catch (err) {
      console.error("Erro ao excluir do banco de dados:", err);
    }
  }
}

// Resolver o erro no Firebase
async function resolver(id) {
  try {
    await updateDoc(doc(db, "erros", id), {
      status: "Resolvido"
    });
  } catch (err) {
    console.error("Erro ao atualizar o status:", err);
  }
}

// Filtra a tabela
function filtrar() {
  const dataRange = document.getElementById("filtroData").value;
  const pessoa = document.getElementById("filtroPessoa").value.trim();

  let dataInicio = null;
  let dataFim = null;

  if (dataRange) {
    const particoes = dataRange.split(" to ");
    dataInicio = particoes[0];
    dataFim = particoes[1] || particoes[0];
  }

  let filtrados = erros.filter(e => {
    let matchData = true;
    if (dataInicio && dataFim) {
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

// Renderiza o gráfico e Pior Desempenho
function atualizarGrafico() {
  let ranking = {};

  erros.forEach(e => {
    ranking[e.nome] = (ranking[e.nome] || 0) + 1;
  });

  const rankingOrdenado = Object.entries(ranking).sort((a, b) => b[1] - a[1]);
  const nomes = rankingOrdenado.map(item => item[0]);
  const valores = rankingOrdenado.map(item => item[1]);

  const leaderCard = document.getElementById("leaderCard");
  const leaderMessage = document.getElementById("leaderMessage");

  if (rankingOrdenado.length > 0) {
    const liderNome = rankingOrdenado[0][0];
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
      if (y > 280) {
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

// Setup dos autocompletes
setupAutocomplete("nome", "dropdownNome", "colaboradores");
setupAutocomplete("filtroPessoa", "dropdownFiltro", "colaboradores");
setupAutocomplete("assunto", "dropdownAssunto", "assuntos");

// Função exclusiva para migrar os dados antigos do LocalStorage do Cache de quem já estava usando pra o FIREBASE.
async function migrarDadosLegados() {
  const legados = JSON.parse(localStorage.getItem("erros")) || [];
  if (legados.length > 0 && !localStorage.getItem("migrados_para_firebase")) {
    console.log("Migrando dados do localStorage para o Firebase...");
    let tempColabs = new Set();
    let tempAssuntos = new Set();

    for (let e of legados) {
      if (e.nome) tempColabs.add(e.nome);
      if (e.assunto) tempAssuntos.add(e.assunto);

      try {
        await addDoc(collection(db, "erros"), e);
      } catch (err) { console.error("Erro ao migrar registro antigo", err); }
    }

    // Lista histórica de colaboradores do cache local
    const colabsLegados = JSON.parse(localStorage.getItem("colaboradores")) || [];
    colabsLegados.forEach(c => tempColabs.add(c));
    if (tempColabs.size > 0) {
      await setDoc(doc(db, "listas", "colaboradores"), { itens: Array.from(tempColabs).sort() }, { merge: true });
    }

    // Lista histórica de assuntos do cache local
    const assuntosLegados = JSON.parse(localStorage.getItem("assuntos")) || [];
    assuntosLegados.forEach(a => tempAssuntos.add(a));
    if (tempAssuntos.size > 0) {
      await setDoc(doc(db, "listas", "assuntos"), { itens: Array.from(tempAssuntos).sort() }, { merge: true });
    }

    // Marca como concluído no navegador desse usuário e previne repetir duas vezes
    localStorage.setItem("migrados_para_firebase", "true");
    console.log("Migração de dados antigos para Nuvem concluída com sucesso!");
  }
}
migrarDadosLegados();