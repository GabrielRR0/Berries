import uuid

import pytest

from app.services.auth.auth_service import register_user
from app.services.transactions.categories.errors import CategoryNotFoundError, CategoryPermissionError, CategoryValidationError
from app.services.transactions.categories.category_service import (
    build_category_response,
    create_category,
    delete_category,
    get_hidden_category_ids,
    hide_category,
    list_categories_for_user,
    unhide_category,
)


def _user(db, email="ana@example.com"):
    return register_user(db, email, "clave12345", "Ana")


def test_list_categories_includes_the_seeded_defaults(db):
    user = _user(db)

    categories = list_categories_for_user(db, user.id)

    names = {c.name for c in categories}
    assert "Salario" in names
    assert "Mercado" in names
    assert "Gym" in names


def test_list_categories_filters_by_kind_including_both(db):
    user = _user(db)
    create_category(db, user.id, "Ahorros e inversiones", "both")

    income = list_categories_for_user(db, user.id, kind="income")
    expense = list_categories_for_user(db, user.id, kind="expense")

    assert "Salario" in {c.name for c in income}
    assert "Mercado" not in {c.name for c in income}
    assert "Ahorros e inversiones" in {c.name for c in income}
    assert "Ahorros e inversiones" in {c.name for c in expense}


def test_list_categories_only_shows_own_custom_categories(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")
    create_category(db, user_a.id, "Colegio de los niños", "expense")

    categories_b = list_categories_for_user(db, user_b.id)

    assert "Colegio de los niños" not in {c.name for c in categories_b}


def test_create_category_rejects_empty_name(db):
    user = _user(db)

    with pytest.raises(CategoryValidationError):
        create_category(db, user.id, "   ", "expense")


def test_create_category_rejects_invalid_kind(db):
    user = _user(db)

    with pytest.raises(CategoryValidationError):
        create_category(db, user.id, "Mascotas", "gasto")  # debe ser "expense", no español


def test_delete_category_removes_a_custom_category(db):
    user = _user(db)
    category = create_category(db, user.id, "Mascotas", "expense")

    delete_category(db, user.id, category.id)

    assert "Mascotas" not in {c.name for c in list_categories_for_user(db, user.id)}


def test_delete_category_rejects_a_default_category(db):
    user = _user(db)
    default = next(c for c in list_categories_for_user(db, user.id) if c.name == "Mercado")

    with pytest.raises(CategoryPermissionError):
        delete_category(db, user.id, default.id)


def test_delete_category_rejects_someone_elses_custom_category(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")
    category = create_category(db, user_a.id, "Mascotas", "expense")

    with pytest.raises(CategoryNotFoundError):
        delete_category(db, user_b.id, category.id)


def test_delete_category_rejects_unknown_id(db):
    user = _user(db)

    with pytest.raises(CategoryNotFoundError):
        delete_category(db, user.id, uuid.uuid4())


def test_hide_category_removes_a_default_from_this_users_list_only(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")
    default = next(c for c in list_categories_for_user(db, user_a.id) if c.name == "Mercado")

    hide_category(db, user_a.id, default.id)

    assert "Mercado" not in {c.name for c in list_categories_for_user(db, user_a.id)}
    assert "Mercado" in {c.name for c in list_categories_for_user(db, user_b.id)}


def test_hide_category_is_idempotent(db):
    user = _user(db)
    default = next(c for c in list_categories_for_user(db, user.id) if c.name == "Mercado")

    hide_category(db, user.id, default.id)
    hide_category(db, user.id, default.id)  # no debe fallar ni duplicar

    assert "Mercado" not in {c.name for c in list_categories_for_user(db, user.id)}


def test_hide_category_rejects_a_custom_category(db):
    user = _user(db)
    category = create_category(db, user.id, "Mascotas", "expense")

    with pytest.raises(CategoryPermissionError):
        hide_category(db, user.id, category.id)


def test_unhide_category_brings_it_back(db):
    user = _user(db)
    default = next(c for c in list_categories_for_user(db, user.id) if c.name == "Mercado")
    hide_category(db, user.id, default.id)

    unhide_category(db, user.id, default.id)

    assert "Mercado" in {c.name for c in list_categories_for_user(db, user.id)}


def test_unhide_category_is_a_no_op_when_not_hidden(db):
    user = _user(db)
    default = next(c for c in list_categories_for_user(db, user.id) if c.name == "Mercado")

    unhide_category(db, user.id, default.id)  # no debe fallar

    assert "Mercado" in {c.name for c in list_categories_for_user(db, user.id)}


def test_build_category_response_marks_defaults_and_custom_correctly(db):
    user = _user(db)
    default = next(c for c in list_categories_for_user(db, user.id) if c.name == "Mercado")
    custom = create_category(db, user.id, "Mascotas", "expense")

    assert build_category_response(default).is_default is True
    assert build_category_response(custom).is_default is False
    assert build_category_response(default).is_hidden is False


def test_list_categories_with_include_hidden_keeps_hidden_ones_and_marks_them(db):
    user = _user(db)
    default = next(c for c in list_categories_for_user(db, user.id) if c.name == "Mercado")
    hide_category(db, user.id, default.id)

    without_hidden = list_categories_for_user(db, user.id)
    with_hidden = list_categories_for_user(db, user.id, include_hidden=True)
    hidden_ids = get_hidden_category_ids(db, user.id)

    assert "Mercado" not in {c.name for c in without_hidden}
    assert "Mercado" in {c.name for c in with_hidden}
    assert default.id in hidden_ids
    assert build_category_response(default, hidden_ids).is_hidden is True
