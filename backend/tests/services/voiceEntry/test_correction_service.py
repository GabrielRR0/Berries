import uuid

from app.services.auth.auth_service import register_user
from app.services.voiceEntry.correction.correction_service import correct_transcript
from app.services.voiceEntry.correction.rules.personal_vocabulary import build_user_vocabulary, correct_against_vocabulary
from app.services.wallets.wallet_service import create_wallet


def _user(db, email="ana@example.com"):
    return register_user(db, email, "clave12345", "Ana")


def test_global_rule_fixes_common_binance_mishearing(db):
    result = correct_transcript(db, uuid.uuid4(), "gasté 5 dólares en Binans")
    assert "Binance" in result.text


def test_global_rule_does_not_touch_unrelated_text(db):
    result = correct_transcript(db, uuid.uuid4(), "compré comida en el mercado")
    assert result.text == "compré comida en el mercado"


def test_personal_vocabulary_corrects_a_mistranscribed_wallet_name(db):
    user = _user(db)
    create_wallet(db, user.id, "Binance", "USDT")

    corrected, corrections = correct_against_vocabulary(
        "envié 10 usdt a mi wallet Binence", build_user_vocabulary(db, user.id)
    )

    assert "Binance" in corrected
    assert ("Binence", "Binance") in corrections


def test_personal_vocabulary_never_corrects_short_words(db):
    """_MIN_WORD_LEN evita falsos positivos sobre palabras cortas comunes."""
    user = _user(db)
    create_wallet(db, user.id, "Va", "USD")  # nombre corto a proposito

    corrected, corrections = correct_against_vocabulary("voy al banco", build_user_vocabulary(db, user.id))

    assert corrected == "voy al banco"
    assert corrections == []


def test_correct_against_vocabulary_is_a_noop_with_empty_vocabulary():
    corrected, corrections = correct_against_vocabulary("cualquier texto", [])
    assert corrected == "cualquier texto"
    assert corrections == []


def test_correct_against_vocabulary_does_not_report_case_only_differences():
    corrected, corrections = correct_against_vocabulary("compré en transporte", ["Transporte"])
    # "transporte" (texto original) coincide exacto salvo mayuscula - no cuenta como
    # correccion real, se preserva el texto tal cual vino.
    assert corrected == "compré en transporte"
    assert corrections == []
