# 🔐 Configuración de Autenticación con Contraseña

Este documento explica cómo configurar el sistema de login tradicional (email + contraseña) para reemplazar el Magic Link.

---

## 📋 Resumen de cambios

- ✅ Login tradicional con email + contraseña
- ✅ Página de perfil para cambiar contraseña (`/perfil`)
- ✅ SQL para establecer contraseña inicial

---

## 🚀 Pasos de configuración

### 1. Configurar Supabase Auth (Enable Password Login)

Ve a **Supabase Dashboard** → Tu proyecto → **Authentication** → **Providers**:

Asegúrate de que esté habilitado:
- ✅ **Email** provider con "Confirm email" = OFF (para evitar confirmación)
- ❌ Deshabilita "Enable Signup" si quieres control quién puede crear cuentas

### 2. Establecer contraseña para usuario existente

Ejecuta el siguiente SQL en **Supabase Dashboard** → **SQL Editor**:

```sql
-- Cambia la contraseña aquí antes de ejecutar
DO $$
DECLARE
  v_email TEXT := 'lae.kevin.rosas@gmail.com';
  v_new_password TEXT := 'TU_CONTRASEÑA_SEGURA_AQUI';  -- ⚠️ CAMBIA ESTO
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado: %', v_email;
  END IF;
  
  UPDATE auth.users 
  SET encrypted_password = crypt(v_new_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
  WHERE id = v_user_id;
  
  RAISE NOTICE 'Contraseña actualizada para: %', v_email;
END $$;
```

O usa el archivo incluido:
```bash
# Ejecutar en Supabase SQL Editor
sql/setup_password_auth.sql
```

⚠️ **IMPORTANTE**: Cambia `'TU_CONTRASEÑA_SEGURA_AQUI'` por una contraseña segura antes de ejecutar.

### 3. Redeploy en Vercel

```bash
git add .
git commit -m "feat: cambiar a login con email+password"
git push
```

### 4. Probar login

1. Ve a: `https://proyecto-encuestas-termometro-pulso.vercel.app/login`
2. Ingresa tu email y la contraseña que configuraste
3. Deberías acceder al dashboard

---

## 🔧 URLs importantes

| URL | Descripción |
|-----|-------------|
| `/login` | Página de login |
| `/perfil` | Cambiar contraseña y ver info de cuenta |
| `/dashboard` | Dashboard principal |

---

## 📝 Notas

- El usuario debe existir previamente en `auth.users` (creado en Supabase Dashboard)
- La contraseña debe tener mínimo 6 caracteres
- El email no es case-sensitive en el login
- El usuario puede cambiar su contraseña desde `/perfil`

---

## 🆘 Troubleshooting

### "Email o contraseña incorrectos"
- Verifica que el email esté en minúsculas
- Asegúrate de que el SQL se ejecutó correctamente
- Revisa que el usuario exista en `auth.users`

### "Error al iniciar sesión"
- Verifica que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` estén configurados
- Revisa la consola del navegador para más detalles
