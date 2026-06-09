# Pain Points Migration Recovery Guide

## Issue
The `pain_points` app had conflicting migrations that caused the build to fail with:
```
django.db.migrations.exceptions.NodeNotFoundError: Migration pain_points.0003_add_threaded_comments dependencies 
reference nonexistent parent node ('pain_points', '0002_rename_pain_points_organiza_idx_pain_points_organiz_715dd4_idx_and_more')
```

## Root Cause
Multiple conflicting migration files were created:
- `0002_add_threaded_comments.py` (empty)
- `0002_add_threaded_comments_DEPRECATED.py` (empty)
- `0003_add_threaded_comments.py` (actual changes, with broken dependencies)

The 0003 migration was trying to depend on a non-existent migration that was never committed to the repo.

## Solution Applied
Fixed the migration chain to properly chain them together:

```
0001_initial (creates PainPoint, PainPointComment models)
  ↓
0002_add_threaded_comments (empty no-op)
  ↓
0002_add_threaded_comments_DEPRECATED (empty no-op, maintains compatibility)
  ↓
0003_add_threaded_comments (adds parent_comment, is_response_to_question fields)
```

## Files Changed
1. **0002_add_threaded_comments.py**
   - Updated to have correct dependency chain
   - Changed to empty no-op operation
   - Added explanatory comments

2. **0002_add_threaded_comments_DEPRECATED.py**
   - Updated to have correct dependency chain
   - Changed to empty no-op operation
   - Added explanatory comments

3. **0003_add_threaded_comments.py**
   - Fixed dependency to point to `0002_add_threaded_comments_DEPRECATED`
   - Removed reference to non-existent migration

## Testing
The migration should now run successfully:
```bash
python manage.py migrate pain_points
```

## Future Cleanup (Optional)
These migration files can be cleaned up in a future version by:
1. Creating a new migration that consolidates the changes from 0003 into a single migration
2. Removing the deprecated 0002 files
3. Using Django's `--fake` option to handle already-applied migrations

However, for backward compatibility with existing databases, it's safer to leave them as-is.

## For Existing Deployments
If you have an existing database that already applied some of these migrations, the Django migration system will automatically detect and apply only the missing ones in the correct order.
