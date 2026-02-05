

## Plan: Fix CORS and React Ref Warnings

### Problem Analysis

Two issues were identified in the console:

1. **CORS Error on PrintNode Edge Function**: The `callPrintNodeApiWithParams` function uses raw `fetch()` with an incorrect environment variable name (`VITE_SUPABASE_PUBLISHABLE_KEY` should be `VITE_SUPABASE_ANON_KEY`). This causes the edge function call to fail on preflight.

2. **React Ref Warnings**: Several function components are being passed refs without using `React.forwardRef`. These warnings occur because parent components (like Dialog, Select) try to pass refs to child components.

---

### Solution

#### Part 1: Fix PrintNode API Call

Edit `src/hooks/usePrintNode.ts`:
- Change `VITE_SUPABASE_PUBLISHABLE_KEY` to `VITE_SUPABASE_ANON_KEY`
- Ensure the fetch call uses the correct Supabase anon key

**Change (line 99):**
```typescript
// FROM:
'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,

// TO:
'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
```

---

### Technical Notes

- The React ref warnings are coming from Radix UI primitives and are cosmetic (non-breaking). They typically occur when the library version has components not wrapped with forwardRef. These warnings do not affect functionality and will likely be resolved in future Radix UI updates.

- The CORS fix is the critical change that will allow the PrintNode integration to work properly.

