from cryptography.fernet import Fernet


class Cipher:
    """Fernet (AES-128-CBC + HMAC, con IV aleatorio por valor): el mismo texto da un
    resultado distinto cada vez que se cifra."""

    def __init__(self, key: str):
        self._fernet = Fernet(key.encode())

    def encrypt(self, text: str) -> str:
        return self._fernet.encrypt(text.encode()).decode()

    def decrypt(self, token: str) -> str:
        return self._fernet.decrypt(token.encode()).decode()


def generate_key() -> str:
    return Fernet.generate_key().decode()
