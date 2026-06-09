# MISP API Key Verification Guide

## Problem
The "PUSH 2 MISP" button is not working. The backend diagnostics show that authentication is failing - MISP is rejecting the API key with a 302 redirect to the login page.

## Root Cause
The API key (Authkey) in your configuration is either:
1. **Incorrect/outdated** - copied wrong value
2. **For a disabled user** - the MISP user account was disabled
3. **Missing API permissions** - the user doesn't have API access enabled

## Solution: Verify and Update Your API Key

### Step 1: Access MISP Web Interface
```
Open in your browser: https://misp.counterintel.cz
```

### Step 2: Log In
```
Enter your MISP username and password
Click "Login"
```

### Step 3: Navigate to User Profile
```
Click your username in the top-right corner
Select "Profile" from the dropdown menu
```

### Step 4: Copy Your Authkey
```
Look for a field labeled "Authkey" (usually at the bottom of the page)
It will look like: lzKbe82cl5Xyth9173XDBCWV7dCYwihbys3CEBoV
⚠️  Make sure you copy the AUTHKEY, not your password!
```

### Step 5: Verify User Permissions
While in your Profile, check:
```
✓ Is the user ENABLED? (should have a green checkmark or enabled status)
✓ Does it show "API access enabled"? (if there's a permission indicator)
```

If API access is NOT enabled:
1. Go to Administration → Users
2. Find your user in the list
3. Click to edit
4. Check the "API access enabled" checkbox
5. Save changes

### Step 6: Test Your API Key

Run this command to verify your new authkey:
```bash
docker compose exec backend python manage.py test_misp_key --key YOUR_AUTHKEY_HERE
```

Example:
```bash
docker compose exec backend python manage.py test_misp_key --key lzKbe82cl5Xyth9173XDBCWV7dCYwihbys3CEBoV
```

**Expected output if correct:**
```
Final Status: HTTP 200

✓ SUCCESS - Got JSON response!

MISP Version: 2.4.XXX
✅ API KEY IS VALID!
```

**If authentication still fails:**
```
Final Status: HTTP 302

✗ FAILED - Got login page (auth failed)
This API key is not valid or user doesn't have API access.
```

### Step 7: Update Your Configuration

Once you have the correct Authkey:

**Option A: Using environment variable**
```bash
# In docker-compose.yml, update:
environment:
  MISP_API_KEY: YOUR_CORRECT_AUTHKEY_HERE
```

**Option B: Using .env file**
```bash
# In .env file:
MISP_API_KEY=YOUR_CORRECT_AUTHKEY_HERE
```

**Option C: Using docker-compose.override.yml**
```yaml
services:
  backend:
    environment:
      MISP_API_KEY: YOUR_CORRECT_AUTHKEY_HERE
```

### Step 8: Restart Backend Container
```bash
docker compose restart backend
```

### Step 9: Verify Connection
```bash
docker compose exec backend python manage.py test_misp
```

Expected output:
```
✓ Testing MISP connection...
✓ MISP connection successful!
```

### Step 10: Test PUSH 2 MISP

1. Open the Hefaistos frontend in your browser
2. Create or edit an ADVOPS hunt
3. Click "PUSH 2 MISP" button
4. You should see: "Hunt pushed to MISP (Event #XXXX)"
5. Verify the event appears in MISP interface

## Troubleshooting

### Still getting "Failed to push to MISP"?

Check backend logs:
```bash
docker compose logs backend -f
```

Look for lines starting with:
```
- MISPClient initialization error
- Failed to create event: HTTP XXX
- Got login page (auth failed)
- Empty response from MISP
```

### "HTTP 401 Unauthorized"?
- API key format is wrong
- Try copying from MISP profile again

### "HTTP 403 Forbidden"?
- API key is valid but user lacks permissions
- Ask MISP administrator to enable API access for your user

### "Connection refused" or "Connection timeout"?
- MISP server is not running
- Check MISP_URL is correct
- Verify MISP is accessible: `ping misp.counterintel.cz`

## Quick Reference Commands

```bash
# Show current MISP configuration
docker compose exec backend python manage.py test_misp_key

# Test with a specific API key
docker compose exec backend python manage.py test_misp_key --key YOUR_KEY_HERE

# Run all MISP diagnostics
docker compose exec backend python manage.py test_misp_diagnostic

# View backend logs while testing
docker compose logs backend -f

# Restart backend after changing API key
docker compose restart backend
```

## Important Notes

- **Authkey ≠ Password**: Never use your MISP login password as the API key
- **Case-sensitive**: The Authkey must be copied exactly (case matters)
- **40 characters**: The Authkey is always 40 characters long (should look like hexadecimal)
- **Don't share**: Keep your Authkey secret - it's like your API password
