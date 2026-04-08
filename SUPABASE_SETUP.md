# 🔐 Supabase Configuration Guide

Panduan lengkap konfigurasi Supabase untuk Skill Gap Tracker.

---

## 📋 Prerequisites

- Akun Supabase (gratis) - [Daftar di sini](https://supabase.com)
- Project Supabase sudah dibuat

---

## ⚙️ Konfigurasi Wajib

### 1. Authentication Settings

#### A. Email Authentication
1. Buka Supabase Dashboard → **Authentication** → **Providers**
2. Pastikan **Email** provider **ENABLED** ✅
3. Settings yang perlu dikonfigurasi:

**Email Confirmation:**
- ✅ **Enable email confirmations** - User harus verifikasi email
- ⏱️ **Confirmation email expiry**: 24 hours (default)

**Email Templates:**
- Customize template jika perlu (opsional)
- Default template sudah cukup bagus

#### B. URL Configuration
1. Buka **Authentication** → **URL Configuration**
2. Konfigurasi URL berikut:

**Site URL:**
```
Development: http://localhost:3000
Production: https://your-domain.com
```

**Redirect URLs (PENTING!):**
Tambahkan semua URL berikut:

```
# Development URLs
http://localhost:3000
http://localhost:3000/onboarding
http://localhost:3000/dashboard
http://localhost:3000/reset-kata-sandi

# Production URLs (ganti dengan domain Anda)
https://your-domain.com
https://your-domain.com/onboarding
https://your-domain.com/dashboard
https://your-domain.com/reset-kata-sandi
```

**⚠️ PENTING:** Tanpa whitelist URL di atas, redirect setelah email verification akan GAGAL!

#### C. Email Rate Limiting (Opsional)
1. **Authentication** → **Rate Limits**
2. Recommended settings:
   - Email sent per hour: 4 (default)
   - SMS sent per hour: 4 (default)

---

### 2. Database Configuration

#### A. Row Level Security (RLS)
RLS sudah dikonfigurasi di `database/schema.sql`. Pastikan:

1. Buka **Database** → **Policies**
2. Verifikasi policies untuk setiap table:

**Policies yang harus ada:**

```
✅ job_roles: Public read
✅ skills: Public read
✅ job_role_skills: Public read
✅ job_requirements: Public read
✅ skill_resources: Public read
✅ profiles: Users can view/update own profile
✅ user_skills: Users can manage own skills
✅ user_progress: Users can manage own progress
✅ roadmaps: Users can manage own roadmaps
✅ roadmap_phase_progress: Users can manage own phase progress
```

#### B. Database Extensions
Pastikan extensions berikut enabled:

1. Buka **Database** → **Extensions**
2. Enable:
   - ✅ `uuid-ossp` - For UUID generation
   - ✅ `vector` - For pgvector (semantic search)

---

### 3. API Settings

#### A. API Keys
1. Buka **Settings** → **API**
2. Copy credentials berikut:

**Untuk Backend (.env):**
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # SECRET! Jangan expose ke frontend
```

**Untuk Frontend (.env.local):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...  # Public key, aman untuk frontend
```

**⚠️ PENTING:**
- `service_role` key = BACKEND ONLY (bypass RLS)
- `anon` key = FRONTEND (respect RLS)
- JANGAN gunakan `service_role` key di frontend!

#### B. CORS Configuration
CORS sudah auto-configured oleh Supabase untuk domain yang di-whitelist di URL Configuration.

---

### 4. Storage Configuration (Opsional)

Jika ingin fitur upload avatar/file:

1. Buka **Storage** → **Create bucket**
2. Nama bucket: `avatars` atau `user-files`
3. Set policies:
   - Users can upload to own folder
   - Public read for avatars

---

## 🔒 Security Best Practices

### 1. Environment Variables
```bash
# ❌ JANGAN commit file ini:
.env
.env.local

# ✅ Commit file ini:
.env.example
.env.example.local
```

### 2. API Keys
- ✅ `anon` key → Frontend (public)
- ❌ `service_role` key → Backend only (secret)
- ❌ JANGAN hardcode keys di code
- ✅ Gunakan environment variables

### 3. RLS Policies
- ✅ Enable RLS untuk semua user tables
- ✅ Test policies dengan different users
- ❌ Jangan disable RLS di production

### 4. Password Policy
Default Supabase settings:
- Minimum 6 characters
- No special requirements

Untuk production, consider:
- Minimum 8 characters
- Require uppercase, lowercase, number

---

## 🧪 Testing Configuration

### Test Email Verification Flow

1. **Register new user:**
   ```bash
   # Frontend
   http://localhost:3000/signup
   ```

2. **Check email:**
   - Buka inbox
   - Klik "Confirm your email"
   - Should redirect to: `http://localhost:3000/onboarding`

3. **Verify in Supabase:**
   - Dashboard → **Authentication** → **Users**
   - User status should be: ✅ Confirmed

### Test Password Reset Flow

1. **Request reset:**
   ```bash
   http://localhost:3000/lupa-kata-sandi
   ```

2. **Check email:**
   - Klik "Reset Password"
   - Should redirect to: `http://localhost:3000/reset-kata-sandi`

3. **Set new password:**
   - Enter new password
   - Should auto-login and redirect to dashboard

### Test API Access

```bash
# Test with anon key (should work)
curl -H "apikey: YOUR_ANON_KEY" \
     https://xxxxx.supabase.co/rest/v1/job_roles

# Test with service_role key (should work)
curl -H "apikey: YOUR_SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     https://xxxxx.supabase.co/rest/v1/profiles
```

---

## 🐛 Troubleshooting

### Error: "Invalid Redirect URL"
**Penyebab:** URL tidak di-whitelist di Supabase

**Solusi:**
1. Buka **Authentication** → **URL Configuration**
2. Tambahkan URL ke **Redirect URLs**
3. Save dan coba lagi

### Error: "Email not confirmed"
**Penyebab:** User belum klik link verifikasi

**Solusi:**
1. Cek email spam folder
2. Atau disable email confirmation (development only):
   - **Authentication** → **Providers** → **Email**
   - Uncheck "Enable email confirmations"

### Error: "Row Level Security policy violation"
**Penyebab:** RLS policy tidak allow operation

**Solusi:**
1. Cek policies di **Database** → **Policies**
2. Pastikan policy allow operation untuk user
3. Test dengan different user

### Error: "Invalid API key"
**Penyebab:** API key salah atau expired

**Solusi:**
1. Buka **Settings** → **API**
2. Copy ulang API keys
3. Update `.env` files
4. Restart servers

---

## 📊 Monitoring

### Check User Activity
1. **Authentication** → **Users**
   - Total users
   - Last sign in
   - Email confirmed status

### Check Database Usage
1. **Database** → **Database**
   - Database size
   - Connection pooling
   - Query performance

### Check API Usage
1. **Settings** → **Usage**
   - API requests
   - Database queries
   - Storage usage

---

## 🚀 Production Checklist

Sebelum deploy ke production:

- [ ] Update **Site URL** dengan production domain
- [ ] Tambahkan production URLs ke **Redirect URLs**
- [ ] Enable **Email confirmations**
- [ ] Set strong password policy
- [ ] Review all RLS policies
- [ ] Test email delivery (not in spam)
- [ ] Setup custom email templates (opsional)
- [ ] Enable 2FA untuk Supabase account
- [ ] Setup database backups
- [ ] Monitor API usage limits
- [ ] Setup alerts untuk errors

---

## 📚 Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [API Reference](https://supabase.com/docs/reference/javascript/introduction)

---

## 🆘 Need Help?

1. Check [Supabase Discord](https://discord.supabase.com)
2. Read [Supabase Docs](https://supabase.com/docs)
3. Check project logs di Supabase Dashboard
4. Review this guide again

---

**Last Updated:** April 2026  
**Version:** 1.0
