#!/usr/bin/env python3
"""
Gera os ícones, a capa de abertura (splash) e a imagem de compartilhamento.

Por que isto é um script e não um punhado de PNGs soltos: quando a marca mudar
— uma cor, o tamanho do anel — ninguém vai redesenhar quinze arquivos na mão.
Roda-se isto de novo e tudo sai coerente.

    python3 scripts/gerar-icones.py

A fonte Space Grotesk (a mesma do sistema) é buscada em scripts/fontes/. Sem
ela, cai numa fonte do sistema: o desenho continua certo, só a palavra AURA
fica com outro traço.
"""
import math, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
ICONES = os.path.join(RAIZ, "public", "icons")
SPLASH = os.path.join(RAIZ, "public", "splash")

# Paleta da casa, igual ao globals.css.
PETROL_950 = (7, 31, 36)
PETROL_700 = (14, 76, 86)
PETROL_400 = (58, 164, 180)
GOLD = (212, 164, 65)
BRANCO = (255, 255, 255)

SS = 4  # supersampling: desenha grande e reduz, para a borda do círculo ficar lisa


def fonte(tamanho, peso=700):
    nome = f"space-grotesk-latin-{peso}-normal.ttf"
    caminho = os.path.join(AQUI, "fontes", nome)
    if os.path.exists(caminho):
        return ImageFont.truetype(caminho, tamanho)
    for alt in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if os.path.exists(alt):
            return ImageFont.truetype(alt, tamanho)
    return ImageFont.load_default()


def fundo(w, h):
    """Gradiente radial: claro no centro, fechando no petróleo mais escuro."""
    img = Image.new("RGB", (w, h), PETROL_950)
    px = img.load()
    cx, cy = w / 2, h / 2
    maxd = math.hypot(cx, cy)
    for y in range(h):
        for x in range(w):
            t = min(1.0, math.hypot(x - cx, y - cy) / maxd)
            t = t ** 0.85
            px[x, y] = tuple(
                int(PETROL_700[i] + (PETROL_950[i] - PETROL_700[i]) * t) for i in range(3)
            )
    return img


def marca(tamanho, escala=0.72):
    """
    O símbolo: dois anéis e um núcleo. É o AuraMark do sistema, desenhado em
    pixel para caber em ícone de app.

    `escala` é a fração do quadrado que o símbolo ocupa. Para ícone maskable
    ela é menor, porque o Android recorta as bordas em círculo e tudo que
    estiver fora dos 80% centrais pode sumir.
    """
    s = tamanho * SS
    camada = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    c = s / 2
    r = (s * escala) / 2

    def anel(raio, cor, alfa, espessura):
        d.ellipse([c - raio, c - raio, c + raio, c + raio],
                  outline=cor + (alfa,), width=max(1, int(espessura)))

    anel(r, BRANCO, 55, s * 0.012)          # anel externo, discreto
    anel(r * 0.62, PETROL_400, 230, s * 0.026)  # anel do meio, a cor da marca

    # Núcleo dourado com brilho. O dourado é a cor de destaque da casa e,
    # num negócio de lareira e aquecimento, um centro quente faz sentido.
    brilho = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(brilho)
    rg = r * 0.40
    gd.ellipse([c - rg, c - rg, c + rg, c + rg], fill=GOLD + (120,))
    brilho = brilho.filter(ImageFilter.GaussianBlur(s * 0.035))
    camada = Image.alpha_composite(camada, brilho)

    d = ImageDraw.Draw(camada)
    rn = r * 0.235
    d.ellipse([c - rn, c - rn, c + rn, c + rn], fill=GOLD + (255,))

    return camada.resize((tamanho, tamanho), Image.LANCZOS)


def icone(tamanho, maskable=False):
    img = fundo(tamanho, tamanho).convert("RGBA")
    # 0.56 no maskable: o símbolo inteiro dentro da zona segura de 80%.
    img = Image.alpha_composite(img, marca(tamanho, 0.56 if maskable else 0.76))
    return img.convert("RGB")


def capa(w, h, com_texto=True):
    """Capa de abertura e imagem de compartilhamento."""
    img = fundo(w, h).convert("RGBA")
    lado = int(min(w, h) * (0.26 if com_texto else 0.42))
    m = marca(lado, 0.92)
    topo = int(h / 2 - lado * (0.78 if com_texto else 0.5))
    img.alpha_composite(m, (int(w / 2 - lado / 2), topo))

    if com_texto:
        d = ImageDraw.Draw(img)
        f1 = fonte(int(min(w, h) * 0.095), 700)
        f2 = fonte(int(min(w, h) * 0.030), 500)
        y = topo + lado + int(min(w, h) * 0.035)

        t = "AURA"
        cx = w / 2 - d.textlength(t, font=f1) / 2
        d.text((cx, y), t, font=f1, fill=BRANCO + (255,))

        y += int(min(w, h) * 0.115)
        t2 = "Sales OS  ·  Grupo MF"
        cx = w / 2 - d.textlength(t2, font=f2) / 2
        d.text((cx, y), t2, font=f2, fill=PETROL_400 + (235,))

    return img.convert("RGB")


def salvar(img, caminho):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    img.save(caminho, optimize=True)
    print("  ", os.path.relpath(caminho, RAIZ), f"{os.path.getsize(caminho)//1024} KB")


print("Ícones:")
for t in (192, 512):
    salvar(icone(t), os.path.join(ICONES, f"aura-{t}.png"))
    salvar(icone(t, maskable=True), os.path.join(ICONES, f"aura-maskable-{t}.png"))
salvar(icone(180), os.path.join(ICONES, "apple-touch-icon.png"))

# .ico com os três tamanhos que o Windows e os navegadores antigos pedem.
icone(64).save(os.path.join(RAIZ, "public", "favicon.ico"),
               sizes=[(16, 16), (32, 32), (48, 48)])
print("   public/favicon.ico")

print("Compartilhamento:")
salvar(capa(1200, 630), os.path.join(RAIZ, "public", "og-image.png"))

print("Capa de abertura (iPhone e iPad mais comuns):")
# width, height, nome — as medidas em pixels reais de cada aparelho.
for w, h, nome in [
    (1290, 2796, "iphone-15-pro-max"),
    (1179, 2556, "iphone-15"),
    (1170, 2532, "iphone-13-14"),
    (1125, 2436, "iphone-x-11pro"),
    (828, 1792, "iphone-11"),
    (750, 1334, "iphone-8"),
    (1536, 2048, "ipad"),
    (1668, 2388, "ipad-pro-11"),
    (2048, 2732, "ipad-pro-129"),
]:
    salvar(capa(w, h), os.path.join(SPLASH, f"{nome}.png"))
    salvar(capa(h, w), os.path.join(SPLASH, f"{nome}-paisagem.png"))

print("\nPronto.")
