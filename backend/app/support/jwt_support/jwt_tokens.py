import jwt


class JwtError(Exception):
    """Token mal formado, con firma inválida o vencido."""


def encode(payload: dict, secret: str, algorithm: str) -> str:
    return jwt.encode(payload, secret, algorithm=algorithm)


def decode(token: str, secret: str, algorithm: str) -> dict:
    try:
        return jwt.decode(token, secret, algorithms=[algorithm])
    except jwt.PyJWTError as exc:
        raise JwtError(str(exc)) from exc
