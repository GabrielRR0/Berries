# google_identity_support/

`verify_google_id_token(id_token)` verifica el ID token de "Iniciar sesión con Google"
contra el endpoint `tokeninfo` de Google y devuelve un `GoogleIdentity`. Sin
`GOOGLE_CLIENT_ID` configurado, todo intento se rechaza con `GoogleAuthError`. El módulo
`auth` traduce ese error a su `GoogleLoginError` (400).
