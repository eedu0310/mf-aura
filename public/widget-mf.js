/*
 * Chat do site da MF International — widget da AURA.
 *
 * Instalação no site (uma linha, no lugar do código do Bitrix):
 *   <script src="https://crm.mflaser.com.br/widget-mf.js" async></script>
 *
 * Tudo fica dentro de um Shadow DOM: o CSS do site não mexe no widget e o
 * widget não mexe no site. Não usa cookie. A conversa do visitante fica
 * guardada no próprio navegador dele (localStorage) por um segredo que só
 * ele tem; a AURA guarda só o hash.
 */
(function () {
  "use strict";
  if (window.__auraChatMF) return;
  window.__auraChatMF = true;

  var script =
    document.currentScript ||
    document.querySelector('script[src*="widget-mf.js"]');
  var BASE = "https://crm.mflaser.com.br";
  try {
    if (script && script.src) BASE = new URL(script.src).origin;
  } catch (e) {}
  var API = BASE + "/api/site/chat/publico";
  var CHAVE = "aura-chat-mf";

  // ---------- guarda no navegador (pode falhar em aba anônima) ----------
  function ler(chave, area) {
    try {
      var v = (area || window.localStorage).getItem(chave);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  }
  function gravar(chave, valor, area) {
    try {
      (area || window.localStorage).setItem(chave, JSON.stringify(valor));
    } catch (e) {}
  }
  function apagar(chave) {
    try {
      window.localStorage.removeItem(chave);
    } catch (e) {}
  }

  // UTM da visita, para saber de qual anúncio veio.
  (function guardarUtm() {
    try {
      var p = new URLSearchParams(window.location.search);
      var utm = {};
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"].forEach(function (k) {
        if (p.get(k)) utm[k] = p.get(k).slice(0, 120);
      });
      if (Object.keys(utm).length) gravar(CHAVE + ":utm", utm, window.sessionStorage);
    } catch (e) {}
  })();

  // ---------- estado ----------
  var cfg = null;
  var conversa = ler(CHAVE); // { c, t, nome }
  var mensagens = [];
  var idsVistos = {};
  var ultimaData = null;
  var aberto = false;
  var tela = "inicio";
  var naoLidas = 0;
  var relogio = null;
  var voltas = 0;
  var enviando = false;
  var atalhoAberto = null;

  // ---------- utilidades ----------
  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    if (attrs)
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === "texto") n.textContent = v;
        else if (k === "classe") n.className = v;
        else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? "" : v);
      });
    (filhos || []).forEach(function (f) {
      if (f == null || f === false) return;
      n.appendChild(typeof f === "string" ? document.createTextNode(f) : f);
    });
    return n;
  }
  function svg(caminho, tamanho) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("width", tamanho || 20);
    s.setAttribute("height", tamanho || 20);
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "2");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("aria-hidden", "true");
    caminho.split("|").forEach(function (d) {
      var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      s.appendChild(p);
    });
    return s;
  }
  var ICONES = {
    chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
    fechar: "M18 6 6 18|M6 6l12 12",
    voltar: "M15 18l-6-6 6-6",
    enviar: "M22 2 11 13|M22 2l-7 20-4-9-9-4 20-7z",
    livro: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20|M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
    whats: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z",
    local: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z|M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    seta: "M9 18l6-6-6-6",
    catalogo: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20|M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
    manual: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z|M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
    chama: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z",
    celular: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z|M12 18h.01",
    cubo: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z|M3.3 7 12 12l8.7-5|M12 22V12",
    documento: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M16 13H8|M16 17H8",
    relogio: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|M12 6v6l4 2",
  };
  function iniciais(nome) {
    var p = String(nome || "MF").trim().split(/\s+/);
    return ((p[0] || "")[0] + ((p[1] || "")[0] || "")).toUpperCase() || "MF";
  }
  function hora(iso) {
    try {
      return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  }
  function chamar(metodo, caminho, corpo) {
    return fetch(API + caminho, {
      method: metodo,
      headers: corpo ? { "Content-Type": "application/json" } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
      credentials: "omit",
    }).then(function (r) {
      return r
        .json()
        .catch(function () {
          return {};
        })
        .then(function (j) {
          j.__status = r.status;
          return j;
        });
    });
  }
  function linkWhats(texto) {
    var n = (cfg && cfg.whatsapp) || "555135361422";
    return "https://wa.me/" + n + (texto ? "?text=" + encodeURIComponent(texto) : "");
  }

  // ---------- montagem ----------
  var host = el("div", { id: "aura-chat-mf" });
  host.style.cssText = "all:initial;position:fixed;z-index:2147483000;bottom:0;right:0;width:0;height:0;";
  var raiz = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

  var COR = "#CD1C1B";
  var estilo = el("style");
  function css() {
    estilo.textContent =
      ":host{all:initial}" +
      "*{box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}" +
      ".lancador{position:fixed;right:20px;bottom:20px;width:62px;height:62px;border-radius:50%;border:0;cursor:pointer;background:" + COR + ";color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.25);transition:transform .2s}" +
      ".lancador:hover{transform:scale(1.06)}" +
      ".lancador:focus-visible,.botao:focus-visible,.opcao:focus-visible,.icone:focus-visible{outline:3px solid #1a8496;outline-offset:2px}" +
      ".lancador .ponto{position:absolute;right:3px;bottom:3px;width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid #fff}" +
      ".lancador .contador{position:absolute;top:-4px;right:-4px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#111;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}" +
      ".lancador .anel{position:absolute;inset:0;border-radius:50%;border:2px solid " + COR + ";animation:anel 2.4s ease-out infinite}" +
      "@keyframes anel{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.5);opacity:0}}" +
      "@media (prefers-reduced-motion:reduce){.lancador .anel{animation:none;display:none}}" +
      ".convite{position:fixed;right:96px;bottom:26px;width:270px;background:#fff;color:#1f1f1d;border-radius:16px;padding:14px 34px 14px 14px;box-shadow:0 10px 30px rgba(0,0,0,.18);display:flex;gap:10px;align-items:flex-start;cursor:pointer;animation:entrar .3s ease-out}" +
      ".convite p{margin:0;font-size:13.5px;line-height:1.45}.convite b{display:block;font-size:13px;margin-bottom:2px}" +
      ".convite .x{position:absolute;top:6px;right:6px}" +
      "@keyframes entrar{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}" +
      ".painel{position:fixed;right:20px;bottom:96px;width:372px;height:min(620px,calc(100vh - 120px));background:#f6f6f4;border-radius:18px;box-shadow:0 16px 48px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden;animation:entrar .2s ease-out;color:#1f1f1d}" +
      "@media (max-width:480px){.painel{right:0;bottom:0;width:100vw;height:100%;max-height:100dvh;border-radius:0}.convite{right:20px;bottom:94px;width:calc(100vw - 40px)}}" +
      ".topo{background:" + COR + ";color:#fff;padding:14px 12px 14px 16px;display:flex;align-items:center;gap:12px;flex-shrink:0}" +
      ".avatar{width:42px;height:42px;border-radius:50%;background:#fff;color:" + COR + ";display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;flex-shrink:0;position:relative}" +
      ".avatar.pequeno{width:30px;height:30px;font-size:11px;background:" + COR + ";color:#fff}" +
      ".avatar .ponto{position:absolute;right:-1px;bottom:-1px;width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid " + COR + "}" +
      ".topo .nome{font-weight:700;font-size:15px;line-height:1.2}.topo .estado{font-size:12.5px;opacity:.92;margin-top:2px}" +
      ".topo .meio{flex:1;min-width:0}" +
      ".icone{background:transparent;border:0;color:inherit;width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}" +
      ".icone:hover{background:rgba(255,255,255,.15)}.convite .icone{width:26px;height:26px;color:#555}.convite .icone:hover{background:#eee}" +
      ".corpo{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}" +
      ".balao{max-width:85%;padding:10px 13px;border-radius:16px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}" +
      ".deles{background:#fff;border-bottom-left-radius:4px;align-self:flex-start;box-shadow:0 1px 2px rgba(0,0,0,.06)}" +
      ".meu{background:" + COR + ";color:#fff;border-bottom-right-radius:4px;align-self:flex-end}" +
      ".sistema{align-self:center;text-align:center;font-size:12.5px;color:#666;background:#ececea;border-radius:10px;padding:7px 11px;max-width:92%;line-height:1.4}" +
      ".linha{display:flex;gap:8px;align-items:flex-end}.linha .balao{max-width:100%}" +
      ".autor{font-size:11.5px;color:#777;margin:0 0 2px 40px}.hora{font-size:10.5px;opacity:.65;margin-top:3px;text-align:right}" +
      ".titulo{font-size:13px;font-weight:700;color:#555;margin:6px 2px 0;text-transform:uppercase;letter-spacing:.04em}" +
      ".opcao{width:100%;display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e6e6e2;border-radius:14px;padding:12px 12px;cursor:pointer;text-align:left;color:#1f1f1d;text-decoration:none;transition:border-color .15s}" +
      ".opcao:hover{border-color:" + COR + "}" +
      ".opcao .ic{width:38px;height:38px;border-radius:12px;background:#fbeaea;color:" + COR + ";display:flex;align-items:center;justify-content:center;flex-shrink:0}" +
      ".opcao.verde .ic{background:#e7f6ec;color:#16a34a}" +
      ".opcao .tx{flex:1;min-width:0;display:block}.opcao .tx b{display:block;font-size:14.5px;color:#1f1f1d}.opcao .tx span{display:block;font-size:12.5px;color:#666;margin-top:1px}" +
      ".opcao .seta{color:#aaa}" +
      ".form{display:flex;flex-direction:column;gap:10px;background:#fff;border-radius:14px;padding:14px;border:1px solid #e6e6e2}" +
      ".form label{display:flex;flex-direction:column;gap:4px;font-size:12.5px;font-weight:600;color:#444}" +
      ".form input,.form textarea{font-size:15px;padding:10px 11px;border:1px solid #d6d6d2;border-radius:10px;background:#fff;color:#1f1f1d;outline:none;width:100%}" +
      ".form input:focus,.form textarea:focus,.escrever textarea:focus{border-color:" + COR + ";box-shadow:0 0 0 3px rgba(205,28,27,.12)}" +
      ".form .aviso{font-size:11.5px;color:#777;font-weight:400;line-height:1.4}" +
      ".erro{background:#fdecec;color:#9b1515;border-radius:10px;padding:8px 10px;font-size:13px}" +
      ".botao{min-height:46px;border:0;border-radius:12px;background:" + COR + ";color:#fff;font-weight:700;font-size:15px;cursor:pointer;padding:0 16px}" +
      ".botao[disabled]{opacity:.6;cursor:default}" +
      ".escrever{display:flex;gap:8px;padding:10px 12px;background:#fff;border-top:1px solid #e6e6e2;flex-shrink:0;align-items:flex-end}" +
      ".escrever textarea{flex:1;resize:none;border:1px solid #d6d6d2;border-radius:12px;padding:10px 12px;font-size:15px;max-height:110px;min-height:44px;outline:none;color:#1f1f1d}" +
      ".escrever .botao{width:46px;padding:0;display:flex;align-items:center;justify-content:center;flex-shrink:0}" +
      ".rodape{font-size:11.5px;text-align:center;color:#888;padding:7px;flex-shrink:0;background:#fff}" +
      ".rodape a{color:#16a34a;font-weight:600;text-decoration:none}" +
      ".quadro{flex:1;border:0;width:100%;background:#fff}" +
      ".dado{background:#fff;border:1px solid #e6e6e2;border-radius:14px;padding:12px 14px;font-size:14px;line-height:1.5}" +
      ".dado .linhas{white-space:pre-line}" +
      ".dado b{display:block;font-size:12px;color:#777;font-weight:600;margin-bottom:2px}.dado a{color:" + COR + ";text-decoration:none;font-weight:600}" +
      ".vazio{display:none}";
  }
  css();

  var lancador, convite, painel, corpoEl;

  function montarLancador() {
    if (lancador) lancador.remove();
    lancador = el(
      "button",
      { classe: "lancador", type: "button", "aria-label": "Abrir o atendimento da MF", onclick: alternar },
      [el("span", { classe: "anel" }), svg(ICONES.chat, 28), el("span", { classe: "ponto" })],
    );
    if (naoLidas > 0) lancador.appendChild(el("span", { classe: "contador", texto: String(naoLidas) }));
    raiz.appendChild(lancador);
  }

  function nomeAtendente() {
    return (cfg && cfg.atendente && cfg.atendente.nome) || "Equipe MF";
  }

  function montarConvite() {
    if (aberto || ler(CHAVE + ":convite", window.sessionStorage) || (conversa && conversa.c)) return;
    convite = el("div", { classe: "convite", role: "button", tabindex: "0", onclick: function () { fecharConvite(); abrir("inicio"); } }, [
      el("div", { classe: "avatar pequeno", texto: iniciais(nomeAtendente()) }),
      el("p", null, [el("b", { texto: nomeAtendente() }), (cfg && cfg.saudacao) || "Ol\u00e1! Posso ajudar?"]),
      el("button", {
        classe: "icone x",
        type: "button",
        "aria-label": "Fechar o convite",
        onclick: function (ev) {
          ev.stopPropagation();
          fecharConvite();
        },
      }, [svg(ICONES.fechar, 16)]),
    ]);
    raiz.appendChild(convite);
  }
  function fecharConvite() {
    gravar(CHAVE + ":convite", 1, window.sessionStorage);
    if (convite) convite.remove();
    convite = null;
  }

  function alternar() {
    if (aberto) fechar();
    else abrir(conversa && conversa.c ? "chat" : "inicio");
  }

  function abrir(qual) {
    fecharConvite();
    aberto = true;
    tela = qual || "inicio";
    if (tela === "chat") {
      naoLidas = 0;
      montarLancador();
    }
    desenhar();
    agendar();
  }

  function fechar() {
    aberto = false;
    if (painel) painel.remove();
    painel = null;
    agendar();
    if (lancador) lancador.focus();
  }

  function topo() {
    var voltar =
      tela !== "inicio"
        ? el("button", { classe: "icone", type: "button", "aria-label": "Voltar ao in\u00edcio", onclick: function () { tela = "inicio"; desenhar(); agendar(); } }, [svg(ICONES.voltar, 22)])
        : null;
    return el("div", { classe: "topo" }, [
      voltar,
      el("div", { classe: "avatar" }, [iniciais(nomeAtendente()), el("span", { classe: "ponto" })]),
      el("div", { classe: "meio" }, [
        el("div", { classe: "nome", texto: nomeAtendente() }),
        el("div", { classe: "estado", texto: "Online \u00b7 responde em minutos" }),
      ]),
      el("button", { classe: "icone", type: "button", "aria-label": "Fechar", onclick: fechar }, [svg(ICONES.fechar, 22)]),
    ]);
  }

  function balaoDeles(texto) {
    return el("div", { classe: "linha" }, [
      el("div", { classe: "avatar pequeno", texto: iniciais(nomeAtendente()) }),
      el("div", { classe: "balao deles", texto: texto }),
    ]);
  }

  function opcao(icone, titulo, sub, acao, extra) {
    var attrs = { classe: "opcao" + (extra || ""), type: "button" };
    var tag = "button";
    if (typeof acao === "string") {
      tag = "a";
      attrs = { classe: "opcao" + (extra || ""), href: acao, target: "_blank", rel: "noopener" };
    } else attrs.onclick = acao;
    return el(tag, attrs, [
      el("span", { classe: "ic" }, [svg(icone, 20)]),
      el("span", { classe: "tx" }, [el("b", { texto: titulo }), el("span", { texto: sub })]),
      el("span", { classe: "seta" }, [svg(ICONES.seta, 18)]),
    ]);
  }

  function telaInicio() {
    var temConversa = conversa && conversa.c;
    var itens = [
      balaoDeles((cfg && cfg.saudacao) || "Ol\u00e1! Sou o seu ajudante pessoal da MF. Escreva sempre que tiver d\u00favidas."),
      el("p", { classe: "titulo", texto: "Como podemos ajudar?" }),
      opcao(
        ICONES.chat,
        temConversa ? "Continuar a conversa" : "Atendimento MF",
        temConversa ? "Voltar para o chat com a nossa equipe" : "Fale agora com a nossa equipe, por aqui",
        function () {
          tela = temConversa ? "chat" : "formulario";
          if (tela === "chat") naoLidas = 0;
          montarLancador();
          desenhar();
          agendar();
        },
      ),
    ];
    var atalhos = (cfg && cfg.atalhos) || [];
    if (atalhos.length) itens.push(el("p", { classe: "titulo", texto: "Materiais gratuitos" }));
    atalhos.forEach(function (a) {
      itens.push(
        opcao(ICONES[a.icone] || ICONES.documento, a.titulo, a.subtitulo || "", function () {
          atalhoAberto = a;
          tela = "material";
          desenhar();
        }),
      );
    });
    if (atalhos.length) itens.push(el("p", { classe: "titulo", texto: "Fale com a gente" }));
    itens.push(opcao(ICONES.whats, "Falar no WhatsApp", (cfg && cfg.contato && cfg.contato.telefone) || "(51) 3536-1422", linkWhats("Ol\u00e1! Vim pelo site da MF."), " verde"));
    itens.push(opcao(ICONES.local, "Contato e endere\u00e7o", "Onde estamos e como falar com a f\u00e1brica", function () { tela = "contato"; desenhar(); }));
    return [el("div", { classe: "corpo" }, itens)];
  }

  function telaFormulario() {
    var erro = el("div", { classe: "erro vazio", role: "alert" });
    var campos = {
      nome: el("input", { name: "nome", autocomplete: "name", required: true, maxlength: "80" }),
      telefone: el("input", { name: "telefone", type: "tel", autocomplete: "tel", inputmode: "tel", required: true, placeholder: "(51) 99999-9999", maxlength: "20" }),
      cidade: el("input", { name: "cidade", autocomplete: "address-level2", required: true, maxlength: "80" }),
      email: el("input", { name: "email", type: "email", autocomplete: "email", maxlength: "120" }),
      mensagem: el("textarea", { name: "mensagem", rows: "3", maxlength: "1000", placeholder: "Ex.: quero uma lareira para a sala de 40 m\u00b2" }),
    };
    var armadilha = el("input", { name: "site", tabindex: "-1", autocomplete: "off", style: "position:absolute;left:-9999px;width:1px;height:1px;opacity:0", "aria-hidden": "true" });
    var botao = el("button", { classe: "botao", type: "submit", texto: "Iniciar atendimento" });
    var form = el(
      "form",
      {
        classe: "form",
        novalidate: true,
        onsubmit: function (ev) {
          ev.preventDefault();
          if (enviando) return;
          var dados = {};
          Object.keys(campos).forEach(function (k) {
            dados[k] = campos[k].value.trim();
          });
          var falta = !dados.nome ? "Diga o seu nome." : dados.telefone.replace(/\D/g, "").length < 10 ? "Confira o WhatsApp com DDD." : !dados.cidade ? "Diga a sua cidade." : "";
          if (falta) {
            erro.textContent = falta;
            erro.className = "erro";
            return;
          }
          enviando = true;
          botao.disabled = true;
          botao.textContent = "Iniciando\u2026";
          dados.site = armadilha.value;
          dados.origem_url = String(window.location.href).slice(0, 500);
          dados.utm = ler(CHAVE + ":utm", window.sessionStorage);
          chamar("POST", "/iniciar", dados)
            .then(function (j) {
              if (!j.ok) throw new Error(j.erro || "N\u00e3o consegui iniciar agora.");
              conversa = { c: j.conversa, t: j.token, nome: dados.nome };
              gravar(CHAVE, conversa);
              mensagens = [];
              idsVistos = {};
              ultimaData = null;
              tela = "chat";
              desenhar();
              buscar(true).then(agendar);
            })
            .catch(function (e) {
              erro.textContent = e.message || "N\u00e3o consegui iniciar agora. Tente de novo.";
              erro.className = "erro";
            })
            .then(function () {
              enviando = false;
              botao.disabled = false;
              botao.textContent = "Iniciar atendimento";
            });
        },
      },
      [
        el("label", null, ["Nome", campos.nome]),
        el("label", null, ["WhatsApp", campos.telefone]),
        el("label", null, ["Cidade", campos.cidade]),
        el("label", null, ["E-mail (opcional)", campos.email]),
        el("label", null, ["Como podemos ajudar? (opcional)", campos.mensagem]),
        armadilha,
        el("p", { classe: "aviso", texto: "Ao iniciar, voc\u00ea concorda que a MF International use estes dados para te atender." }),
        erro,
        botao,
      ],
    );
    setTimeout(function () {
      try {
        campos.nome.focus();
      } catch (e) {}
    }, 50);
    var fora = cfg && cfg.horario && cfg.horario.aberto === false;
    return [
      el("div", { classe: "corpo" }, [
        fora ? el("div", { classe: "sistema", texto: (cfg.horario.mensagemFora || "Agora estamos fora do hor\u00e1rio de atendimento.") + (cfg.horario.texto ? " Hor\u00e1rio: " + cfg.horario.texto + "." : "") }) : null,
        balaoDeles("Para te atender melhor, me diz o teu nome, WhatsApp e cidade?"),
        form,
      ]),
    ];
  }

  function balaoMensagem(m) {
    if (m.autor === "sistema") return el("div", { classe: "sistema", texto: m.texto });
    if (m.autor === "visitante")
      return el("div", { classe: "balao meu" }, [m.texto, el("div", { classe: "hora", texto: hora(m.created_at) })]);
    return el("div", null, [
      el("div", { classe: "autor", texto: m.autor_nome || nomeAtendente() }),
      el("div", { classe: "linha" }, [
        el("div", { classe: "avatar pequeno", texto: iniciais(m.autor_nome || nomeAtendente()) }),
        el("div", { classe: "balao deles" }, [m.texto, el("div", { classe: "hora", texto: hora(m.created_at) })]),
      ]),
    ]);
  }

  function telaChat() {
    corpoEl = el("div", { classe: "corpo", "aria-live": "polite" });
    mensagens.forEach(function (m) {
      corpoEl.appendChild(balaoMensagem(m));
    });
    var caixa = el("textarea", { rows: "1", placeholder: "Escreva a sua mensagem\u2026", "aria-label": "Mensagem", maxlength: "1000" });
    var botao = el("button", { classe: "botao", type: "submit", "aria-label": "Enviar" }, [svg(ICONES.enviar, 20)]);
    function mandar() {
      var texto = caixa.value.trim();
      if (!texto || enviando || !conversa) return;
      enviando = true;
      botao.disabled = true;
      chamar("POST", "/mensagens", { c: conversa.c, t: conversa.t, texto: texto })
        .then(function (j) {
          if (j.__status === 404) return esquecerConversa();
          if (!j.ok) throw new Error(j.erro || "N\u00e3o consegui enviar.");
          caixa.value = "";
          caixa.style.height = "";
          receber([j.mensagem]);
        })
        .catch(function (e) {
          receber([{ id: "erro-" + Date.now(), autor: "sistema", texto: e.message || "N\u00e3o consegui enviar. Tente de novo.", created_at: new Date().toISOString(), local: true }]);
        })
        .then(function () {
          enviando = false;
          botao.disabled = false;
          caixa.focus();
        });
    }
    caixa.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        mandar();
      }
    });
    caixa.addEventListener("input", function () {
      caixa.style.height = "auto";
      caixa.style.height = Math.min(caixa.scrollHeight, 110) + "px";
    });
    var form = el("form", { classe: "escrever", onsubmit: function (ev) { ev.preventDefault(); mandar(); } }, [caixa, botao]);
    setTimeout(function () {
      rolar();
      try {
        caixa.focus();
      } catch (e) {}
    }, 30);
    return [
      corpoEl,
      form,
      el("div", { classe: "rodape" }, ["Prefere o WhatsApp? ", el("a", { href: linkWhats("Ol\u00e1! Comecei uma conversa no site da MF."), target: "_blank", rel: "noopener", texto: "Continuar por l\u00e1" })]),
    ];
  }

  function telaMaterial() {
    var slug = atalhoAberto ? atalhoAberto.slug : "";
    return [el("iframe", { classe: "quadro", src: BASE + "/f/" + encodeURIComponent(slug), title: "Formul\u00e1rio do cat\u00e1logo" })];
  }

  function telaContato() {
    var c = (cfg && cfg.contato) || {};
    return [
      el("div", { classe: "corpo" }, [
        cfg && cfg.horario && cfg.horario.texto
          ? el("div", { classe: "dado" }, [el("b", { texto: "Hor\u00e1rio de atendimento" }), el("span", { classe: "linhas", texto: String(cfg.horario.texto).split(" \u00b7 ").join("\n") })])
          : null,
        el("div", { classe: "dado" }, [el("b", { texto: "WhatsApp e telefone" }), el("a", { href: linkWhats(""), target: "_blank", rel: "noopener", texto: c.telefone || "(51) 3536-1422" })]),
        el("div", { classe: "dado" }, [
          el("b", { texto: "F\u00e1brica" }),
          el("a", { href: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("MF International " + (c.endereco || "S\u00e3o Sebasti\u00e3o do Ca\u00ed RS")), target: "_blank", rel: "noopener", texto: c.endereco || "ERS-122, Km 08 \u00b7 S\u00e3o Sebasti\u00e3o do Ca\u00ed/RS" }),
        ]),
        el("div", { classe: "dado" }, [el("b", { texto: "Site" }), el("a", { href: c.site || "https://mfinternational.com.br", target: "_blank", rel: "noopener", texto: "mfinternational.com.br" })]),
        opcao(ICONES.chat, "Falar com a equipe agora", "Atendimento online pelo chat", function () {
          tela = conversa && conversa.c ? "chat" : "formulario";
          desenhar();
          agendar();
        }),
      ]),
    ];
  }

  function desenhar() {
    if (!aberto) return;
    if (painel) painel.remove();
    var partes = tela === "formulario" ? telaFormulario() : tela === "chat" ? telaChat() : tela === "material" ? telaMaterial() : tela === "contato" ? telaContato() : telaInicio();
    painel = el("div", { classe: "painel", role: "dialog", "aria-label": "Atendimento MF International" }, [topo()].concat(partes));
    painel.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") fechar();
    });
    raiz.appendChild(painel);
  }

  function rolar() {
    if (corpoEl) corpoEl.scrollTop = corpoEl.scrollHeight;
  }

  // ---------- conversa ----------
  function receber(lista) {
    var novasDaEquipe = 0;
    (lista || []).forEach(function (m) {
      if (!m || idsVistos[m.id]) return;
      idsVistos[m.id] = 1;
      mensagens.push(m);
      if (!m.local && (!ultimaData || m.created_at > ultimaData)) ultimaData = m.created_at;
      if (m.autor === "equipe") novasDaEquipe++;
      if (aberto && tela === "chat" && corpoEl) corpoEl.appendChild(balaoMensagem(m));
    });
    if (aberto && tela === "chat") rolar();
    else if (novasDaEquipe && ultimaData) {
      naoLidas += novasDaEquipe;
      montarLancador();
    }
  }

  function esquecerConversa() {
    apagar(CHAVE);
    conversa = null;
    mensagens = [];
    idsVistos = {};
    ultimaData = null;
    if (aberto) {
      tela = "inicio";
      desenhar();
    }
  }

  var primeiraBusca = true;
  function buscar(comAtendente) {
    if (!conversa || !conversa.c) return Promise.resolve();
    var q = "?c=" + encodeURIComponent(conversa.c) + "&t=" + encodeURIComponent(conversa.t);
    if (ultimaData) q += "&depois=" + encodeURIComponent(ultimaData);
    if (comAtendente) q += "&atendente=1";
    return chamar("GET", "/mensagens" + q)
      .then(function (j) {
        if (j.__status === 404) return esquecerConversa();
        if (j.atendente && j.atendente.nome && cfg && cfg.atendente && cfg.atendente.nome !== j.atendente.nome) {
          cfg.atendente.nome = j.atendente.nome;
          if (aberto && tela !== "chat") desenhar();
        }
        var antes = primeiraBusca;
        primeiraBusca = false;
        if (antes) {
          // Ao recarregar a página, o que já existia não conta como novo.
          (j.mensagens || []).forEach(function (m) {
            idsVistos[m.id] = 1;
            mensagens.push(m);
            if (!ultimaData || m.created_at > ultimaData) ultimaData = m.created_at;
          });
          if (aberto && tela === "chat") desenhar();
        } else receber(j.mensagens);
      })
      .catch(function () {});
  }

  function agendar() {
    if (relogio) clearTimeout(relogio);
    if (!conversa || !conversa.c) return;
    var olhando = aberto && tela === "chat" && document.visibilityState !== "hidden";
    relogio = setTimeout(function () {
      voltas++;
      buscar(voltas % 10 === 0).then(agendar);
    }, olhando ? 3000 : 20000);
  }
  document.addEventListener("visibilitychange", agendar);

  // ---------- começo ----------
  function iniciar() {
    var q = conversa && conversa.c ? "?c=" + encodeURIComponent(conversa.c) + "&t=" + encodeURIComponent(conversa.t) : "";
    chamar("GET", "/config" + q)
      .then(function (j) {
        if (!j || !j.ativo) return;
        cfg = j;
        if (j.cor && /^#[0-9a-f]{6}$/i.test(j.cor)) COR = j.cor;
        css();
        raiz.appendChild(estilo);
        document.body.appendChild(host);
        montarLancador();
        if (conversa && conversa.c) buscar(false).then(agendar);
        setTimeout(montarConvite, 6000);
      })
      .catch(function () {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
