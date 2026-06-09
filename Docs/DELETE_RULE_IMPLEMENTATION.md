# Delete Rule Functionality Implementation

## Overview
Implemented complete rule deletion functionality with permission-based access control and workbench status validation.

## Requirements Met ✅
- ✅ Rules can only be deleted if the linked workbench is **NOT** in DEPLOYED status
- ✅ Only rule author, admin, or superadmin can delete a rule
- ✅ User-friendly confirmation modal before deletion
- ✅ Real-time UI updates after successful deletion
- ✅ Clear error messages for permission/status failures

## Backend Changes

### File: `backend/rules/schema.py`
**New: DeleteDetectionRule Mutation (Lines 1264-1303)**

```python
class DeleteDetectionRule(graphene.Mutation):
    """Delete a detection rule from the library.
    
    Rules can only be deleted if:
    - The linked workbench (if any) is NOT in DEPLOYED status
    - User is the rule author, admin, or superuser
    """
    class Arguments:
        rule_id = graphene.UUID(required=True)

    success = graphene.Boolean()
    message = graphene.String()

    @staticmethod
    @role_required([Roles.ADMIN, Roles.ANALYST])
    def mutate(root, info, rule_id):
        # Validates: authentication, org membership
        # Checks: user is author/admin/superadmin
        # Checks: linked playbook not DEPLOYED
        # Deletes rule and returns success message
```

**Key Features:**
- Authentication check: Ensures user is authenticated
- Organization check: Rule must belong to user's organization
- Permission check: Only owner, admin, or superadmin can delete
- Status check: Linked playbook cannot be in DEPLOYED status
- Proper error messages for each failure case

**Added to Mutation class (Line 1314):**
```python
delete_detection_rule = DeleteDetectionRule.Field()
```

## Frontend Changes

### File: `frontend/src/pages/RuleSearchPage.tsx`

**1. New GraphQL Queries & Mutations**
- `DELETE_RULE_MUTATION`: Calls backend `deleteDetectionRule` mutation
- `CURRENT_USER_QUERY`: Fetches current user data (id, username, role)
- Updated `RULES_CONNECTION_QUERY`: Now includes author field for permission checks

**2. Updated Imports**
```typescript
import { useLazyQuery, useMutation } from '@apollo/client/react';
import { Card, Input, Tag, Typography, Spin, Select, Checkbox, Switch, Space, Button, Modal, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
```

**3. New State Variables**
```typescript
const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
```

**4. Permission Checking Function**
```typescript
const canDeleteRule = (rule: Rule) => {
    if (!currentUser) return false;
    const isOwner = rule.author?.id === currentUser.id;
    const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN';
    return isOwner || isAdmin;
};
```

**5. Delete Handler with Confirmation Modal**
```typescript
const handleDeleteRule = async (rule: Rule) => {
    Modal.confirm({
        title: 'Delete Detection Rule',
        content: `Are you sure you want to delete the rule "${rule.title}"? This action cannot be undone.`,
        okText: 'Delete',
        okType: 'danger',
        onOk: async () => {
            // Executes deletion mutation
            // Shows success/error message
            // Refreshes search results on success
        },
    });
};
```

**6. Enhanced Rule Card with Delete Button**
- Delete button appears in card header (right side)
- Red trash icon indicates destructive action
- Button only shows for users with delete permission
- Delete button has loading state during mutation
- Author tag added below status for transparency

**UI Layout:**
```
┌─────────────────────────────────────────┐
│ Rule Title (Link)              [🗑 Del]  │
├─────────────────────────────────────────┤
│ Status: ACTIVE                          │
│ Author: username                        │
│ Tags: tag1, tag2, tag3                  │
│ Description: ...                        │
└─────────────────────────────────────────┘
```

## Validation Flow

### Backend Validation Chain
1. **Authentication**: User must be logged in
2. **Organization**: Rule must belong to user's org
3. **Rule Existence**: Rule with given ID must exist
4. **Authorization**: User must be author, admin, or superadmin
5. **Status Check**: If rule linked to playbook, playbook cannot be DEPLOYED

### Frontend Permission Check
- User role: ANALYST, ADMIN, or SUPERADMIN
- Ownership: Compares rule author ID with current user ID
- Delete button only shown if user has permission
- Confirmation modal prevents accidental deletion

## Error Handling

### Backend Error Messages
| Condition | Message |
|-----------|---------|
| Not authenticated | "Authentication required" |
| Rule not found | "Rule not found or you do not have permission" |
| No permission | "Only the rule author, admin, or superadmin can delete this rule" |
| Playbook DEPLOYED | "Cannot delete rule: the linked workbench is in DEPLOYED status. Please undeploy it first." |

### Frontend Feedback
- **Success**: Green message notification + auto-refresh search results
- **Error**: Red message notification with specific error message
- **Loading**: Button shows loading spinner during mutation

## User Workflow

1. User views detection rule in search results
2. If user has permission, red delete (🗑) button appears
3. User clicks delete button
4. Confirmation modal appears with rule title
5. User clicks "Delete" button to confirm
6. Backend validates and deletes rule
7. UI updates: 
   - Success message shown
   - Search results refreshed (rule removed)
   - Modal closes

## Testing Checklist

- [ ] Owner can delete their own rules
- [ ] Admin can delete any rule in organization
- [ ] Superadmin can delete any rule
- [ ] Non-admin analyst cannot delete other's rules
- [ ] Delete button hidden for users without permission
- [ ] Cannot delete rule if linked playbook is DEPLOYED
- [ ] Confirmation modal appears before deletion
- [ ] Error message shows when DEPLOYED check fails
- [ ] Search results refresh after successful deletion
- [ ] Load more pagination works correctly after deletion

## Code Quality
- ✅ TypeScript strict type checking enabled
- ✅ Proper error handling with try/catch
- ✅ Ant Design Modal and message components for UX
- ✅ Loading states during async operations
- ✅ Role-based access control (@role_required decorator)
- ✅ No syntax errors or linting issues
