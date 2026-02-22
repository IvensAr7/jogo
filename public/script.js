// script.js
const socket = io();

const screenRegister = document.getElementById("screen-register");
const playerForm = document.getElementById("player-form");
const masterForm = document.getElementById("master-form");
const avatarOptions = document.querySelectorAll(".avatar-option");
const playerNameInput = document.getElementById("player-name");
const masterNameInput = document.getElementById("master-name");
const masterPassInput = document.getElementById("master-pass");
const enterPlayerBtn = document.getElementById("enter-player");
const enterMasterBtn = document.getElementById("enter-master");

const screenChat = document.getElementById("screen-chat");
const chatList = document.getElementById("chat");
const msgInput = document.getElementById("msg");
const sendBtn = document.getElementById("send");

const adminPanel = document.getElementById("admin-panel");
const btnClear = document.getElementById("btn-clear");
const btnGlobalMute = document.getElementById("btn-global-mute");
const btnMasterOnly = document.getElementById("btn-master-only");
const muteTarget = document.getElementById("mute-target");
const btnMute = document.getElementById("btn-mute");
const btnUnmute = document.getElementById("btn-unmute");
const setNameInput = document.getElementById("set-name-input");
const btnSetName = document.getElementById("btn-set-name");

let selectedAvatar = null;
let myName = null;
let myRole = "player";
let minhaAvatar = null;
let serverState = { globalMuted: false, masterOnly: false };

// avatar selection
avatarOptions.forEach(img => img.addEventListener("click", () => {
  avatarOptions.forEach(i => i.classList.remove("selected"));
  img.classList.add("selected");
  selectedAvatar = img.dataset.avatar;
}));

// toggle forms
document.querySelectorAll('input[name="role"]').forEach(r => {
  r.addEventListener("change", () => {
    if (r.value === "player" && r.checked) {
      playerForm.style.display = "";
      masterForm.style.display = "none";
    } else if (r.value === "master" && r.checked) {
      playerForm.style.display = "none";
      masterForm.style.display = "";
    }
  });
});

// entrar como player
enterPlayerBtn.addEventListener("click", () => {
  const nome = playerNameInput.value.trim();
  if (!nome || !selectedAvatar) return alert("Escolha um avatar e um nome.");
  socket.emit("register", { role: "player", nome, avatar: selectedAvatar });
});

// entrar como master
enterMasterBtn.addEventListener("click", () => {
  const senha = masterPassInput.value;
  if (!senha) return alert("Senha necessária.");
  const nomeDesejado = masterNameInput.value.trim() || "Mestre";
  socket.emit("register", { role: "master", senha, nome: nomeDesejado });
});

// recebendo confirmação de registro
socket.on("registered", (dados) => {
  myName = dados.nome;
  myRole = dados.role || "player";
  minhaAvatar = dados.avatar || null;

  // troca de telas
  screenRegister.style.display = "none";
  screenChat.style.display = "";

  // mostra painel admin se master
  if (myRole === "master") {
    adminPanel.style.display = "";
  } else {
    adminPanel.style.display = "none";
  }
});

// erros de registro
socket.on("registerError", (msg) => {
  alert("Erro registro: " + msg);
});

// histórico
socket.on("historico", (msgs) => {
  chatList.innerHTML = "";
  msgs.forEach(renderMsg);
});

// nova mensagem
socket.on("mensagem", (m) => {
  renderMsg(m);
});

// mensagem apagada
socket.on("messageDeleted", (id) => {
  const li = document.querySelector(`li[data-id="${id}"]`);
  if (li) {
    li.remove();
  }
});

// chat limpo
socket.on("cleared", () => {
  chatList.innerHTML = "";
});

// estado do servidor (mutes)
socket.on("serverState", (st) => {
  serverState = st;
  btnGlobalMute.textContent = st.globalMuted ? "Desilenciar todos" : "Silenciar todos";
  btnMasterOnly.textContent = st.masterOnly ? "Desativar apenas mestre" : "Ativar apenas mestre";
});

// user muted broadcast
socket.on("userMuted", ({ targetNome, mute }) => {
  // visual: pode adicionar badge em mensagens desse usuário
  // aqui apenas notifica
  console.log(`userMuted: ${targetNome} -> ${mute}`);
});

// enviar mensagem
sendBtn.addEventListener("click", () => {
  if (!myName) return alert("Defina seu perfil primeiro.");
  const texto = msgInput.value.trim();
  if (!texto) return;
  // checagens no cliente só pra UX; servidor aplica regras de verdade
  if (serverState.masterOnly && myRole !== "master") return alert("Somente o Mestre pode mandar mensagens agora.");
  socket.emit("mensagem", { nome: myName, texto });
  msgInput.value = "";
});

// render de mensagem com botão de apagar visível só ao master
function renderMsg(m) {
  const li = document.createElement("li");
  li.dataset.id = m._id;
  const hora = new Date(m.data || m.data).toLocaleTimeString();
  li.textContent = `[${hora}] ${m.nome}: ${m.texto}`;
  if (m.avatar) {
    const img = document.createElement("img");
    img.src = m.avatar;
    img.className = "msg-avatar";
    li.prepend(img);
  }
  if (myRole === "master") {
    const btnDel = document.createElement("button");
    btnDel.textContent = "Apagar";
    btnDel.addEventListener("click", () => {
      socket.emit("deleteMessage", m._id);
    });
    li.appendChild(btnDel);
  }
  chatList.appendChild(li);
  chatList.scrollTop = chatList.scrollHeight;
}

/* ====== admin actions ====== */
btnClear.addEventListener("click", () => {
  if (!confirm("Apagar todas as mensagens?")) return;
  socket.emit("clearAll");
});

btnGlobalMute.addEventListener("click", () => {
  socket.emit("setGlobalMute", { value: !serverState.globalMuted });
});

btnMasterOnly.addEventListener("click", () => {
  socket.emit("setMasterOnly", { value: !serverState.masterOnly });
});

btnMute.addEventListener("click", () => {
  const target = muteTarget.value.trim();
  if (!target) return;
  socket.emit("muteUser", { targetNome: target, mute: true });
});

btnUnmute.addEventListener("click", () => {
  const target = muteTarget.value.trim();
  if (!target) return;
  socket.emit("muteUser", { targetNome: target, mute: false });
});

btnSetName.addEventListener("click", () => {
  const novo = setNameInput.value.trim();
  if (!novo) return;
  socket.emit("setMyName", novo);
});