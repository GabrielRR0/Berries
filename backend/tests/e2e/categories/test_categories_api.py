def _register(client, email="ana@example.com"):
    response = client.post(
        "/api/auth/register", json={"email": email, "password": "supersecret123", "display_name": "Ana"}
    )
    return response.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_list_categories_includes_seeded_defaults(client):
    token = _register(client)

    response = client.get("/api/categories", headers=_auth_headers(token))

    assert response.status_code == 200
    names = {item["name"] for item in response.json()}
    assert "Mercado" in names
    assert "Salario" in names


def test_list_categories_filters_by_kind(client):
    token = _register(client)

    response = client.get("/api/categories", params={"kind": "income"}, headers=_auth_headers(token))

    body = response.json()
    assert all(item["kind"] in ("income", "both") for item in body)
    assert "Mercado" not in {item["name"] for item in body}


def test_create_category_then_appears_in_list(client):
    token = _register(client)

    response = client.post("/api/categories", json={"name": "Mascotas", "kind": "expense"}, headers=_auth_headers(token))

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Mascotas"
    assert body["is_default"] is False

    listed = client.get("/api/categories", headers=_auth_headers(token)).json()
    assert "Mascotas" in {item["name"] for item in listed}


def test_create_category_rejects_invalid_kind(client):
    token = _register(client)

    response = client.post("/api/categories", json={"name": "Mascotas", "kind": "gasto"}, headers=_auth_headers(token))

    assert response.status_code == 422  # Pydantic Literal rechaza el valor antes de llegar al service


def test_delete_own_category_succeeds(client):
    token = _register(client)
    created = client.post("/api/categories", json={"name": "Mascotas", "kind": "expense"}, headers=_auth_headers(token))
    category_id = created.json()["id"]

    response = client.delete(f"/api/categories/{category_id}", headers=_auth_headers(token))

    assert response.status_code == 204
    listed = client.get("/api/categories", headers=_auth_headers(token)).json()
    assert "Mascotas" not in {item["name"] for item in listed}


def test_delete_default_category_is_rejected(client):
    token = _register(client)
    default = next(
        item for item in client.get("/api/categories", headers=_auth_headers(token)).json() if item["name"] == "Mercado"
    )

    response = client.delete(f"/api/categories/{default['id']}", headers=_auth_headers(token))

    assert response.status_code == 409


def test_hide_then_unhide_a_default_category(client):
    token = _register(client)
    default = next(
        item for item in client.get("/api/categories", headers=_auth_headers(token)).json() if item["name"] == "Mercado"
    )

    hide_response = client.post(f"/api/categories/{default['id']}/hide", headers=_auth_headers(token))
    assert hide_response.status_code == 204
    after_hide = client.get("/api/categories", headers=_auth_headers(token)).json()
    assert "Mercado" not in {item["name"] for item in after_hide}

    unhide_response = client.delete(f"/api/categories/{default['id']}/hide", headers=_auth_headers(token))
    assert unhide_response.status_code == 204
    after_unhide = client.get("/api/categories", headers=_auth_headers(token)).json()
    assert "Mercado" in {item["name"] for item in after_unhide}


def test_hidden_category_is_absent_by_default_but_visible_with_include_hidden(client):
    token = _register(client)
    default = next(
        item for item in client.get("/api/categories", headers=_auth_headers(token)).json() if item["name"] == "Mercado"
    )
    client.post(f"/api/categories/{default['id']}/hide", headers=_auth_headers(token))

    without_hidden = client.get("/api/categories", headers=_auth_headers(token)).json()
    assert "Mercado" not in {item["name"] for item in without_hidden}

    with_hidden = client.get("/api/categories", params={"include_hidden": "true"}, headers=_auth_headers(token)).json()
    hidden_entry = next(item for item in with_hidden if item["name"] == "Mercado")
    assert hidden_entry["is_hidden"] is True


def test_categories_require_auth(client):
    response = client.get("/api/categories")

    assert response.status_code in (401, 403)
