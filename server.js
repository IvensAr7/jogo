const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

/* ======================
   CONEXÃO MONGO
====================== */

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo conectado"))
  .catch(err => console.error("Erro Mongo:", err));

/* ======================
   MODELS (AQUI FORA)
====================== */

// MODEL MENSAGEM
const mensagemSchema = new mongoose.Schema({
  nome: String,
  texto: String,
  data: { type: Date, default: Date.now }
});
const Mensagem = mongoose.model("Mensagem", mensagemSchema);

// MODEL USUARIO
const userSchema = new mongoose.Schema({
  nome: { type: String, unique: true },
  role: { type: String, default: "user" }
});
const Usuario = mongoose.model("Usuario", userSchema);

/* ======================
   SOCKET (AQUI DENTRO)
====================== */

io.on("connection", (socket) => {
  console.log("Conectado:", socket.id);

  // envia histórico assim que o cliente conectar
  (async () => {
    try {
      const historico = await Mensagem.find().sort({ data: 1 }).limit(200);
      socket.emit("historico", historico);
    } catch (e) {
      console.error("Erro histórico:", e);
    }
  })();

  // Registrar usuário (responde com role)
  socket.on("registrar", async (nome) => {
    if (!nome) return;

    let usuario = await Usuario.findOne({ nome });

    if (!usuario) {
      usuario = await Usuario.create({ nome });
    }

    socket.usuario = usuario;
    // informa o cliente sobre a role (útil pra UI)
    socket.emit("registrado", { nome: usuario.nome, role: usuario.role });

    console.log(`${nome} como ${usuario.role}`);
  });

  // Nova mensagem
  socket.on("mensagem", async (dados) => {
    if (!dados?.nome || !dados?.texto) return;

    const nova = new Mensagem(dados);
    await nova.save();
    io.emit("mensagem", nova);
  });

  // Limpar chat (somente admin)
  socket.on("limpar", async () => {
    if (!socket.usuario || socket.usuario.role !== "admin") {
      console.log("Tentativa sem permissão");
      return;
    }

    await Mensagem.deleteMany({});
    io.emit("historico", []);
    console.log("Chat limpo pelo admin");
  });
});


/* ======================
   SERVER
====================== */

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});
