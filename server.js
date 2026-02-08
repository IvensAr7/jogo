const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const FILE = "./messages.json";

// função pra ler mensagens
function lerMensagens() {
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE));
}

// função pra salvar mensagens
function salvarMensagens(msgs) {
  fs.writeFileSync(FILE, JSON.stringify(msgs, null, 2));
}

io.on("connection", (socket) => {
  console.log("Usuário conectado:", socket.id);

  // envia histórico pro cara que entrou
  socket.emit("historico", lerMensagens());

  socket.on("mensagem", (dados) => {
    const msgs = lerMensagens();
    msgs.push(dados);
    salvarMensagens(msgs);

    io.emit("mensagem", dados);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});
