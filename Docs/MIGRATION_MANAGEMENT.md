# Django Migration Management Best Practices

## Overview
This document explains how to manage Django migrations in HEFAISTOS to avoid deployment issues.

## Key Principles

### 1. Migrations MUST be Version Controlled
✅ **DO**: Keep all migrations in git
```
backend/pain_points/migrations/
  ├── 0001_initial.py
  ├── 0002_add_threaded_comments_consolidated.py
  └── __init__.py
```

❌ **DON'T**: Add migration folders to `.gitignore`

### 2. One Clean Migration Path
Each app should have a linear, non-conflicting migration chain:

```
0001_initial
    ↓
0002_feature_name
    ↓
0003_another_feature
    ↓
0004_bugfix
```

### 3. Why the 0002/0003 Conflict Happened
Someone created multiple migrations with conflicting dependencies:
- `0002_add_threaded_comments.py` (empty)
- `0002_add_threaded_comments_DEPRECATED.py` (empty)
- `0003_add_threaded_comments.py` (referenced non-existent parent)

This broke fresh installations because Django couldn't resolve the dependency graph.

## Solution Applied

### New Migration File
Created: `0002_add_threaded_comments_consolidated.py`
- Consolidates all threading changes into ONE migration
- Depends directly on `0001_initial`
- Includes documentation for existing databases

### Cleanup Strategy

#### For Fresh Installations
- Rename or delete the old conflicting files
- Use the new consolidated migration
- Everything works cleanly

#### For Existing Databases
If you already applied these migrations in production:

```bash
# Check what migrations are applied
python manage.py showmigrations pain_points

# If old migrations are in the DB but columns exist:
python manage.py migrate pain_points 0002_add_threaded_comments_consolidated --fake
```

## How to Avoid This in the Future

### Development Workflow

**✅ CORRECT:**
```bash
# Create ONE migration for a feature
python manage.py makemigrations pain_points --name add_threaded_comments

# Results in: 0002_add_threaded_comments.py
# Apply it
python manage.py migrate pain_points
```

**❌ WRONG:**
```bash
# Multiple migrations with same number
python manage.py makemigrations pain_points
python manage.py makemigrations pain_points  # Creates 0002, 0003 with conflicts
```

### Rules for Creating Migrations

1. **Use meaningful names**: `0004_add_user_preferences.py` ✅
2. **One feature per migration**: Don't mix unrelated changes
3. **Test before committing**: 
   ```bash
   python manage.py migrate --plan
   python manage.py migrate
   python manage.py migrate --reverse  # Test rollback
   ```
4. **Never edit committed migrations**: Create new ones to undo changes
5. **Keep the chain clean**: Each migration should depend on the previous one

### Code Review Checklist

When reviewing PRs with migrations:

- [ ] Migration has meaningful name
- [ ] Dependencies are correct (usually the last migration in that app)
- [ ] No duplicate migration numbers
- [ ] Migration includes a docstring explaining purpose
- [ ] Changes are tested on both fresh and existing databases
- [ ] No complex squashing of old migrations

## Cleanup for HEFAISTOS

### Current Status
- Old conflicting files exist in repo but are now harmless
- New consolidated migration available
- Either approach works:
  
  **Option A (Keep old, use new)**: Current state - old files stay for backward compatibility
  
  **Option B (Full cleanup)**: Delete old files, rename consolidated to `0002_add_threaded_comments.py`

### Recommendation
- Use **Option A** for now (safer, maintains DB history)
- Plan **Option B** for next major release if needed
- Add this document to team wiki for future migrations

## Testing New Deployments

Always test migrations on fresh databases before production:

```bash
# Simulate fresh installation
docker compose down -v
docker compose up

# Check logs for migration errors
docker compose logs backend | grep -i migration

# If successful, all migrations applied cleanly
docker compose exec backend python manage.py showmigrations
```

## Troubleshooting

### "Migration X has no replacement in Y"
→ Check that migration numbers are sequential without gaps

### "NodeNotFoundError: dependencies reference nonexistent"
→ Check migration dependencies point to actual files

### "django.db.IntegrityError during migrate"
→ Old migration might have constraints or defaults conflicting with new schema

**Solution**: Create a new migration to fix the schema, don't edit old ones

## Resources
- Django Docs: https://docs.djangoproject.com/en/5.0/topics/migrations/
- Best Practices: https://docs.djangoproject.com/en/5.0/topics/migrations/#best-practices
