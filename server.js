// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { /* opcional: cors config */ });

app.use(express.static("public"));

/* ====== conexao mongo ====== */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo conectado"))
  .catch(err => console.error("Erro Mongo:", err));

/* ====== models ====== */
const mensagemSchema = new mongoose.Schema({
  nome: String,
  texto: String,
  avatar: String,
  autorId: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", default: null },
  data: { type: Date, default: Date.now }
});
const Mensagem = mongoose.model("Mensagem", mensagemSchema);

const userSchema = new mongoose.Schema({
  nome: { type: String, unique: false },
  role: { type: String, default: "player" }, // player ou master
  avatar: String,
  muted: { type: Boolean, default: false }
});
const Usuario = mongoose.model("Usuario", userSchema);

/* ====== estado servidor ====== */
let globalMuted = false;     // silenciar todos
let masterOnly = false;      // somente mestre pode mandar

/* ====== socket ====== */
io.on("connection", (socket) => {
  console.log("Conectou:", socket.id);

  // envia histórico ao conectar (limit pra não puxar muito)
  (async () => {
    try {
      const historico = await Mensagem.find().sort({ data: 1 }).limit(500);
      socket.emit("historico", historico);
      socket.emit("serverState", { globalMuted, masterOnly }); // atualiza estado do cliente
    } catch (e) {
      console.error("Erro ao buscar histórico:", e);
    }
  })();

  // registro (player ou master)
  // payload para player: { role: "player", nome, avatar }
  // payload para master: { role: "master", senha, nomeDesejado }
  socket.on("register", async (payload) => {
    try {
      if (!payload || !payload.role) return;

      if (payload.role === "player") {
        const nome = (payload.nome || "").trim();
        const avatar = payload.avatar || null;
        if (!nome || !avatar) {
          socket.emit("registerError", "Nome e avatar são obrigatórios.");
          return;
        }

        // cria usuário (não precisa ser único globalmente)
        const usuario = await Usuario.create({ nome, avatar, role: "player" });
        socket.usuario = usuario;
        socket.emit("registered", { nome: usuario.nome, role: usuario.role, avatar: usuario.avatar });
        console.log(`Player registrado: ${usuario.nome}`);
        return;
      }

      if (payload.role === "master") {
        const senha = payload.senha || "";
        // checa variável de ambiente ADMIN_SECRET
        if (!process.env.ADMIN_SECRET || senha !== process.env.ADMIN_SECRET) {
          socket.emit("registerError", "Senha do mestre incorreta.");
          return;
        }
        // mestre autenticado: permite escolher nome livremente e avatar opcional
        const nomeDesejado = (payload.nome || "Mestre").trim();
        const avatar = payload.avatar || null;

        // criar/atualizar documento do mestre para gerenciar lista de users (opcional)
        // aqui criamos um documento com role master para que existam registros persistentes
        let usuario = await Usuario.create({ nome: nomeDesejado, avatar, role: "master" });
        socket.usuario = usuario;
        socket.emit("registered", { nome: usuario.nome, role: usuario.role, avatar: usuario.avatar });
        console.log(`Mestre autenticado: ${usuario.nome}`);
        return;
      }

    } catch (err) {
      console.error("Erro register:", err);
      socket.emit("registerError", "Erro no registro.");
    }
  });

  // nova mensagem (verifica mutes e modo mestre-only)
  socket.on("mensagem", async (dados) => {
    try {
      if (!dados || !dados.nome || !dados.texto) return;

      // se não estiver registrado, ignora
      if (!socket.usuario) return;

      // se é master, sempre pode (se for criado como master)
      const isMaster = socket.usuario.role === "master";

      // checagens de permissão:
      if (masterOnly && !isMaster) return;           // só mestre manda
      if (globalMuted && !isMaster) return;          // global mute
      if (socket.usuario.muted && !isMaster) return; // usuário silenciado

      // salva mensagem
      const nova = new Mensagem({
        nome: dados.nome,
        texto: dados.texto,
        avatar: socket.usuario.avatar || dados.avatar || null,
        autorId: socket.usuario._id || null
      });
      await nova.save();

      io.emit("mensagem", nova);
    } catch (e) {
      console.error("Erro ao salvar mensagem:", e);
    }
  });

  /* ====== AÇÕES DO MESTRE (apenas se socket.usuario.role === "master") ====== */

  // apagar uma mensagem por id
  socket.on("deleteMessage", async (id) => {
    try {
      if (!socket.usuario || socket.usuario.role !== "master") return;
      await Mensagem.findByIdAndDelete(id);
      io.emit("messageDeleted", id);
      console.log("Mensagem apagada por master:", id);
    } catch (e) {
      console.error("Erro deleteMessage:", e);
    }
  });

  // apagar todas as mensagens
  socket.on("clearAll", async () => {
    try {
      if (!socket.usuario || socket.usuario.role !== "master") return;
      await Mensagem.deleteMany({});
      io.emit("cleared");
      console.log("Chat limpo pelo master");
    } catch (e) {
      console.error("Erro clearAll:", e);
    }
  });

  // silenciar / dessilenciar usuário (por nome ou id)
  socket.on("muteUser", async ({ targetNome, mute }) => {
    try {
      if (!socket.usuario || socket.usuario.role !== "master") return;
      if (!targetNome) return;

      await Usuario.updateMany({ nome: targetNome }, { $set: { muted: !!mute } });
      io.emit("userMuted", { targetNome, mute: !!mute });
      console.log(`Master ${socket.usuario.nome} set mute=${!!mute} para ${targetNome}`);
    } catch (e) {
      console.error("Erro muteUser:", e);
    }
  });

  // silenciar todos / master-only toggle
  socket.on("setGlobalMute", ({ value }) => {
    if (!socket.usuario || socket.usuario.role !== "master") return;
    globalMuted = !!value;
    io.emit("serverState", { globalMuted, masterOnly });
    console.log("globalMuted set to", globalMuted);
  });

  socket.on("setMasterOnly", ({ value }) => {
    if (!socket.usuario || socket.usuario.role !== "master") return;
    masterOnly = !!value;
    io.emit("serverState", { globalMuted, masterOnly });
    console.log("masterOnly set to", masterOnly);
  });

  // master pode renomear-se livremente
  socket.on("setMyName", async (novoNome) => {
    try {
      if (!socket.usuario || socket.usuario.role !== "master") return;
      socket.usuario.nome = novoNome;
      await Usuario.findByIdAndUpdate(socket.usuario._id, { nome: novoNome });
      socket.emit("registered", { nome: novoNome, role: "master", avatar: socket.usuario.avatar });
      console.log("Master trocou nome para", novoNome);
    } catch (e) {
      console.error("Erro setMyName:", e);
    }
  });

  // ao desconectar
  socket.on("disconnect", () => {
    // limpeza opcional
  });
});

/* ====== server start ====== */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server rodando na porta", PORT));