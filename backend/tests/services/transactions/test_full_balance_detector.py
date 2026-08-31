import uuid
from decimal import Decimal

from app.models.wallets.wallet_model import Wallet
from app.services.transactions.drafts.full_balance_detector import detect_full_balance_wallet


# Solo se instancia en memoria (nunca se persiste) - detect_full_balance_wallet()
# matchea unicamente por .name, currency_id no hace falta aca.
def _wallet(name, balance="100.00"):
    return Wallet(id=uuid.uuid4(), user_id=uuid.uuid4(), name=name, balance=Decimal(balance))


def test_returns_none_without_a_full_balance_phrase():
    binance = _wallet("Binance")

    result = detect_full_balance_wallet("gasté 41 usdt en el gym", [binance])

    assert result is None


def test_matches_wallet_by_exact_name_with_full_balance_phrase():
    binance = _wallet("Binance")
    cash = _wallet("Efectivo")

    result = detect_full_balance_wallet("gasté todo lo que tenía en mi cuenta de Binance", [binance, cash])

    assert result is binance


def test_matches_a_multiword_wallet_name_by_a_significant_word_even_if_paraphrased():
    banco_venezuela = _wallet("Banco de Venezuela")

    result = detect_full_balance_wallet("usé todo lo que tenía en mi cuenta de Venezuela", [banco_venezuela])

    assert result is banco_venezuela


def test_returns_none_when_no_wallet_name_is_mentioned():
    binance = _wallet("Binance")

    result = detect_full_balance_wallet("gasté todo lo que tenía este mes", [binance])

    assert result is None


def test_returns_none_when_the_mention_is_ambiguous_between_two_wallets():
    binance = _wallet("Binance USDT")
    binance_p2p = _wallet("Binance P2P")

    result = detect_full_balance_wallet("vacié mi cuenta de Binance", [binance, binance_p2p])

    assert result is None


def test_recognizes_several_full_balance_phrasings():
    nu = _wallet("Nu")

    assert detect_full_balance_wallet("no me quedó nada en Nu", [nu]) is nu
    assert detect_full_balance_wallet("se fue todo de mi cuenta Nu", [nu]) is nu
    assert detect_full_balance_wallet("todo el saldo de Nu se acabó", [nu]) is nu
