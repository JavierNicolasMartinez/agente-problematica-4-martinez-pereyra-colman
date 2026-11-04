"""Normalización de texto para comparar nombres sin importar acentos, signos ni plurales."""
import re
import unicodedata

PALABRAS_VACIAS = {"de", "del", "la", "el", "los", "las", "para", "con", "en", "y", "x", "por", "un", "una"}


def normalizar(texto) -> str:
    """Minúsculas, sin acentos ni signos. "Azúcar Ledesma!" -> "azucar ledesma"."""
    sin_acentos = "".join(
        c for c in unicodedata.normalize("NFD", str(texto or "")) if unicodedata.category(c) != "Mn"
    )
    limpio = re.sub(r"[^a-z0-9.,\s]", " ", sin_acentos.lower().replace("&", " y "))
    return re.sub(r"\s+", " ", limpio).strip()


def _singular(palabra: str) -> str:
    return palabra[:-1] if len(palabra) > 3 and palabra.endswith("s") else palabra


def tokens(texto) -> list:
    palabras = re.sub(r"[.,]", " ", normalizar(texto)).split()
    return [_singular(p) for p in palabras if p not in PALABRAS_VACIAS]


def contiene_frase(texto, frase) -> bool:
    buscada = " ".join(tokens(frase))
    return bool(buscada) and f" {buscada} " in f" {' '.join(tokens(texto))} "
