
## Plan: Fix CORS Error for sync-orders-status Edge Function

### Problem

The `sync-orders-status` edge function is failing CORS preflight checks. The error occurs because:

1. **Missing config entry**: The function is not listed in `supabase/config.toml`, so `verify_jwt` defaults to `true`
2. When `verify_jwt = true`, the OPTIONS preflight request fails because it has no authorization token

### Solution

Add the `sync-orders-status` function to `supabase/config.toml` with `verify_jwt = false`.

**Edit `supabase/config.toml`:**

```toml
project_id = "cpxuluerkzpynlcdnxcq"

[functions.redistribute-items]
verify_jwt = false
 
[functions.webhook-orders]
verify_jwt = false

[functions.printnode]
verify_jwt = false

[functions.sync-orders-status]
verify_jwt = false
```

### Technical Details

- The edge function already implements proper authentication checks in code using the Supabase client
- Setting `verify_jwt = false` allows the OPTIONS preflight to pass, while the actual POST requests still validate the user's session via the authorization header
- This is the standard pattern used by other functions in this project (webhook-orders, redistribute-items, printnode)
