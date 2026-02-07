const socket = io();

const chat = document.getElementById("chat");
const nomeInput = document.getElementById("nome");
const msgInput = document.getElementById("msg");

function enviar() {
  const nome = nomeInput.value;
  const msg = msgInput.value;

  if (!nome || !msg) return;

  socket.emit("mensagem", {
    nome,
    texto: msg
  });

  msgInput.value = "";
}

socket.on("mensagem", (dados) => {
  const li = document.createElement("li");
  li.textContent = `${dados.nome}: ${dados.texto}`;
  chat.appendChild(li);
});
