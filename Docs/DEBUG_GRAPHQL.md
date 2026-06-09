# GraphQL Authentication Issue - Debug Report

## Problem
The GraphQL `me` query returns "Invalid payload" error even when a valid JWT token is provided in the Authorization header.

## Root Cause Analysis

The issue is that `info.context` in the resolver is not properly set up to access the user from the request. The JWT middleware should set this, but the resolver wasn't handling the context correctly.

## Changes Made

### 1. Updated `identity/schema.py`
- Added detailed logging to debug context issues
- Improved error handling to show exactly what's failing
- Made resolver more robust in accessing user from request context
- Handles both dict-style and request object contexts

### 2. Updated `urls.py` 
- Explicitly pass schema to GraphQLView (though graphene config should handle this)

### 3. Added debug script
- Created `test_graphql_debug.py` to test different query formats
- Will help isolate which specific field is causing the "Invalid payload" error

## Next Steps

1. **Rebuild and restart:**
   ```bash
   docker compose down
   docker compose build backend
   docker compose up -d
   ```

2. **Wait for backend to finish migrations** (about 10 seconds)

3. **Run the debug test script:**
   ```bash
   docker compose exec deploy_connector python test_graphql_debug.py
   ```

4. **Check backend logs for error details:**
   ```bash
   docker compose logs backend | grep -A 5 "resolve_me"
   ```

## What to Look For

The debug script tests 5 different query formats:
- Simple `{ me { username } }` - to check basic authentication
- With `id` field - to test if field access works
- Direct `organization` field - without nesting
- Full query with nested organization - the original failing query
- Unauthenticated query - to see expected auth error

The error message should now be more specific, like:
- "No request context available" → JWT middleware not working
- "User is not authenticated" → Token not being recognized
- "No user in request context" → Context setup issue

This will help identify exactly where the problem is.

## If Still Failing

If the issue persists after these changes, check:
1. Is `graphql_jwt` properly installed? `docker compose exec backend pip list | grep graphql-jwt`
2. Is the JWT middleware loading? Check for "JSONWebTokenMiddleware" in backend logs
3. Is the token actually valid? Run `docker compose exec backend python manage.py generate_connector_token` to get a fresh token
