const socket = io();

const chat = document.getElementById("chat");
const nomeInput = document.getElementById("nome");
const msgInput = document.getElementById("msg");
const limparBtn = document.querySelector('button[onclick="limparChat()"]');

let registrado = false;
let minhaRole = "user";

// registra assim que o nome é informado (pode ser chamado ao blur ou antes do primeiro envio)
function registrarSeNecessario() {
  const nome = nomeInput.value.trim();
  if (!nome || registrado) return;
  socket.emit("registrar", nome);
  registrado = true;
}

// chama registrar ao sair do input (opcional) e antes de enviar
nomeInput.addEventListener("blur", registrarSeNecessario);

function enviar() {
  const nome = nomeInput.value.trim();
  const msg = msgInput.value.trim();
  if (!nome || !msg) return;

  registrarSeNecessario(); // garante registro antes de enviar
  socket.emit("mensagem", { nome, texto: msg });
  msgInput.value = "";
}

// recebe confirmação de registro com role
socket.on("registrado", (dados) => {
  minhaRole = dados.role || "user";
  // mostra/esconde botão limpar dependendo da role
  if (limparBtn) {
    limparBtn.style.display = minhaRole === "admin" ? "inline-block" : "none";
  }
});

// recebe nova mensagem
socket.on("mensagem", (dados) => {
  adicionarMsg(dados);
});

// recebe histórico (será enviado ao conectar)
socket.on("historico", (msgs) => {
  chat.innerHTML = "";
  msgs.forEach(adicionarMsg);
});

function adicionarMsg(dados) {
  const li = document.createElement("li");
  const hora = dados.data ? new Date(dados.data).toLocaleTimeString() : "";
  // usa textContent (safe contra XSS)
  li.textContent = `[${hora}] ${dados.nome}: ${dados.texto}`;
  chat.appendChild(li);
  chat.scrollTop = chat.scrollHeight;
}

function limparChat() {
  socket.emit("limpar");
}
